import { AppSidebar } from '@/components/app-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pt-14 lg:pt-0 lg:pl-56 min-h-full h-vh">
        <div className="p-2 min-h-full">{children}</div>
      </main>
    </div>
  )
}
