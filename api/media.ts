import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { AwsClient } from 'aws4fetch';
import { randomBytes } from 'node:crypto';

/**
 * /api/media - the only door into object storage (Cloudflare R2 today).
 *
 *   GET  /api/media                      -> usage vs free tier (admin)
 *   POST /api/media { action: 'upload' } -> store one file (+ optional preview)
 *   POST /api/media { action: 'delete' } -> remove files by public URL
 *
 * Why one function: the Vercel Hobby plan caps a deployment at 12 serverless
 * functions and this project already had 11.
 *
 * Why uploads go through here instead of straight from the browser: the R2
 * secret must never reach the client, and this is where the free-tier guard
 * lives. Every write checks live usage first and refuses once any limit is at
 * BLOCK_AT, so the account never silently rolls into paid usage.
 *
 * Portability: objects are stored under plain, provider-neutral keys
 * (`products/2026/09/m<hex>.jpg`) and Firestore only ever holds
 * `${R2_PUBLIC_URL}/${key}`. Moving to S3 or anything else is: copy the bucket
 * with the same keys, point R2_* env vars at the new store, and run
 * scripts/rewrite-media-urls.mjs to swap the URL prefix. See MEDIA_STORAGE.md.
 *
 * Env (server only):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   R2_PUBLIC_URL               public read base, no trailing slash
 *   R2_BILLING_CYCLE_DAY        day of month the Cloudflare period starts (default 1)
 *   CLOUDFLARE_ANALYTICS_TOKEN  API token with Account Analytics: Read (optional,
 *                               without it Class B reads cannot be measured)
 */

// Free tier, per Cloudflare account, per billing month. Storage uses decimal GB
// on purpose: it is the smaller reading of "10 GB", so we stop early, not late.
const FREE_TIER = {
  storageBytes: 10 * 1000 ** 3,
  classA: 1_000_000,
  classB: 10_000_000,
};
const WARN_AT = 0.8;
/** Analytics lag by a few minutes; the 5% margin absorbs that. */
const BLOCK_AT = 0.95;

const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_PREVIEW_BYTES = 200 * 1024;
const MAX_PDF_BYTES = 1024 * 1024;
const PREVIEW_SUFFIX = '__w600.webp';
const MAX_DELETE_BATCH = 25;

type Category =
  | 'products' | 'banners' | 'home' | 'gallery' | 'showcases' | 'testimonials'
  | 'media' | 'receipts' | 'avatars' | 'reviews';

/** `perUser` categories are open to any signed-in user and keyed by their uid. */
const CATEGORIES: Record<Category, { perUser: boolean; allowPdf: boolean }> = {
  products: { perUser: false, allowPdf: false },
  banners: { perUser: false, allowPdf: false },
  home: { perUser: false, allowPdf: false },
  gallery: { perUser: false, allowPdf: false },
  showcases: { perUser: false, allowPdf: false },
  testimonials: { perUser: false, allowPdf: false },
  media: { perUser: false, allowPdf: false },
  receipts: { perUser: false, allowPdf: true },
  avatars: { perUser: true, allowPdf: false },
  reviews: { perUser: true, allowPdf: false },
};

/** Matches only keys this endpoint generated - nothing else can be deleted. */
const MANAGED_KEY = /^[a-z]+\/(?:[A-Za-z0-9_-]{1,128}\/)?\d{4}\/\d{2}\/m[0-9a-f]{24}\.(jpg|png|webp|pdf)$/;

// ── Plumbing ────────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: object) {
    super(message);
  }
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function r2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new HttpError(503, 'NOT_CONFIGURED', 'Media storage is not configured on the server (R2_* env vars).');
  }
  return {
    client: new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    }),
    bucketUrl: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
    bucket: R2_BUCKET,
    accountId: R2_ACCOUNT_ID,
  };
}

function publicBase(): string {
  const base = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) {
    throw new HttpError(
      503,
      'NOT_CONFIGURED',
      'Public access for the storage bucket is not set up yet (R2_PUBLIC_URL is empty).',
    );
  }
  return base;
}

function encodeKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

// ── Auth ────────────────────────────────────────────────────────────────────

interface Caller {
  uid: string;
  isAdmin: boolean;
}

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
  if (b64) {
    const svc = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(svc) });
  } else {
    // verifyIdToken only needs the project id - it checks Google's public keys.
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID });
  }
}

