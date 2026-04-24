import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function initAdmin() {
  if (admin.apps.length) return;

  const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
  if (!b64) {
    throw new Error('FIREBASE_ADMIN_SDK_BASE64 env var is missing');
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    throw new Error('FIREBASE_ADMIN_SDK_BASE64 is not valid base64-encoded JSON');
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function requireAdminUser(req: VercelRequest) {
  initAdmin();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    throw new Error('Missing Authorization bearer token');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
  const role = userDoc.data()?.role;

  if (role !== 'admin') {
    throw new Error('Only admins can generate Gemini prompts');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireAdminUser(req);
  } catch (error: any) {
    return res.status(401).json({ error: error.message || 'Unauthorized' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const body = (req.body || {}) as {
    contents?: unknown;
  };

  if (!body.contents) {
    return res.status(400).json({ error: 'contents is required' });
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: body.contents as never,
      });

      if (response.text) {
        return res.status(200).json({ ok: true, text: response.text, model });
      }
    } catch (error) {
      lastError = error;
    }
  }

  return res.status(500).json({
    error: 'All Gemini models failed',
    detail: lastError instanceof Error ? lastError.message : 'Unknown Gemini error',
  });
}