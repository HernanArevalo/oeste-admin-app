'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function GoogleLoginButton({ callbackUrl = '/' }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      className="cursor-pointer h-12 w-full rounded-full bg-white font-semibold text-zinc-950 hover:bg-zinc-200"
      onClick={() => signIn('google', { callbackUrl })}
    >
      Iniciar sesión con Google
    </Button>
  )
}