/**
 * The role is read through the Firestore REST API *as the caller* rather than
 * with the Admin SDK: a user may always read their own users/{uid} doc, and
 * this keeps working on the Spark plan where server-side Admin SDK Firestore
 * reads have hit RESOURCE_EXHAUSTED (see api/create-order.ts).
 */
async function authenticate(req: VercelRequest): Promise<Caller> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'AUTH', 'Please sign in to upload files.');

  initAdmin();
  let uid: string;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, 'AUTH', 'Your session has expired. Please sign in again.');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const resp = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  let role: string | undefined;
  if (resp.ok) {
    const json = (await resp.json()) as { fields?: { role?: { stringValue?: string } } };
    role = json.fields?.role?.stringValue;
  } else if (resp.status !== 404) {
    throw new HttpError(502, 'SERVER', `Could not verify your account (HTTP ${resp.status}).`);
  }
  return { uid, isAdmin: role === 'admin' };
}

// ── Usage vs free tier ──────────────────────────────────────────────────────

interface Usage {
  periodStart: string;
  periodEnd: string;
  storageBytes: number;
  objectCount: number;
  classA: number;
  /** null when no analytics token is configured - reads can't be counted then. */
  classB: number | null;
  source: 'analytics' | 'estimate';
  fetchedAt: string;
  limits: typeof FREE_TIER;
  thresholds: { warn: number; block: number };
  percent: { storage: number; classA: number; classB: number | null };
  level: 'ok' | 'warn' | 'block';
  /** Human-readable reasons for `warn` / `block`. */
  reasons: string[];
  notes: string[];
}

const CLASS_A_ACTIONS = new Set([
  'ListBuckets', 'PutBucket', 'ListObjects', 'PutObject', 'CopyObject', 'CompleteMultipartUpload',
  'CreateMultipartUpload', 'LifecycleStorageTierTransition', 'ListMultipartUploads', 'UploadPart',
  'UploadPartCopy', 'ListParts', 'PutBucketEncryption', 'PutBucketCors', 'PutBucketLifecycleConfiguration',
]);
const CLASS_B_ACTIONS = new Set([
  'HeadBucket', 'HeadObject', 'GetObject', 'UsageSummary', 'GetBucketEncryption', 'GetBucketLocation',
  'GetBucketCors', 'GetBucketLifecycleConfiguration',
]);

function billingPeriod(now = new Date()) {
  const day = Math.min(28, Math.max(1, parseInt(process.env.R2_BILLING_CYCLE_DAY || '1', 10) || 1));
  const y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  if (now.getUTCDate() < day) m -= 1;
  const start = new Date(Date.UTC(y, m, day));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, day));
  return { start, end };
}

async function cloudflareGraphql(token: string, query: string, variables: Record<string, string>) {
  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await resp.json()) as any;
  if (!resp.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message || `Cloudflare analytics HTTP ${resp.status}`);
  }
  const account = json.data?.viewer?.accounts?.[0];
  if (!account) throw new Error('Cloudflare analytics returned no account data');
  return account;
}

/** Latest storage sample per bucket. Looks back a day so a brand-new period still has one. */
async function storageFromAnalytics(token: string, accountId: string, now: Date) {
  const account = await cloudflareGraphql(
    token,
    `query R2Storage($account: string!, $start: Time!, $end: Time!) {
      viewer { accounts(filter: { accountTag: $account }) {
        r2StorageAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }, orderBy: [datetime_DESC]) {
          max { objectCount payloadSize metadataSize }
          dimensions { datetime bucketName }
        }
      } }
    }`,
    { account: accountId, start: new Date(now.getTime() - 86400000).toISOString(), end: now.toISOString() },
  );
  return account.r2StorageAdaptiveGroups || [];
}

async function opsInPeriod(token: string, accountId: string, start: Date, now: Date) {
  const account = await cloudflareGraphql(
    token,
    `query R2Ops($account: string!, $start: Time!, $end: Time!) {
      viewer { accounts(filter: { accountTag: $account }) {
        r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
          sum { requests }
          dimensions { actionType }
        }
      } }
    }`,
    { account: accountId, start: start.toISOString(), end: now.toISOString() },
  );
  let classA = 0;
  let classB = 0;
  for (const g of account.r2OperationsAdaptiveGroups || []) {
    const n = Number(g.sum?.requests) || 0;
    if (CLASS_A_ACTIONS.has(g.dimensions?.actionType)) classA += n;
    else if (CLASS_B_ACTIONS.has(g.dimensions?.actionType)) classB += n;
  }
  return { classA, classB };
}

