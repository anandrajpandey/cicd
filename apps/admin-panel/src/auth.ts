import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {}
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        // TODO: replace placeholder auth with bcrypt-backed credential verification against the real user store.
        return {
          id: "user_admin",
          email: parsed.data.email,
          role: "Admin"
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  }
});
