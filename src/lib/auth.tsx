import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "committee" | "delegate" | "quality";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  committeeId: string | null;
  approved: boolean;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    phone: string,
    password: string,
    fullName: string,
    familyBranch: string,
    requestedCommitteeId?: string,
    notes?: string,
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (r: Role) => boolean;
  refreshAccess: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

// Convert "05xxxxxxxx" → pseudo-email for Supabase email auth
export const phoneToEmail = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return `${digits}@phone.local`;
};
export const emailToPhone = (email?: string | null) => {
  if (!email) return "";
  return email.replace(/@phone\.local$/i, "");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [committeeId, setCommitteeId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAccess = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, committee_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    const rs = (data ?? []).map((r) => r.role as Role);
    setRoles(rs);
    const firstCommittee = (data ?? []).find((r) => r.committee_id)?.committee_id ?? null;
    setCommitteeId(firstCommittee);
    setApproved(rs.length > 0);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadAccess(s.user.id), 0);
      } else {
        setRoles([]);
        setCommitteeId(null);
        setApproved(false);
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        // If the stored refresh token is invalid/expired, clear it so the user can log in fresh
        if (error && /refresh token/i.test(error.message)) {
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          if (data.session?.user) loadAccess(data.session.user.id);
        }
      })
      .catch(async () => {
        await supabase.auth.signOut().catch(() => {});
      })
      .finally(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, [loadAccess]);

  const signIn = async (phone: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    if (!error) {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u.user?.id) {
          await supabase.from("user_activity_log").insert({
            user_id: u.user.id,
            event_type: "login",
            event_label: "تسجيل دخول",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          });
        }
      } catch { /* ignore */ }
    }
    return { error: error?.message };
  };

  const signUp = async (
    phone: string,
    password: string,
    fullName: string,
    familyBranch: string,
    requestedCommitteeId?: string,
    notes?: string,
  ) => {
    const email = phoneToEmail(phone);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, phone, family_branch: familyBranch },
      },
    });
    if (error) {
      const msg = error.message || "";
      if (/already registered|already been registered|user already exists/i.test(msg)) {
        return { error: "رقم الجوال مسجّل مسبقاً. يرجى تسجيل الدخول أو استخدام رقم آخر." };
      }
      if (/password/i.test(msg) && /(short|weak|6)/i.test(msg)) {
        return { error: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)." };
      }
      return { error: msg };
    }

    // Sign in immediately (we did NOT enable email confirmation)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) return { error: signInErr.message };

    const uid = data.user?.id;
    if (uid) {
      // Avoid duplicate request if user re-submits
      const { data: existing } = await supabase
        .from("membership_requests")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!existing) {
        const { error: reqErr } = await supabase.from("membership_requests").insert({
          user_id: uid,
          full_name: fullName,
          phone,
          family_branch: familyBranch,
          requested_committee_id: requestedCommitteeId ?? null,
          notes: notes ?? null,
        });
        if (reqErr) return { error: reqErr.message };
      }
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (r: Role) => roles.includes(r);
  const refreshAccess = async () => {
    if (user) await loadAccess(user.id);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles,
        committeeId,
        approved,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        refreshAccess,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