/**
 * Without an analytics token, list the bucket. Every object was written by a
 * single PutObject through this endpoint, so objects modified this period are a
 * fair count of our Class A spend (plus the list calls themselves). Listing is
 * itself Class A - one op per 1000 objects - which is why this is cached.
 */
async function usageFromListing(start: Date) {
  const { client, bucketUrl } = r2();
  let storageBytes = 0;
  let objectCount = 0;
  let writesThisPeriod = 0;
  let listCalls = 0;
  let token: string | undefined;
  do {
    const url = `${bucketUrl}?list-type=2&max-keys=1000${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`;
    const resp = await client.fetch(url);
    listCalls += 1;
    if (!resp.ok) throw new Error(`R2 list failed (HTTP ${resp.status})`);
    const xml = await resp.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const size = Number(/<Size>(\d+)<\/Size>/.exec(m[1])?.[1] || 0);
      const modified = /<LastModified>([^<]+)<\/LastModified>/.exec(m[1])?.[1];
      storageBytes += size;
      objectCount += 1;
      if (modified && new Date(modified) >= start) writesThisPeriod += 1;
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1]
      : undefined;
  } while (token && listCalls < 200);
  return { storageBytes, objectCount, classA: writesThisPeriod + listCalls };
}

let usageCache: { usage: Usage; expires: number } | null = null;

function finalizeUsage(u: Omit<Usage, 'percent' | 'level' | 'reasons' | 'limits' | 'thresholds'>): Usage {
  const percent = {
    storage: u.storageBytes / FREE_TIER.storageBytes,
    classA: u.classA / FREE_TIER.classA,
    classB: u.classB == null ? null : u.classB / FREE_TIER.classB,
  };
  const reasons: string[] = [];
  const check = (p: number | null, label: string) => {
    if (p == null) return 'ok';
    if (p >= BLOCK_AT) {
      reasons.push(`${label} is at ${Math.round(p * 100)}% of the free limit`);
      return 'block';
    }
    if (p >= WARN_AT) {
      reasons.push(`${label} is at ${Math.round(p * 100)}% of the free limit`);
      return 'warn';
    }
    return 'ok';
  };
  const levels = [
    check(percent.storage, 'Storage space'),
    check(percent.classA, 'Uploads (Class A operations)'),
    check(percent.classB, 'Image views (Class B operations)'),
  ];
  const level = levels.includes('block') ? 'block' : levels.includes('warn') ? 'warn' : 'ok';
  return { ...u, percent, level, reasons, limits: FREE_TIER, thresholds: { warn: WARN_AT, block: BLOCK_AT } };
}

async function getUsage(force = false): Promise<Usage> {
  if (!force && usageCache && usageCache.expires > Date.now()) return usageCache.usage;

  const now = new Date();
  const { start, end } = billingPeriod(now);
  const token = (process.env.CLOUDFLARE_ANALYTICS_TOKEN || '').trim();
  const { accountId, bucket } = r2();
  const notes: string[] = [];
  let usage: Usage;

  let analyticsError: string | null = null;
  if (token) {
    try {
      const [storageGroups, ops] = await Promise.all([
        storageFromAnalytics(token, accountId, now),
        opsInPeriod(token, accountId, start, now),
      ]);
      // Latest sample per bucket, summed: the free tier is account-wide.
      const latest = new Map<string, { objectCount: number; bytes: number }>();
      for (const g of storageGroups) {
        const name = g.dimensions?.bucketName || bucket;
        if (latest.has(name)) continue;
        latest.set(name, {
          objectCount: Number(g.max?.objectCount) || 0,
          bytes: (Number(g.max?.payloadSize) || 0) + (Number(g.max?.metadataSize) || 0),
        });
      }
      let storageBytes = 0;
      let objectCount = 0;
      latest.forEach((v) => {
        storageBytes += v.bytes;
        objectCount += v.objectCount;
      });
      notes.push('Live numbers from Cloudflare analytics (can lag a few minutes).');
      usage = finalizeUsage({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        storageBytes,
        objectCount,
        classA: ops.classA,
        classB: ops.classB,
        source: 'analytics',
        fetchedAt: now.toISOString(),
        notes,
      });
      usageCache = { usage, expires: Date.now() + 5 * 60 * 1000 };
      return usage;
    } catch (err) {
      analyticsError = err instanceof Error ? err.message : String(err);
    }
  }

  const listed = await usageFromListing(start);
  notes.push(
    analyticsError
      ? `Cloudflare analytics failed (${analyticsError}); showing an estimate from the bucket listing.`
      : 'Estimate from the bucket listing. Add CLOUDFLARE_ANALYTICS_TOKEN to see exact operations and image views.',
  );
  usage = finalizeUsage({
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    storageBytes: listed.storageBytes,
    objectCount: listed.objectCount,
    classA: listed.classA,
    classB: null,
    source: 'estimate',
    fetchedAt: now.toISOString(),
    notes,
  });
  usageCache = { usage, expires: Date.now() + 15 * 60 * 1000 };
  return usage;
}

