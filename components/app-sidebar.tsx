'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, ListOrdered, Tags, CreditCard, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Nueva Venta', href: '/', icon: ShoppingCart },
  { name: 'Ventas', href: '/ventas', icon: ListOrdered },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Categorias', href: '/categorias', icon: Tags },
  { name: 'Metodos de Pago', href: '/metodos-pago', icon: CreditCard },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-sidebar-foreground">oeste</span>
          <span className="text-[10px] text-muted-foreground align-super">®</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Upload Receipt Link */}
      <div className="border-t border-sidebar-border p-4">
        <Link
          href="/subir-comprobante"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Upload className="h-5 w-5" />
          Link Comprobante
        </Link>
      </div>
    </aside>
  )
}
