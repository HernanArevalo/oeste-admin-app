'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, ListOrdered, Tags, CreditCard, Upload, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useState } from 'react'

const navigation = [
  { name: 'Nueva Venta', href: '/', icon: ShoppingCart },
  { name: 'Ventas', href: '/ventas', icon: ListOrdered },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Categorias', href: '/categorias', icon: Tags },
  { name: 'Metodos de Pago', href: '/metodos-pago', icon: CreditCard },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-2xl font-bold tracking-tight text-sidebar-foreground">oeste</span>
          <span className="text-[10px] text-muted-foreground align-super">®</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <Link href="/subir-comprobante" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
          <Upload className="h-5 w-5" />
          Link Comprobante
        </Link>
      </div>
    </>
  )

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-border bg-sidebar lg:flex">{sidebarContent}</aside>

      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Link href="/" className="text-lg font-semibold">oeste</Link>
        <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <div className="flex h-full flex-col bg-sidebar">{sidebarContent}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}
