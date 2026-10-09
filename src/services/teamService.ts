import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db, secondaryAuth } from '@/config/firebase';
import { cleanPermissions, type PermissionKey, type StaffRole } from '@/lib/permissions';

export interface TeamMember {
  uid: string;
  username: string;
  email: string;
  phone?: string;
  staffRole: StaffRole;
  permissions: PermissionKey[];
  isActive: boolean;
  createdAt?: Date | null;
}

const toMember = (id: string, d: Record<string, any>): TeamMember => ({
  uid: id,
  username: d.username || d.name || d.email || 'Team member',
  email: d.email || '',
  phone: d.phone || '',
  staffRole: d.staffRole === 'website_manager' ? 'website_manager' : 'staff',
  permissions: cleanPermissions(d.permissions),
  isActive: d.isActive !== false,
  createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : null,
});

export function subscribeTeam(cb: (members: TeamMember[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    query(collection(db, 'users'), where('role', '==', 'staff')),
    (snap) => cb(snap.docs.map((d) => toMember(d.id, d.data())).sort((a, b) => a.username.localeCompare(b.username))),
    (e) => onError?.(e),
  );
}

/**
 * Create a team login. Uses the secondary Auth instance so the owner stays
 * signed in (the same approach as delivery partners).
 */
export async function createTeamMember(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  staffRole: StaffRole;
  permissions: PermissionKey[];
}): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password);
    await updateProfile(cred.user, { displayName: input.name.trim() }).catch(() => {});
    const uid = cred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: input.email.trim(),
      username: input.name.trim(),
      phone: input.phone?.trim() || '',
      role: 'staff',
      staffRole: input.staffRole,
      permissions: cleanPermissions(input.permissions),
      isActive: true,
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
}

export async function updateTeamMember(
  uid: string,
  patch: Partial<Pick<TeamMember, 'username' | 'phone' | 'staffRole' | 'permissions' | 'isActive'>>,
): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.username !== undefined) data.username = patch.username.trim();
  if (patch.phone !== undefined) data.phone = patch.phone.trim();
  if (patch.staffRole !== undefined) data.staffRole = patch.staffRole;
  if (patch.permissions !== undefined) data.permissions = cleanPermissions(patch.permissions);
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  await updateDoc(doc(db, 'users', uid), data);
}

/**
 * Take away team access. The sign-in itself can only be deleted with the
 * Firebase Admin SDK, so the account becomes an ordinary customer login with
 * no admin pages; switching it off first signs it out of the panel at once.
 */
export async function removeTeamAccess(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    role: 'user',
    permissions: [],
    isActive: false,
    staffRole: null,
    updatedAt: serverTimestamp(),
  });
}

export function sendTeamPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}