/** Keep the cached figures honest between refreshes. */
function recordWrite(bytes: number, objects: number) {
  if (!usageCache) return;
  const u = usageCache.usage;
  usageCache.usage = finalizeUsage({
    ...u,
    storageBytes: Math.max(0, u.storageBytes + bytes),
    objectCount: Math.max(0, u.objectCount + objects),
    classA: u.classA + Math.max(0, objects),
  });
}

/**
 * A delete doesn't report the size it freed (finding out costs a HEAD, a Class
 * B op), so drop the cache and let the next usage read re-measure.
 */
function invalidateUsage() {
  usageCache = null;
}

// ── Upload ──────────────────────────────────────────────────────────────────

type Sniffed = { ext: 'jpg' | 'png' | 'webp' | 'pdf'; contentType: string };

/** Trust the bytes, not the browser's claimed MIME type. */
function sniff(buf: Buffer): Sniffed | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return { ext: 'pdf', contentType: 'application/pdf' };
  return null;
}

function decodeBase64(data: unknown): Buffer {
  if (typeof data !== 'string' || !data) throw new HttpError(400, 'BAD_REQUEST', 'No file data received.');
  return Buffer.from(data.replace(/^data:[^,]*,/, ''), 'base64');
}

function kb(bytes: number) {
  return `${Math.ceil(bytes / 1024)} KB`;
}

async function putObject(key: string, body: Buffer, contentType: string, extraHeaders: Record<string, string> = {}) {
  const { client, bucketUrl } = r2();
  const resp = await client.fetch(`${bucketUrl}/${encodeKey(key)}`, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: {
      'Content-Type': contentType,
      // Keys are random and never overwritten, so they are safe to cache forever.
      // With a custom domain this lets Cloudflare's cache answer repeat views
      // without touching R2 (and without spending Class B operations).
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...extraHeaders,
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new HttpError(502, 'SERVER', `Storage rejected the upload (HTTP ${resp.status}). ${text.slice(0, 200)}`);
  }
}

async function handleUpload(req: VercelRequest, caller: Caller) {
  const body = (req.body || {}) as {
    category?: string;
    file?: { name?: string; data?: string };
    preview?: { data?: string };
  };

  const category = body.category as Category;
  const rules = CATEGORIES[category];
  if (!rules) throw new HttpError(400, 'BAD_REQUEST', 'Unknown upload category.');
  if (!rules.perUser && !caller.isAdmin) throw new HttpError(403, 'FORBIDDEN', 'Only admins can upload here.');

  const base = publicBase();
  const file = decodeBase64(body.file?.data);
  const type = sniff(file);
  if (!type || (type.ext === 'pdf' && !rules.allowPdf)) {
    throw new HttpError(415, 'BAD_TYPE', rules.allowPdf ? 'Only JPG, PNG, WebP or PDF files are allowed.' : 'Only JPG, PNG or WebP images are allowed.');
  }
  const limit = type.ext === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.length > limit) {
    throw new HttpError(413, 'TOO_LARGE', `File is ${kb(file.length)}. The limit is ${kb(limit)}.`, { bytes: file.length, limit });
  }

  let preview: Buffer | null = null;
  if (type.ext !== 'pdf' && body.preview?.data) {
    preview = decodeBase64(body.preview.data);
    const pType = sniff(preview);
    if (!pType || pType.ext === 'pdf' || preview.length > MAX_PREVIEW_BYTES) {
      preview = null; // A bad preview isn't worth failing the upload; the full image still works.
    }
  }

  const usage = await getUsage();
  if (usage.level === 'block') {
    throw new HttpError(429, 'LIMIT_REACHED', 'Uploads are paused: the free storage plan is almost used up.', { usage });
  }

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = `m${randomBytes(12).toString('hex')}`;
  const dir = rules.perUser ? `${category}/${caller.uid}/${yyyy}/${mm}` : `${category}/${yyyy}/${mm}`;
  const key = `${dir}/${id}.${type.ext}`;

  const extra: Record<string, string> = {};
  if (type.ext === 'pdf') {
    const safeName = String(body.file?.name || 'document.pdf').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
    extra['Content-Disposition'] = `inline; filename="${safeName}"`;
  }

  await putObject(key, file, type.contentType, extra);
  let previewUrl: string | undefined;
  if (preview) {
    const previewKey = `${dir}/${id}${PREVIEW_SUFFIX}`;
    try {
      // Content-Type from the bytes: browsers without WebP encoding send JPEG.
      await putObject(previewKey, preview, sniff(preview)!.contentType);
      previewUrl = `${base}/${previewKey}`;
    } catch (err) {
      console.warn('[media] preview upload failed, original kept:', err);
      preview = null;
    }
  }
  recordWrite(file.length + (preview?.length || 0), preview ? 2 : 1);

  return {
    url: `${base}/${key}`,
    key,
    bytes: file.length,
    contentType: type.contentType,
    previewUrl,
  };
}

