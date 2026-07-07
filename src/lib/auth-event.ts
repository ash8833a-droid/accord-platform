// Pure decision function for auth state change events. Extracted so we can
// unit-test that browser tab switches (which trigger TOKEN_REFRESHED and
// INITIAL_SESSION events) do NOT cause a sudden logout / access reset.

export type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED";

export type AuthAction = "ignore" | "load-access" | "clear-access";

/**
 * Given the current known user id, the incoming event, and the new user id
 * from the session, decide what the AuthProvider should do.
 *
 * Rules:
 * - TOKEN_REFRESHED / USER_UPDATED never trigger access reload — they fire
 *   automatically on tab focus and would otherwise cause a transient
 *   "not approved" flash and redirect to /pending.
 * - Access is (re)loaded only when the user identity actually changes.
 * - Access is cleared only on a real sign-out (was signed in, now no user).
 */
export function decideAuthAction(
  currentUserId: string | null,
  event: AuthEvent,
  newUserId: string | null,
): AuthAction {
  if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return "ignore";
  if (newUserId && newUserId !== currentUserId) return "load-access";
  if (!newUserId && currentUserId) return "clear-access";
  return "ignore";
}