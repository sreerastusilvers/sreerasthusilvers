import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Loader2, X, Ticket, Percent, IndianRupee,
  Calendar, Tag, Users as UsersIcon, Search, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import {
  Coupon,
  CouponType,
  subscribeCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '@/services/couponService';

interface DraftCoupon {
  id?: string;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minOrderValue: number;
  maxDiscount: number;
  maxUses: number;
  perUserLimit: number;
  validFrom: string;
  validTo: string;
  active: boolean;
  firstOrderOnly: boolean;
}

const empty = (): DraftCoupon => ({
  code: '',
  description: '',
  type: 'percent',
  value: 10,
  minOrderValue: 0,
  maxDiscount: 0,
  maxUses: 0,
  perUserLimit: 0,
  validFrom: '',
  validTo: '',
  active: true,
  firstOrderOnly: false,
});

const fmtDate = (t?: Timestamp | null) => {
  if (!t) return '—';
  return t.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toInputDate = (t?: Timestamp | null) => {
  if (!t) return '';
  const d = t.toDate();
  const m = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${m(d.getMonth() + 1)}-${m(d.getDate())}`;
};

const fromInputDate = (s: string): Timestamp | null => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
};

const AdminCoupons = () => {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftCoupon>(empty());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeCoupons((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const list = useMemo(() => {
    const now = new Date();
    return items.filter((c) => {
      if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
      const expired = c.validTo && c.validTo.toDate() < now;
      if (filter === 'active' && (!c.active || expired)) return false;
      if (filter === 'inactive' && c.active) return false;
      if (filter === 'expired' && !expired) return false;
      return true;
    });
  }, [items, search, filter]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: items.length,
      active: items.filter((c) => c.active && (!c.validTo || c.validTo.toDate() > now)).length,
      uses: items.reduce((sum, c) => sum + (c.usedCount || 0), 0),
    };
  }, [items]);

  const openNew = () => { setDraft(empty()); setShowForm(true); };
  const openEdit = (c: Coupon) => {
    setDraft({
      id: c.id,
      code: c.code,
      description: c.description || '',
      type: c.type,
      value: c.value,
      minOrderValue: c.minOrderValue || 0,
      maxDiscount: c.maxDiscount || 0,
      maxUses: c.maxUses || 0,
      perUserLimit: c.perUserLimit || 0,
      validFrom: toInputDate(c.validFrom),
      validTo: toInputDate(c.validTo),
      active: c.active,
      firstOrderOnly: c.firstOrderOnly || false,
    });
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = draft.code.toUpperCase().trim();
    if (!code) return toast.error('Coupon code is required');
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return toast.error('Code must be 3–20 chars (A-Z, 0-9, -, _)');
    if (draft.value <= 0) return toast.error('Value must be > 0');
    if (draft.type === 'percent' && draft.value > 100) return toast.error('Percent must be ≤ 100');

    try {
      setSaving(true);
      const payload = {
        code,
        description: draft.description.trim(),
        type: draft.type,
        value: Number(draft.value),
        minOrderValue: Number(draft.minOrderValue) || 0,
        maxDiscount: Number(draft.maxDiscount) || 0,
        maxUses: Number(draft.maxUses) || 0,
        perUserLimit: Number(draft.perUserLimit) || 0,
        validFrom: fromInputDate(draft.validFrom),
        validTo: fromInputDate(draft.validTo),
        active: draft.active,
        firstOrderOnly: draft.firstOrderOnly,
      };
      if (draft.id) {
        await updateCoupon(draft.id, payload);
        toast.success('Coupon updated');
      } else {
        await createCoupon(payload);
        toast.success('Coupon created');
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm('Delete this coupon? This cannot be undone.')) return;
    try { await deleteCoupon(id); toast.success('Deleted'); }
    catch (e: any) { toast.error(e?.message || 'Delete failed'); }
  };

  const toggle = async (c: Coupon) => {
    if (!c.id) return;
    try { await updateCoupon(c.id, { active: !c.active }); }
    catch (e: any) { toast.error(e?.message || 'Update failed'); }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-700 font-medium mb-2 flex items-center gap-2">
            <Ticket className="w-3.5 h-3.5" /> Marketing
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create promotional coupon codes with minimum order value, expiry, and usage limits.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Total Coupons" value={stats.total} tint="bg-amber-50 text-amber-700" />
        <StatCard icon={<Check className="w-5 h-5" />} label="Active" value={stats.active} tint="bg-emerald-50 text-emerald-700" />
        <StatCard icon={<UsersIcon className="w-5 h-5" />} label="Total Redemptions" value={stats.uses} tint="bg-indigo-50 text-indigo-700" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon code…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white overflow-hidden text-sm">
          {(['all', 'active', 'inactive', 'expired'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 capitalize ${filter === f ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Ticket className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No coupons found. Create your first one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => {
            const expired = c.validTo && c.validTo.toDate() < new Date();
            const usagePct = c.maxUses > 0 ? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100)) : 0;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Ticket left strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${expired ? 'bg-gray-300' : c.active ? 'bg-amber-500' : 'bg-gray-300'}`} />
                <div className="p-5 pl-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <button
                        onClick={() => copyCode(c.code)}
                        className="group inline-flex items-center gap-2 font-mono font-bold text-lg text-gray-900 hover:text-amber-700"
                        title="Copy code"
                      >
                        {c.code}
                        {copied === c.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />}
                      </button>
                      {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      expired ? 'bg-gray-100 text-gray-500' :
                      c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {expired ? 'Expired' : c.active ? 'Active' : 'Hidden'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-amber-600 flex items-center">
                      {c.type === 'percent' ? <>{c.value}<Percent className="w-5 h-5 ml-0.5" /></> : <><IndianRupee className="w-6 h-6" />{c.value}</>}
                    </span>
                    <span className="text-xs text-gray-500">OFF</span>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600 border-t border-dashed border-gray-200 pt-3">
                    <Row label="Min order" value={`₹${(c.minOrderValue || 0).toLocaleString('en-IN')}`} />
                    {c.type === 'percent' && c.maxDiscount > 0 && (
                      <Row label="Max discount" value={`₹${c.maxDiscount.toLocaleString('en-IN')}`} />
                    )}
                    <Row
                      label="Validity"
                      value={`${fmtDate(c.validFrom)} → ${fmtDate(c.validTo)}`}
                    />
                    <Row
                      label="Used"
                      value={c.maxUses > 0 ? `${c.usedCount} / ${c.maxUses}` : `${c.usedCount} (unlimited)`}
                    />
                    {c.maxUses > 0 && (
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${usagePct}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => toggle(c)} className="p-2 rounded-lg hover:bg-gray-100" title={c.active ? 'Deactivate' : 'Activate'}>
                      {c.active ? <Eye className="w-4 h-4 text-gray-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-gray-100" title="Edit">
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button onClick={() => onDelete(c.id)} className="p-2 rounded-lg hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {draft.id ? 'Edit Coupon' : 'New Coupon'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Code *">
                  <input className="cf-input font-mono uppercase" value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                    placeholder="WELCOME10" required />
                </Field>
                <Field label="Type">
                  <select className="cf-input" value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value as CouponType })}>
                    <option value="percent">Percentage off</option>
                    <option value="flat">Flat amount off</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <input className="cf-input" value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="e.g. New customer welcome offer" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label={draft.type === 'percent' ? 'Discount %' : 'Discount ₹'}>
                  <input type="number" min={1} className="cf-input" value={draft.value}
                    onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })} />
                </Field>
                <Field label="Min Order Value (₹)">
                  <input type="number" min={0} className="cf-input" value={draft.minOrderValue}
                    onChange={(e) => setDraft({ ...draft, minOrderValue: Number(e.target.value) })} />
                </Field>
                {draft.type === 'percent' && (
                  <Field label="Max Discount (₹, 0 = none)">
                    <input type="number" min={0} className="cf-input" value={draft.maxDiscount}
                      onChange={(e) => setDraft({ ...draft, maxDiscount: Number(e.target.value) })} />
                  </Field>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Total Uses (0 = unlimited)">
                  <input type="number" min={0} className="cf-input" value={draft.maxUses}
                    onChange={(e) => setDraft({ ...draft, maxUses: Number(e.target.value) })} />
                </Field>
                <Field label="Per-User Limit (0 = unlimited)">
                  <input type="number" min={0} className="cf-input" value={draft.perUserLimit}
                    onChange={(e) => setDraft({ ...draft, perUserLimit: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Valid From">
                  <input type="date" className="cf-input" value={draft.validFrom}
                    onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} />
                </Field>
                <Field label="Valid To">
                  <input type="date" className="cf-input" value={draft.validTo}
                    onChange={(e) => setDraft({ ...draft, validTo: e.target.value })} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                  Active
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.firstOrderOnly}
                    onChange={(e) => setDraft({ ...draft, firstOrderOnly: e.target.checked })} />
                  First-order customers only
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {draft.id ? 'Save changes' : 'Create coupon'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <style>{`
        .cf-input {
          width: 100%;
          padding: 0.55rem 0.75rem;
          border-radius: 0.6rem;
          border: 1px solid rgb(229 231 235);
          background: white;
          color: rgb(17 24 39);
          font-size: 0.875rem;
        }
        .cf-input:focus { outline: none; border-color: rgb(217 119 6); box-shadow: 0 0 0 3px rgba(217,119,6,0.15); }
      `}</style>
    </div>
  );
};

const StatCard = ({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: string }) => (
  <div className="rounded-2xl bg-white border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>{icon}</div>
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-xs font-medium text-gray-600 mb-1 block">{label}</span>
    {children}
  </label>
);

export default AdminCoupons;
