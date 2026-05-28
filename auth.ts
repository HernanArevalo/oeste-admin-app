import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@/lib/types'

async function syncGoogleUser(profile: {
  email?: string | null
  name?: string | null
  image?: string | null
}) {
  if (!profile.email) {
    throw new Error('Google account did not return an email address')
  }

  const supabase = createAdminClient()
  const normalizedEmail = profile.email.toLowerCase()
  const userPayload = {
    email: normalizedEmail,
    name: profile.name ?? normalizedEmail,
    image_url: profile.image ?? null,
  }

  const { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle<User>()

  if (findError) {
    throw findError
  }

  if (!existingUser) {
    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert({
        ...userPayload,
        role: 'USER',
      })
      .select('*')
      .single<User>()

    if (createError) {
      throw createError
    }

    return createdUser
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update(userPayload)
    .eq('id', existingUser.id)
    .select('*')
    .single<User>()

  if (updateError) {
    throw updateError
  }

  return updatedUser
}

async function getUserByEmail(email?: string | null) {
  if (!email) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle<User>()

  if (error) {
    throw error
  }

  return data
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({
      user,
    }: {
      user: { email?: string | null; name?: string | null; image?: string | null }
    }) {
      await syncGoogleUser({
        email: user.email,
        name: user.name,
        image: user.image,
      })

      return true
    },
    async jwt({
      token,
      user,
    }: {
      token: import('next-auth/jwt').JWT
      user?: { email?: string | null }
    }) {
      const email = user?.email ?? token.email
      const dbUser = await getUserByEmail(email)

      if (dbUser) {
        token.id = dbUser.id
        token.name = dbUser.name
        token.email = dbUser.email
        token.picture = dbUser.image_url
        token.role = dbUser.role
        token.is_active = dbUser.is_active
        token.image_url = dbUser.image_url
      }

      return token
    },
    async session({
      session,
      token,
    }: {
      session: import('next-auth').Session
      token: import('next-auth/jwt').JWT
    }) {
      session.user.id = token.id ?? ''
      session.user.name = token.name ?? session.user.name
      session.user.email = token.email ?? session.user.email
      session.user.image = token.picture ?? session.user.image
      session.user.role = token.role ?? 'USER'
      session.user.is_active = token.is_active ?? false
      session.user.image_url = token.image_url ?? null

      return session
    },
  },
})