// ── Delete ──────────────────────────────────────────────────────────────────

async function handleDelete(req: VercelRequest, caller: Caller) {
  const urls = ((req.body || {}) as { urls?: unknown }).urls;
  if (!Array.isArray(urls) || urls.length === 0) throw new HttpError(400, 'BAD_REQUEST', 'No files to delete.');
  if (urls.length > MAX_DELETE_BATCH) throw new HttpError(400, 'BAD_REQUEST', `Delete at most ${MAX_DELETE_BATCH} files at once.`);

  const base = publicBase();
  const { client, bucketUrl } = r2();
  const deleted: string[] = [];
  const skipped: string[] = [];

  for (const raw of urls) {
    const url = String(raw || '');
    const key = url.startsWith(`${base}/`) ? decodeURIComponent(url.slice(base.length + 1)) : '';
    if (!MANAGED_KEY.test(key)) {
      skipped.push(url); // Cloudinary, external links, or someone else's bucket - not ours to remove.
      continue;
    }
    const [category, owner] = key.split('/');
    const ownsIt = CATEGORIES[category as Category]?.perUser && owner === caller.uid;
    if (!caller.isAdmin && !ownsIt) throw new HttpError(403, 'FORBIDDEN', 'You can only delete your own files.');

    const keys = [key];
    if (!key.endsWith('.pdf')) keys.push(key.replace(/\.(jpg|png|webp)$/, PREVIEW_SUFFIX));
    // DeleteObject is a free operation on R2. A 404 is fine - it's already gone.
    for (const k of keys) {
      const resp = await client.fetch(`${bucketUrl}/${encodeKey(k)}`, { method: 'DELETE' });
      if (!resp.ok && resp.status !== 404) {
        throw new HttpError(502, 'SERVER', `Storage refused to delete a file (HTTP ${resp.status}).`);
      }
    }
    deleted.push(url);
  }
  if (deleted.length) invalidateUsage();
  return { deleted, skipped };
}

// ── Entry ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const caller = await authenticate(req);

    if (req.method === 'GET') {
      if (!caller.isAdmin) throw new HttpError(403, 'FORBIDDEN', 'Only admins can view storage usage.');
      const force = /[?&]refresh=1\b/.test(req.url || '');
      const usage = await getUsage(force);
      return res.status(200).json({ ok: true, usage, publicUrlConfigured: /^https?:\/\//.test(process.env.R2_PUBLIC_URL || '') });
    }

    if (req.method === 'POST') {
      const action = ((req.body || {}) as { action?: string }).action;
      if (action === 'upload') return res.status(200).json({ ok: true, ...(await handleUpload(req, caller)) });
      if (action === 'delete') return res.status(200).json({ ok: true, ...(await handleDelete(req, caller)) });
      throw new HttpError(400, 'BAD_REQUEST', 'Unknown action.');
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ ok: false, code: err.code, error: err.message, ...(err.extra || {}) });
    }
    console.error('[media] unexpected error:', err);
    return res.status(500).json({ ok: false, code: 'SERVER', error: err instanceof Error ? err.message : 'Unexpected server error' });
  }
}
