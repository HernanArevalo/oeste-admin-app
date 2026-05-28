declare module 'next-auth' {
  export interface DefaultSession {
    user?: {
      name?: string | null
      email?: string | null
      image?: string | null
    }
    expires: string
  }

  export interface Session extends DefaultSession {}

  export interface User {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }

  export default function NextAuth(config: unknown): {
    handlers: { GET: any; POST: any }
    auth: (handler?: (request: any) => unknown) => any
    signIn: unknown
    signOut: unknown
  }
}

declare module 'next-auth/providers/google' {
  export default function Google(config?: unknown): unknown
}

declare module 'next-auth/react' {
  export function signIn(provider?: string, options?: Record<string, unknown>): Promise<unknown>
  export function signOut(options?: Record<string, unknown>): Promise<unknown>
}

declare module 'next-auth/jwt' {
  export interface JWT {
    name?: string | null
    email?: string | null
    picture?: string | null
  }
}
