import { AppSidebar } from '@/components/app-sidebar'
import { auth } from '@/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar user={session?.user} />
      <main className="pt-14 lg:pt-0 lg:pl-56 min-h-full h-vh">
        <div className="p-2 min-h-full">{children}</div>
      </main>
    </div>
  )
}
