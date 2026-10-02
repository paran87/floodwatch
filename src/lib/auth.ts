import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { getSupabaseClient } from "./supabase";
import type { UserRole } from "./types";
import { ROLE_PERMISSIONS } from "./constants";

/**
 * Authentication: Google Sign-In via NextAuth.
 *
 * Why Google Sign-In rather than a custom username/password scheme: the
 * backend of record (Apps Script + Sheets) has no secure place to store
 * password hashes, and section 20 of the project spec is explicit that an
 * insecure auth scheme must not be built just to "have something." Google
 * OAuth delegates credential handling entirely to Google and gives us a
 * verified email we can match against a role assignment.
 *
 * Authorization: the verified email is looked up in Supabase's `users`
 * table (role: admin | editor | viewer). An email with no row defaults to
 * `viewer` — never to `admin`. Every mutating Apps Script action re-checks
 * the role server-side (see apps-script/Auth.js); the frontend role check
 * below is for UI affordances only and must never be trusted as the sole
 * gate on a write.
 */

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { role: UserRole };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      return Boolean(user?.email);
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (email) {
        token.role = await lookupRole(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as UserRole) ?? "viewer";
      }
      return session;
    },
  },
});

async function lookupRole(email: string): Promise<UserRole> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("users").select("role").eq("email", email).maybeSingle();
    return (data?.role as UserRole) ?? "viewer";
  } catch {
    // Supabase unreachable or not yet configured: fail closed to the least-privileged role.
    return "viewer";
  }
}

export function canPerform(role: UserRole, action: keyof typeof ROLE_PERMISSIONS["admin"]): boolean {
  return ROLE_PERMISSIONS[role][action];
}
