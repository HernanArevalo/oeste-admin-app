'use client'

import { memo, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  CreditCard,
  PackageSearch,
  Sparkles,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Channel, Product, Sale, SaleItem, SaleStatus, channelLabels, statusLabels } from '@/interfaces'
import { formatPrice } from '@/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer } from '@/components/ui/chart'

// --- Tipos con soporte para Variantes ---
type ProductItem = Product & {
  category?: { id: string; name: string } | null
  variant?: string | null
}

type StatsSaleItem = SaleItem & {
  variant?: string | null
  product?: ProductItem | null
}

type StatsSale = Sale & { items: StatsSaleItem[] }

// Tipo para el ítem aplanado que incluye la referencia a la venta
type FlatSaleItem = StatsSaleItem & { sale: StatsSale }

type Insight = { title: string; description: string; severity: 'info' | 'success' | 'warning' }
type Filters = {
  range: string
  channel: Channel | 'all'
  payment: string
  status: SaleStatus | 'all'
  category: string
  product: string
  lowStock: number
}

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

// --- Helpers de Fecha y Cálculo ---
const iso = (date: Date) => date.toISOString()
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const rangeStart = (range: string) => addDays(startOfDay(new Date()), -(Number(range) || 30) + 1)
const dayKey = (date: string | Date) => new Date(date).toISOString().slice(0, 10)
const monthKey = (date: string | Date) => new Date(date).toISOString().slice(0, 7)

function pct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / previous) * 100
}

function sum<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((acc, row) => acc + pick(row), 0)
}

function group<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const k = key(row)
    ;(acc[k] ||= []).push(row)
    return acc
  }, {})
}

// --- Fetcher Optimizado ---
const supabase = createClient()

async function fetchStats(filters: Filters) {
  const from = rangeStart(filters.range)

  let salesQuery = supabase
    .from('sales')
    .select('*, payment_method:payment_methods(*), items:sale_items(*, product:products(*, category:categories(*)))')
    .gte('created_at', iso(from))
    .order('created_at', { ascending: true })

  if (filters.channel !== 'all') salesQuery = salesQuery.eq('point_of_sale', filters.channel)
  if (filters.payment !== 'all') salesQuery = salesQuery.eq('payment_method_id', filters.payment)
  if (filters.status !== 'all') salesQuery = salesQuery.eq('status', filters.status)

  const [
    { data: sales, error: salesError },
    { data: products, error: productsError },
    { data: paymentMethods },
    { data: categories }
  ] = await Promise.all([
    salesQuery,
    supabase.from('products').select('*, category:categories(*)').order('name'),
    supabase.from('payment_methods').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
  ])

  if (salesError) throw salesError
  if (productsError) throw productsError

  const filteredSales = (sales as unknown as StatsSale[])
    .map((sale) => ({
      ...sale,
      items: sale.items.filter((item) => {
        if (filters.product !== 'all' && item.product_id !== filters.product) return false
        if (filters.category !== 'all' && item.product?.category_id !== filters.category) return false
        return true
      }),
    }))
    .filter((sale) => sale.items.length > 0 || (filters.product === 'all' && filters.category === 'all'))

  return {
    sales: filteredSales,
    products: (products as ProductItem[]) || [],
    paymentMethods: paymentMethods || [],
    categories: categories || []
  }
}

// --- Componentes UI Reutilizables & Memoizados ---
const KpiCard = memo(function KpiCard({ title, value, compare, icon: Icon }: { title: string; value: string; compare?: number; icon: typeof BarChart3 }) {
  const up = (compare || 0) >= 0
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-xs font-medium">{title}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {compare !== undefined && (
          <p className={`text-xs ${up ? 'text-emerald-500' : 'text-red-500'} mt-1 flex items-center gap-0.5`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(compare).toFixed(1)}% vs. período anterior
          </p>
        )}
      </CardContent>
    </Card>
  )
})

const ChartBox = memo(function ChartBox({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0 sm:p-6">{children}</CardContent>
    </Card>
  )
})

function InsightCard({ insight }: { insight: Insight }) {
  const tone =
    insight.severity === 'warning'
      ? 'border-amber-500/40 bg-amber-500/10'
      : insight.severity === 'success'
      ? 'border-emerald-500/40 bg-emerald-500/10'
      : 'border-blue-500/40 bg-blue-500/10'

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="text-sm">{insight.title}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{insight.description}</p>
    </div>
  )
}

function ForecastCard({ title, value, confidence, explanation }: { title: string; value: string; confidence: string; explanation: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Confianza: {confidence}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl sm:text-3xl font-bold">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{explanation}</p>
      </CardContent>
    </Card>
  )
}

