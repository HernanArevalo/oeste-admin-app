'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  return (
    <Button
      type="button"
      className="cursor-pointer w-full bg-white p-1 text-xs font-bold text-zinc-950 hover:bg-zinc-200"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Cerrar Sesión
    </Button>
  )
}
