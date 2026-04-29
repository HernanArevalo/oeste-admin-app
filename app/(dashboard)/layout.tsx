import { AppSidebar } from '@/components/app-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pt-14 lg:pt-0 lg:pl-64">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  )
}
