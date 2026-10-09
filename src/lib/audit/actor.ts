/**
 * Who is acting, for the activity log and recycle bin.
 *
 * Set by AuthContext when the signed-in profile is the owner or a team member,
 * cleared otherwise. Kept free of Firestore imports so the audited Firestore
 * module can read it without an import cycle.
 */
export interface AuditActor {
  uid: string;
  name: string;
  /** 'admin' for the owner, otherwise the team member's staffRole. */
  role: string;
}

let actor: AuditActor | null = null;

export function setAuditActor(next: AuditActor | null) {
  actor = next;
}

/**
 * The actor, but only while they work inside the admin panel: the owner adding
 * something to their own cart on the storefront is not an admin action.
 */
export function currentAuditActor(): AuditActor | null {
  if (!actor) return null;
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/admin')) return null;
  return actor;
}
