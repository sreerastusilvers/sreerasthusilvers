import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Bell, Send, Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react';

interface SendResult {
  ok: boolean;
  successCount?: number;
  failureCount?: number;
  invalidTokens?: string[];
  error?: string;
  detail?: string;
  messageId?: string;
}

const AdminNotifications = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [audience, setAudience] = useState<'all' | 'customers' | 'delivery'>('all');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('adminNotificationKey') || '');
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Count subscribed tokens for the chosen audience
  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      try {
        const tokensSnap = await getDocs(collection(db, 'userTokens'));
        const tokens = tokensSnap.docs.map((d) => d.data() as { uid?: string; token: string });
        const uids = Array.from(new Set(tokens.map((t) => t.uid).filter(Boolean))) as string[];
        if (audience === 'all') {
          if (!cancelled) setTokenCount(tokens.length);
          return;
        }
        // Filter by user role
        const role = audience === 'customers' ? 'customer' : 'delivery';
        const matchingUids = new Set<string>();
        // Firestore "in" supports up to 30 values per query in v9; chunk if needed
        for (let i = 0; i < uids.length; i += 30) {
          const chunk = uids.slice(i, i + 30);
          if (chunk.length === 0) continue;
          const usersSnap = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', chunk), where('role', '==', role))
          );
          usersSnap.forEach((u) => matchingUids.add(u.id));
        }
        const matchingTokens = tokens.filter((t) => t.uid && matchingUids.has(t.uid));
        if (!cancelled) setTokenCount(matchingTokens.length);
      } catch (err) {
        console.warn('[notifications] count failed:', err);
        if (!cancelled) setTokenCount(0);
      }
    };
    loadCount();
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const collectTokens = async (): Promise<string[]> => {
    const tokensSnap = await getDocs(collection(db, 'userTokens'));
    const all = tokensSnap.docs.map((d) => d.data() as { uid?: string; token: string });
    if (audience === 'all') return all.map((t) => t.token).filter(Boolean);
    const role = audience === 'customers' ? 'customer' : 'delivery';
    const uids = Array.from(new Set(all.map((t) => t.uid).filter(Boolean))) as string[];
    const matchingUids = new Set<string>();
    for (let i = 0; i < uids.length; i += 30) {
      const chunk = uids.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('__name__', 'in', chunk), where('role', '==', role))
      );
      usersSnap.forEach((u) => matchingUids.add(u.id));
    }
    return all.filter((t) => t.uid && matchingUids.has(t.uid)).map((t) => t.token);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setResult({ ok: false, error: 'Title and body are required' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const tokens = await collectTokens();
      if (tokens.length === 0) {
        setResult({ ok: false, error: 'No subscribers for the selected audience' });
        setSending(false);
        return;
      }
      localStorage.setItem('adminNotificationKey', adminKey);
      const resp = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey ? { 'x-admin-key': adminKey } : {}),
        },
        body: JSON.stringify({
          tokens,
          title: title.trim(),
          body: body.trim(),
          ...(imageUrl.trim() ? { image: imageUrl.trim() } : {}),
          ...(linkUrl.trim() ? { url: linkUrl.trim() } : {}),
        }),
      });
      const data = (await resp.json()) as SendResult;
      setResult(data);
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || 'Network error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/30 border border-amber-200/40 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100">
            <Bell className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing Center</h1>
            <p className="text-sm text-gray-600">Launch web push campaigns and manage audience targeting from one place.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. New collection launched"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <p className="text-[11px] text-gray-500 mt-1">{title.length}/80</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Body <span className="text-red-500">*</span></label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder="Tap to explore the latest pieces..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
            />
            <p className="text-[11px] text-gray-500 mt-1">{body.length}/240</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Image URL (optional)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Click URL (optional)</label>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/category/jewellery"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Admin Key</label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="x-admin-key (matches ADMIN_NOTIFICATION_KEY env var)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <p className="text-[11px] text-gray-500 mt-1">Stored only in your browser. Required if the API enforces it.</p>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : `Send to ${tokenCount ?? '…'} device${tokenCount === 1 ? '' : 's'}`}
          </button>

          {result && (
            <div
              className={`mt-2 rounded-lg border p-3 text-sm flex gap-2 items-start ${
                result.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
              <div className="flex-1">
                {result.ok ? (
                  <>
                    <p className="font-medium">Notification dispatched.</p>
                    {typeof result.successCount === 'number' && (
                      <p className="text-xs mt-0.5">
                        Delivered: {result.successCount} · Failed: {result.failureCount} · Invalid tokens: {result.invalidTokens?.length || 0}
                      </p>
                    )}
                    {result.messageId && <p className="text-xs mt-0.5">Message ID: {result.messageId}</p>}
                  </>
                ) : (
                  <>
                    <p className="font-medium">{result.error || 'Send failed.'}</p>
                    {result.detail && <p className="text-xs mt-0.5 opacity-80">{result.detail}</p>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-amber-700" />
              <h3 className="font-semibold text-gray-900">Audience</h3>
            </div>
            <div className="space-y-2">
              {[
                { id: 'all', label: 'All subscribers' },
                { id: 'customers', label: 'Customers only' },
                { id: 'delivery', label: 'Delivery partners only' },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value={opt.id}
                    checked={audience === (opt.id as typeof audience)}
                    onChange={() => setAudience(opt.id as typeof audience)}
                    className="accent-amber-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Devices in selection</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                {tokenCount === null ? <Loader2 className="h-5 w-5 animate-spin inline" /> : tokenCount}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Preview</h3>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-600 flex items-center justify-center flex-shrink-0">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{title || 'Notification title'}</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{body || 'Notification body preview goes here…'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Sreerasthu Silvers · now</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;
