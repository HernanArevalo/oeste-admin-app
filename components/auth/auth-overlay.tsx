import { LockKeyhole } from 'lucide-react'

export function AuthOverlay({
  message,
  children,
}: {
  message: string
  children?: React.ReactNode
}) {
  return (
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />
      <section className="relative flex w-full max-w-md flex-col items-center rounded-3xl border border-white/10 bg-black/40 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-inner">
          <LockKeyhole className="h-16 w-16" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Acceso restringido</h1>
        <p className="mt-4 text-balance text-base leading-7 text-zinc-300">{message}</p>
        {children ? <div className="mt-8 w-full">{children}</div> : null}
      </section>
    </main>
  )
}
