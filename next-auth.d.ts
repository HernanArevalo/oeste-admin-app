import type { DefaultSession } from 'next-auth'

import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      is_active: boolean
      image_url: string | null
    } & DefaultSession['user']
  }

  interface User {
    role?: string
    is_active?: boolean
    image_url?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    is_active?: boolean
    image_url?: string | null
  }
}