// --- Ranking con Variante ---
type RankingRow = {
  name: string
  variant?: string | null
  col2: React.ReactNode
  col3: React.ReactNode
}

function Ranking({ title, rows }: { title: string; rows: RankingRow[] }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto / Modelo</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead className="text-right">Métrica</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-xs sm:text-sm">{i + 1}. {row.name}</TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    {row.variant ? <Badge variant="outline">{row.variant}</Badge> : <span className="text-muted-foreground text-xs">-</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs sm:text-sm">{row.col2}</TableCell>
                  <TableCell className="text-right text-xs sm:text-sm">{row.col3}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">Sin datos</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function InventoryTable({ title, products }: { title: string; products: ProductItem[] }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{products.length} productos</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length ? (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs sm:text-sm font-medium">{p.name}</TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    {p.variant ? <Badge variant="outline">{p.variant}</Badge> : <span className="text-muted-foreground text-xs">-</span>}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">{p.category?.name || 'Sin categoría'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.stock <= 0 ? 'destructive' : 'secondary'}>{p.stock}</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">Sin alertas</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// --- Componente Principal ---
export default function StatsPage() {
  const [filters, setFilters] = useState<Filters>({
    range: '30',
    channel: 'all',
    payment: 'all',
    status: 'all',
    category: 'all',
    product: 'all',
    lowStock: 5
  })

  // SWR Key fija mediante stringify para evitar requests redundantes
  const swrKey = useMemo(() => ['stats', JSON.stringify(filters)], [filters])
  const { data, error, isLoading } = useSWR(swrKey, () => fetchStats(filters))

  const stats = useMemo(() => {
    if (!data) return null

    const today = new Date()
    const allSales = data.sales || []
    const currentStart = rangeStart(filters.range)
    const sales = allSales.filter((sale) => new Date(sale.created_at) >= currentStart)
    const products = data.products || []

    // Tipado explícito de la constante aplanada
    const items: FlatSaleItem[] = sales.flatMap((sale) =>
      sale.items.map((item) => ({ ...item, sale }))
    )

    const total = sum(sales, (s) => s.total)
    const count = sales.length
    const qty = sum(items, (i) => i.quantity)
    const paidPct = count ? (sales.filter((s) => s.is_paid).length / count) * 100 : 0
    const days = Number(filters.range) || 30
    const previousStart = addDays(currentStart, -days)

    const previousSales = allSales.filter(
      (s) => new Date(s.created_at) < currentStart && new Date(s.created_at) >= previousStart
    )

    const byDay = Object.entries(group(sales, (s) => dayKey(s.created_at))).map(([date, rows]) => ({
      date,
      ventas: rows.length,
      facturacion: sum(rows, (s) => s.total)
    }))

    const byMonth = Object.entries(group(sales, (s) => monthKey(s.created_at))).map(([month, rows]) => ({
      month,
      ventas: rows.length,
      facturacion: sum(rows, (s) => s.total),
      ticket: rows.length ? sum(rows, (s) => s.total) / rows.length : 0
    }))

    const payment = Object.entries(group(sales, (s) => s.payment_method?.name || 'Sin método')).map(([name, rows]) => ({
      name,
      ventas: rows.length,
      facturacion: sum(rows, (s) => s.total),
      pct: count ? (rows.length / count) * 100 : 0
    }))

    const channels = Object.entries(group(sales, (s) => channelLabels[s.point_of_sale] || s.point_of_sale)).map(([name, rows]) => ({
      name,
      value: rows.length,
      facturacion: sum(rows, (s) => s.total)
    }))

    const statuses = Object.entries(group(sales, (s) => statusLabels[s.status] || s.status)).map(([name, rows]) => ({
      name,
      value: rows.length
    }))

    // Agrupación por producto Y variante
    const productRows = Object.entries(
      group(items, (i) => `${i.product_id}_${i.variant || i.product?.variant || 'default'}`)
    ).map(([_, rows]) => {
      const prod = rows[0].product
      const variant = rows[0].variant || prod?.variant || null
      return {
        id: rows[0].product_id,
        name: prod?.name || 'Producto eliminado',
        variant,
        qty: sum(rows, (i) => i.quantity),
        revenue: sum(rows, (i) => i.total),
        stock: prod?.stock || 0,
        category: prod?.category?.name || 'Sin categoría'
      }
    })

    const categories = Object.entries(group(items, (i) => i.product?.category?.name || 'Sin categoría'))
      .map(([name, rows]) => ({ name, qty: sum(rows, (i) => i.quantity), revenue: sum(rows, (i) => i.total) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)

    const dailyAvg = total / Math.max(days, 1)
    const monthProjection = dailyAvg * new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const topPayment = [...payment].sort((a, b) => b.facturacion - a.facturacion)[0]
    const stagnant = products.filter((p) => !productRows.some((r) => r.id === p.id))

    const previousTotal = sum(previousSales, (s) => s.total)
    const insights: Insight[] = [
      { title: 'Proyección mensual', description: `Ritmo proyectado de cierre: ${formatPrice(monthProjection)}.`, severity: 'info' },
      {
        title: total >= previousTotal ? 'Tendencia positiva' : 'Caída detectada',
        description: `Facturación varió ${pct(total, previousTotal).toFixed(1)}% vs. período previo.`,
        severity: total >= previousTotal ? 'success' : 'warning'
      },
      ...(topPayment && topPayment.pct > 60
        ? [{ title: 'Concentración en pago', description: `${topPayment.name} concentra el ${topPayment.pct.toFixed(1)}% de ventas.`, severity: 'warning' as const }]
        : []),
      ...(stagnant.length ? [{ title: 'Sin movimiento', description: `${stagnant.length} productos sin ventas registradas.`, severity: 'warning' as const }] : [])
    ]

    return {
      total,
      monthTotal: sum(sales.filter((s) => monthKey(s.created_at) === monthKey(today)), (s) => s.total),
      todayTotal: sum(sales.filter((s) => dayKey(s.created_at) === dayKey(today)), (s) => s.total),
      count,
      qty,
      paidPct,
      ticket: count ? total / count : 0,
      discount: sum(sales, (s) => s.discount),
      pending: sales.filter((s) => !s.is_paid).length,
      noStock: products.filter((p) => p.stock <= 0),
      lowStock: products.filter((p) => p.stock > 0 && p.stock <= filters.lowStock),
      compareTotal: pct(total, previousTotal),
      compareCount: pct(count, previousSales.length),
      byDay,
      byMonth,
      payment,
      channels,
      statuses,
      productRows,
      categories,
      insights,
      forecasts: { monthProjection, next7: dailyAvg * 7, next30: dailyAvg * 30, confidence: sales.length > 20 ? 'Media' : 'Baja' }
    }
  }, [data, filters])

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error al cargar analítica</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-400 mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analítica de Ventas & Gafas</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Métricas, tendencias, variantes e inventario clave.</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros globales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-row gap-2 flex-wrap">
          <Select value={filters.range} onValueChange={(range) => setFilters((f) => ({ ...f, range }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['365', 'Último año']].map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.channel} onValueChange={(channel) => setFilters((f) => ({ ...f, channel: channel as Filters['channel'] }))}>
            <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los canales</SelectItem>
              {Object.entries(channelLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.payment} onValueChange={(payment) => setFilters((f) => ({ ...f, payment }))}>
            <SelectTrigger><SelectValue placeholder="Pago" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pagos</SelectItem>
              {data?.paymentMethods.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(status) => setFilters((f) => ({ ...f, status: status as Filters['status'] }))}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(statusLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.category} onValueChange={(category) => setFilters((f) => ({ ...f, category }))}>
            <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {data?.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.product} onValueChange={(product) => setFilters((f) => ({ ...f, product }))}>
            <SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los productos</SelectItem>
              {data?.products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Estado Carga / Vacío */}
      {isLoading || !stats ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard title="Facturación total" value={formatPrice(stats.total)} compare={stats.compareTotal} icon={TrendingUp} />
            <KpiCard title="Mes actual" value={formatPrice(stats.monthTotal)} icon={CalendarDays} />
            <KpiCard title="Facturación de hoy" value={formatPrice(stats.todayTotal)} icon={CalendarDays} />
            <KpiCard title="Ventas totales" value={`${stats.count}`} compare={stats.compareCount} icon={BarChart3} />
            <KpiCard title="Unidades vendidas" value={`${stats.qty}`} icon={Boxes} />
            <KpiCard title="Ticket promedio" value={formatPrice(stats.ticket)} icon={CreditCard} />
            <KpiCard title="Descuentos" value={formatPrice(stats.discount)} icon={TrendingDown} />
            <KpiCard title="Ventas pagadas" value={`${stats.paidPct.toFixed(1)}%`} icon={Sparkles} />
            <KpiCard title="Pendientes pago" value={`${stats.pending}`} icon={AlertTriangle} />
            <KpiCard title="Stock crítico / sin stock" value={`${stats.lowStock.length} / ${stats.noStock.length}`} icon={PackageSearch} />
          </section>

          {stats.count === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay datos registrados para los filtros seleccionados.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Gráficos */}
              <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <ChartBox title="Ventas por día">
                  <ChartContainer config={{ ventas: { color: '#2563eb' } }} className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.byDay}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line dataKey="ventas" stroke="#2563eb" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>

                <ChartBox title="Facturación por día">
                  <ChartContainer config={{ facturacion: { color: '#16a34a' } }} className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.byDay}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(v) => formatPrice(Number(v))} />
                        <Line dataKey="facturacion" stroke="#16a34a" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>

                <ChartBox title="Ventas por mes">
                  <ChartContainer config={{ ventas: { color: '#7c3aed' } }} className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.byMonth}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="ventas" fill="#7c3aed" radius={6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>

                <ChartBox title="Facturación y ticket promedio por mes">
                  <ChartContainer config={{ facturacion: { color: '#f59e0b' }, ticket: { color: '#dc2626' } }} className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={stats.byMonth}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(v) => formatPrice(Number(v))} />
                        <Bar dataKey="facturacion" fill="#f59e0b" radius={6} />
                        <Line dataKey="ticket" stroke="#dc2626" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>
              </section>

              {/* Distribuciones */}
              <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <ChartBox title="Métodos de pago">
                  <ChartContainer config={{ value: { color: '#2563eb' } }} className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.payment}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(v) => formatPrice(Number(v))} />
                        <Bar dataKey="facturacion" radius={6}>
                          {stats.payment.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>

                <ChartBox title="Canales de venta">
                  <ChartContainer config={{ value: { color: '#16a34a' } }} className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Pie data={stats.channels} dataKey="value" nameKey="name" outerRadius={80} label>
                          {stats.channels.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>

                <ChartBox title="Estados de venta">
                  <ChartContainer config={{ value: { color: '#f59e0b' } }} className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Pie data={stats.statuses} dataKey="value" nameKey="name" outerRadius={80} label>
                          {stats.statuses.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartBox>
              </section>

              {/* Rankings con variantes */}
              <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Ranking
                  title="Categorías más vendidas"
                  rows={stats.categories.map((c) => ({
                    name: c.name,
                    variant: null,
                    col2: `${c.qty} u.`,
                    col3: formatPrice(c.revenue)
                  }))}
                />
                <Ranking
                  title="Top productos / modelos vendidos"
                  rows={[...stats.productRows]
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 10)
                    .map((p) => ({
                      name: p.name,
                      variant: p.variant,
                      col2: `${p.qty} u.`,
                      col3: formatPrice(p.revenue)
                    }))}
                />
                <Ranking
                  title="Mayor facturación por variante"
                  rows={[...stats.productRows]
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10)
                    .map((p) => ({
                      name: p.name,
                      variant: p.variant,
                      col2: `${p.qty} u.`,
                      col3: formatPrice(p.revenue)
                    }))}
                />
              </section>
            </>
          )}

          {/* Insights */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Insights automáticos</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {stats.insights.map((insight) => (
                <InsightCard key={insight.title} insight={insight} />
              ))}
            </div>
          </section>

          {/* Proyecciones */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Forecasts & Proyecciones</h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <ForecastCard title="Proyección de Cierre" value={formatPrice(stats.forecasts.monthProjection)} confidence={stats.forecasts.confidence} explanation="Promedio diario actual extendido a los días totales del mes actual." />
              <ForecastCard title="Próximos 7 Días" value={formatPrice(stats.forecasts.next7)} confidence={stats.forecasts.confidence} explanation="Estimación lineal a 7 días según el promedio diario del período actual." />
              <ForecastCard title="Próximos 30 Días" value={formatPrice(stats.forecasts.next30)} confidence={stats.forecasts.confidence} explanation="Proyección estimada simple a 30 días basándose en la tendencia lineal actual." />
            </div>
          </section>

          {/* Inventario & Estado */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Inventario & Variantes</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Stock crítico &le;</span>
                <Input
                  className="w-20 h-8 text-xs"
                  type="number"
                  value={filters.lowStock}
                  onChange={(e) => setFilters((f) => ({ ...f, lowStock: Math.max(0, Number(e.target.value)) }))}
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-1">
              <InventoryTable title="Productos sin stock" products={stats.noStock} />
              <Ranking
                title="Variantes menos vendidas"
                rows={[...stats.productRows]
                  .sort((a, b) => a.qty - b.qty)
                  .slice(0, 10)
                  .map((p) => ({
                    name: p.name,
                    variant: p.variant,
                    col2: `${p.qty} u.`,
                    col3: <Badge key={p.id} variant="outline">Stock: {p.stock}</Badge>
                  }))}
              />
              <InventoryTable
                title="Sin ventas en el período"
                products={(data?.products || [])
                  .filter((p) => !stats.productRows.some((r) => r.id === p.id))
                  .slice(0, 10)}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}