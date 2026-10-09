import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, ShieldCheck, UserMinus, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { describeError } from '@/lib/errorMessage';
import { PERMISSIONS, STAFF_ROLES, staffRoleLabel, type PermissionKey, type StaffRole } from '@/lib/permissions';
import {
  createTeamMember,
  removeTeamAccess,
  sendTeamPasswordReset,
  subscribeTeam,
  updateTeamMember,
  type TeamMember,
} from '@/services/teamService';

interface Draft {
  uid?: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  staffRole: StaffRole;
  permissions: PermissionKey[];
}

const blank = (): Draft => ({ name: '', email: '', password: '', phone: '', staffRole: 'staff', permissions: ['dealerChats'] });

const permLabel = (k: PermissionKey) => PERMISSIONS.find((p) => p.key === k)?.label || k;

export default function AdminTeam() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  useEffect(
    () =>
      subscribeTeam(setMembers, (e) => {
        toast.error('Could not load the team', { description: describeError(e) });
        setMembers([]);
      }),
    [],
  );

  const editing = !!draft?.uid;
  const errors = useMemo(() => {
    if (!draft) return {};
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Enter a name.';
    if (!editing) {
      if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) e.email = 'Enter a valid email address.';
      if (draft.password.length < 8) e.password = 'Use at least 8 characters.';
    }
    if (draft.permissions.length === 0) e.permissions = 'Give at least one page.';
    return e;
  }, [draft, editing]);

  const pickRole = (r: StaffRole) => {
    const defaults = STAFF_ROLES.find((x) => x.value === r)?.defaults || [];
    setDraft((d) => (d ? { ...d, staffRole: r, permissions: d.uid ? d.permissions : defaults } : d));
  };
  const togglePerm = (k: PermissionKey) =>
    setDraft((d) =>
      d ? { ...d, permissions: d.permissions.includes(k) ? d.permissions.filter((p) => p !== k) : [...d.permissions, k] } : d,
    );

  const save = async () => {
    if (!draft || Object.keys(errors).length) return;
    setSaving(true);
    try {
      if (draft.uid) {
        await updateTeamMember(draft.uid, {
          username: draft.name,
          phone: draft.phone,
          staffRole: draft.staffRole,
          permissions: draft.permissions,
        });
        toast.success('Changes saved');
      } else {
        await createTeamMember({
          name: draft.name,
          email: draft.email,
          password: draft.password,
          phone: draft.phone,
          staffRole: draft.staffRole,
          permissions: draft.permissions,
        });
        toast.success('Login created', {
          description: `${draft.name.trim()} can now sign in at /admin with ${draft.email.trim()}.`,
        });
      }
      setDraft(null);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      toast.error(editing ? 'Could not save' : 'Could not create the login', {
        description:
          code === 'auth/email-already-in-use'
            ? 'That email already has an account. Use a different email.'
            : code === 'auth/weak-password'
              ? 'That password is too weak.'
              : describeError(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: TeamMember, on: boolean) => {
    try {
      await updateTeamMember(m.uid, { isActive: on });
      toast.success(on ? `${m.username} can sign in again` : `${m.username} is signed out of the panel`);
    } catch (e) {
      toast.error('Could not change that', { description: describeError(e) });
    }
  };

  const resetPassword = async (m: TeamMember) => {
    try {
      await sendTeamPasswordReset(m.email);
      toast.success('Password reset email sent', { description: m.email });
    } catch (e) {
      toast.error('Could not send the email', { description: describeError(e) });
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Team</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Give staff their own login. They see only the pages you pick, never manufacturers' real names or numbers. Everything
            they change is in Activity, and anything they remove goes to the Recycle bin.
          </p>
        </div>
        <Button
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => {
            setShowPassword(false);
            setDraft(blank());
          }}
        >
          <Plus className="h-4 w-4" /> Add team member
        </Button>
      </div>

      {members === null ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center">
          <UsersRound className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 font-medium text-gray-900 dark:text-white">No team logins yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add your first staff member or website manager.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => (
            <li
              key={m.uid}
              className="rounded-2xl border border-[#F5EFE6] dark:border-gray-800 bg-white dark:bg-gray-900 p-4 md:p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold">
                  {m.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{m.username}</p>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                      {staffRoleLabel(m.staffRole)}
                    </span>
                    {!m.isActive && (
                      <span className="rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">Switched off</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.permissions.length === 0 ? (
                      <span className="text-xs text-gray-500">No pages</span>
                    ) : (
                      m.permissions.map((k) => (
                        <span key={k} className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-300">
                          {permLabel(k)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={m.isActive} onCheckedChange={(v) => toggleActive(m, v)} aria-label={`${m.username} can sign in`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-6">{m.isActive ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setDraft({ uid: m.uid, name: m.username, email: m.email, password: '', phone: m.phone || '', staffRole: m.staffRole, permissions: m.permissions })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit pages
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => resetPassword(m)}>
                  <KeyRound className="h-3.5 w-3.5" /> Send password reset
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setRemoving(m)}>
                  <UserMinus className="h-3.5 w-3.5" /> Remove from team
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${draft?.name || 'team member'}` : 'Add team member'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Change their role and the pages they can open.' : 'They sign in at /admin with this email and password.'}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tm-name">Name</Label>
                  <Input id="tm-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="tm-phone">Phone (optional)</Label>
                  <Input id="tm-phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </div>
                {!editing && (
                  <>
                    <div>
                      <Label htmlFor="tm-email">Email</Label>
                      <Input id="tm-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} autoComplete="off" />
                      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                    </div>
                    <div>
                      <Label htmlFor="tm-pass">Password</Label>
                      <div className="relative">
                        <Input
                          id="tm-pass"
                          type={showPassword ? 'text' : 'password'}
                          value={draft.password}
                          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                          autoComplete="new-password"
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-gray-500"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                    </div>
                  </>
                )}
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-gray-900 dark:text-white mb-2">Role</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STAFF_ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      aria-pressed={draft.staffRole === r.value}
                      onClick={() => pickRole(r.value)}
                      className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        draft.staffRole === r.value
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{r.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.hint}</p>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-gray-900 dark:text-white">Pages they can open</legend>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Team, Activity, Recycle bin, Manufacturers and Settings are always yours only.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {PERMISSIONS.map((p) => (
                    <label
                      key={p.key}
                      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Checkbox checked={draft.permissions.includes(p.key)} onCheckedChange={() => togglePerm(p.key)} className="mt-0.5" />
                      <span>
                        <span className="block text-sm text-gray-900 dark:text-white">{p.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{p.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.permissions && <p className="mt-1 text-xs text-red-600">{errors.permissions}</p>}
              </fieldset>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || Object.keys(errors).length > 0} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {editing ? 'Save changes' : 'Create login'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.username} from the team?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose every admin page straight away. Their sign-in stays as an ordinary customer account. Their past activity stays in the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!removing) return;
                try {
                  await removeTeamAccess(removing.uid);
                  toast.success(`${removing.username} removed from the team`);
                } catch (e) {
                  toast.error('Could not remove', { description: describeError(e) });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
