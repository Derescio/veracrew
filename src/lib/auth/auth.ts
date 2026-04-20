import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import type { PlatformRole } from "@/lib/auth/types";

// To add magic-link (email) sign-in in a future phase, add:
//   import Resend from "next-auth/providers/resend"
//   ...providers: [ Resend({ from: env.EMAIL_FROM }), ... ]
// and ensure a VerificationToken model is present in the schema (already exists).

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT strategy keeps sessions stateless; PrismaAdapter is used only for
  // user/account creation and OAuth account linking.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/sign-in",
  },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Guard: tombstoned users must not be able to authenticate.
        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email as string,
            deletedAt: null,
          },
          select: { id: true, email: true, name: true, image: true },
        });

        if (!user) return null;

        // Password hash is stored in Account.access_token for credentials provider.
        const account = await prisma.account.findFirst({
          where: { userId: user.id, provider: "credentials" },
          select: { access_token: true },
        });

        if (!account?.access_token) return null;

        const valid = await verifyPassword(
          account.access_token,
          credentials.password as string
        );
        if (!valid) return null;

        return user;
      },
    }),
  ],
  callbacks: {
    // Extra guard for OAuth providers: block tombstoned users even if the
    // adapter resolves them by email.
    async signIn({ user }) {
      if (!user.id) return false;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { deletedAt: true },
      });
      return !dbUser?.deletedAt;
    },

    async jwt({ token, user }) {
      if (user?.id) {
        // Fresh sign-in: resolve default org (oldest ACTIVE membership by createdAt).
        token.userId = user.id;

        const membership = await prisma.membership.findFirst({
          where: { userId: user.id, status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true, organizationId: true, role: true },
        });

        if (membership) {
          token.organizationId = membership.organizationId;
          token.role = membership.role as PlatformRole;
          token.membershipId = membership.id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Fix #18: use null-coalescing so users without memberships get null rather than
      // undefined bleeding through the `as string` lie. requireOrgContext() validates these.
      session.user.id = token.userId as string;
      session.organizationId = (token.organizationId ?? null) as string | null;
      session.role = (token.role ?? null) as PlatformRole | null;
      session.membershipId = (token.membershipId ?? null) as string | null;
      return session;
    },
  },
});
