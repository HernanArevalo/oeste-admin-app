'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BarChart3, Boxes, CalendarDays, CreditCard, PackageSearch, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
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

type StatsSale = Sale & { items: (SaleItem & { product?: Product & { category?: { id: string; name: string } | null } })[] }
type Insight = { title: string; description: string; severity: 'info' | 'success' | 'warning' }
type Filters = { range: string; channel: Channel | 'all'; payment: string; status: SaleStatus | 'all'; category: string; product: string; lowStock: number }

const supabase = createClient()
const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777']
const today = new Date()
const iso = (date: Date) => date.toISOString()
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const rangeStart = (range: string) => addDays(startOfDay(today), -(Number(range) || 30) + 1)
const dayKey = (date: string | Date) => new Date(date).toISOString().slice(0, 10)
const monthKey = (date: string | Date) => new Date(date).toISOString().slice(0, 7)

async function fetchStats(filters: Filters) {
  const from = rangeStart(filters.range)
  let salesQuery = supabase
    .from('sales')
    .select('*, payment_method:payment_methods(*), items:sale_items(*, product:products(*, category:categories(*)))')
    .gte('created_at', iso(addDays(from, -(Number(filters.range) || 30))))
    .order('created_at', { ascending: true })

  if (filters.channel !== 'all') salesQuery = salesQuery.eq('point_of_sale', filters.channel)
  if (filters.payment !== 'all') salesQuery = salesQuery.eq('payment_method_id', filters.payment)
  if (filters.status !== 'all') salesQuery = salesQuery.eq('status', filters.status)

  const [{ data: sales, error: salesError }, { data: products, error: productsError }, { data: paymentMethods }, { data: categories }] = await Promise.all([
    salesQuery,
    supabase.from('products').select('*, category:categories(*)').order('name'),
    supabase.from('payment_methods').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
  ])
  if (salesError) throw salesError
  if (productsError) throw productsError

  const filteredSales = (sales as StatsSale[]).map((sale) => ({
    ...sale,
    items: sale.items.filter((item) => {
      if (filters.product !== 'all' && item.product_id !== filters.product) return false
      if (filters.category !== 'all' && item.product?.category_id !== filters.category) return false
      return true
    }),
  })).filter((sale) => sale.items.length > 0 || (filters.product === 'all' && filters.category === 'all'))

  return { sales: filteredSales, products: products as Product[], paymentMethods: paymentMethods || [], categories: categories || [] }
}

function pct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / previous) * 100
}
function sum<T>(rows: T[], pick: (row: T) => number) { return rows.reduce((acc, row) => acc + pick(row), 0) }
function group<T>(rows: T[], key: (row: T) => string) { return rows.reduce<Record<string, T[]>>((acc, row) => ((acc[key(row)] ||= []).push(row), acc), {}) }
function KpiCard({ title, value, compare, icon: Icon }: { title: string; value: string; compare?: number; icon: typeof BarChart3 }) {
  const up = (compare || 0) >= 0
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardDescription>{title}</CardDescription><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div>{compare !== undefined && <p className={up ? 'text-xs text-emerald-500' : 'text-xs text-red-500'}>{up ? '↗' : '↘'} {Math.abs(compare).toFixed(1)}% vs. período anterior</p>}</CardContent></Card>
}
function ChartBox({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>
}
function InsightCard({ insight }: { insight: Insight }) {
  const tone = insight.severity === 'warning' ? 'border-amber-500/40 bg-amber-500/10' : insight.severity === 'success' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-blue-500/40 bg-blue-500/10'
  return <div className={`rounded-xl border p-4 ${tone}`}><div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" />{insight.title}</div><p className="mt-2 text-sm text-muted-foreground">{insight.description}</p></div>
}
function ForecastCard({ title, value, confidence, explanation }: { title: string; value: string; confidence: string; explanation: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Confianza estimada: {confidence}</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{value}</p><p className="mt-2 text-sm text-muted-foreground">{explanation}</p></CardContent></Card>
}

export default function StatsPage() {
  const [filters, setFilters] = useState<Filters>({ range: '30', channel: 'all', payment: 'all', status: 'all', category: 'all', product: 'all', lowStock: 5 })
  const { data, error, isLoading } = useSWR(['stats', filters], () => fetchStats(filters))

  const stats = useMemo(() => {
    const allSales = data?.sales || []
    const currentStart = rangeStart(filters.range)
    const sales = allSales.filter((sale) => new Date(sale.created_at) >= currentStart)
    const products = data?.products || []
    const items = sales.flatMap((sale) => sale.items.map((item) => ({ ...item, sale })))
    const total = sum(sales, (s) => s.total), count = sales.length, qty = sum(items, (i) => i.quantity)
    const paidPct = count ? (sales.filter((s) => s.is_paid).length / count) * 100 : 0
    const days = Number(filters.range) || 30
    const previousStart = addDays(rangeStart(filters.range), -days)
    const previousSales = allSales.filter((s) => new Date(s.created_at) < currentStart && new Date(s.created_at) >= previousStart)
    const byDay = Object.entries(group(sales, (s) => dayKey(s.created_at))).map(([date, rows]) => ({ date, ventas: rows.length, facturacion: sum(rows, (s) => s.total) }))
    const byMonth = Object.entries(group(sales, (s) => monthKey(s.created_at))).map(([month, rows]) => ({ month, ventas: rows.length, facturacion: sum(rows, (s) => s.total), ticket: rows.length ? sum(rows, (s) => s.total) / rows.length : 0 }))
    const payment = Object.entries(group(sales, (s) => s.payment_method?.name || 'Sin método')).map(([name, rows]) => ({ name, ventas: rows.length, facturacion: sum(rows, (s) => s.total), pct: count ? rows.length / count * 100 : 0 }))
    const channels = Object.entries(group(sales, (s) => channelLabels[s.point_of_sale])).map(([name, rows]) => ({ name, value: rows.length, facturacion: sum(rows, (s) => s.total) }))
    const statuses = Object.entries(group(sales, (s) => statusLabels[s.status])).map(([name, rows]) => ({ name, value: rows.length }))
    const productRows = Object.entries(group(items, (i) => i.product_id)).map(([id, rows]) => ({ id, name: rows[0].product?.name || 'Producto eliminado', qty: sum(rows, (i) => i.quantity), revenue: sum(rows, (i) => i.total), stock: rows[0].product?.stock || 0, category: rows[0].product?.category?.name || 'Sin categoría' }))
    const categories = Object.entries(group(items, (i) => i.product?.category?.name || 'Sin categoría')).map(([name, rows]) => ({ name, qty: sum(rows, (i) => i.quantity), revenue: sum(rows, (i) => i.total) })).sort((a,b) => b.qty - a.qty).slice(0, 10)
    const dailyAvg = total / Math.max(days, 1), monthProjection = dailyAvg * new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const topPayment = payment.sort((a,b) => b.facturacion - a.facturacion)[0]
    const stagnant = products.filter((p) => !productRows.some((r) => r.id === p.id))
    const insights: Insight[] = [
      { title: 'Proyección mensual', description: `Si el ritmo actual continúa, el mes cerrará cerca de ${formatPrice(monthProjection)}.`, severity: 'info' },
      { title: total >= sum(previousSales, s => s.total) ? 'Tendencia positiva' : 'Caída detectada', description: `La facturación varía ${pct(total, sum(previousSales, s => s.total)).toFixed(1)}% contra el período anterior.`, severity: total >= sum(previousSales, s => s.total) ? 'success' : 'warning' },
      ...(topPayment && topPayment.pct > 60 ? [{ title: 'Concentración en método de pago', description: `${topPayment.name} concentra ${topPayment.pct.toFixed(1)}% de las ventas.`, severity: 'warning' as const }] : []),
      ...(stagnant.length ? [{ title: 'Productos estancados', description: `${stagnant.length} productos no registran ventas en el rango analizado.`, severity: 'warning' as const }] : []),
    ]
    const monthTotal = sum(sales.filter(s => monthKey(s.created_at) === monthKey(today)), s => s.total)
    const todayTotal = sum(sales.filter(s => dayKey(s.created_at) === dayKey(today)), s => s.total)
    return { total, monthTotal, todayTotal, count, qty, paidPct, ticket: count ? total / count : 0, discount: sum(sales, s => s.discount), pending: sales.filter(s => !s.is_paid).length, noStock: products.filter(p => p.stock <= 0), lowStock: products.filter(p => p.stock > 0 && p.stock <= filters.lowStock), compareTotal: pct(total, sum(previousSales, s => s.total)), compareCount: pct(count, previousSales.length), byDay, byMonth, payment, channels, statuses, productRows, categories, insights, forecasts: { monthProjection, next7: dailyAvg * 7, next30: dailyAvg * 30, confidence: sales.length > 20 ? 'Media' : 'Baja' } }
  }, [data, filters])

  if (error) return <div className="p-6"><Card><CardHeader><CardTitle>Error al cargar analítica</CardTitle><CardDescription>{error.message}</CardDescription></CardHeader></Card></div>

  return <div className="space-y-6 p-4 md:p-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Analítica</h1><p className="text-muted-foreground">Métricas, tendencias, inventario e insights de Oeste Admin.</p></div>
    <Card><CardHeader><CardTitle>Filtros globales</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Select value={filters.range} onValueChange={(range) => setFilters(f => ({ ...f, range }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['7','7 días'],['30','30 días'],['90','90 días'],['365','Último año']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.channel} onValueChange={(channel) => setFilters(f => ({ ...f, channel: channel as Filters['channel'] }))}><SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los canales</SelectItem>{Object.entries(channelLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.payment} onValueChange={(payment) => setFilters(f => ({ ...f, payment }))}><SelectTrigger><SelectValue placeholder="Pago" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los pagos</SelectItem>{data?.paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.status} onValueChange={(status) => setFilters(f => ({ ...f, status: status as Filters['status'] }))}><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{Object.entries(statusLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.category} onValueChange={(category) => setFilters(f => ({ ...f, category }))}><SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{data?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.product} onValueChange={(product) => setFilters(f => ({ ...f, product }))}><SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los productos</SelectItem>{data?.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
    </CardContent></Card>
    {isLoading || !stats ? <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard title="Facturación total" value={formatPrice(stats.total)} compare={stats.compareTotal} icon={TrendingUp}/><KpiCard title="Facturación mes actual" value={formatPrice(stats.monthTotal)} icon={CalendarDays}/><KpiCard title="Facturación de hoy" value={formatPrice(stats.todayTotal)} icon={CalendarDays}/><KpiCard title="Ventas" value={`${stats.count}`} compare={stats.compareCount} icon={BarChart3}/><KpiCard title="Productos vendidos" value={`${stats.qty}`} icon={Boxes}/><KpiCard title="Ticket promedio" value={formatPrice(stats.ticket)} icon={CreditCard}/><KpiCard title="Descuentos" value={formatPrice(stats.discount)} icon={TrendingDown}/><KpiCard title="Ventas pagadas" value={`${stats.paidPct.toFixed(1)}%`} icon={Sparkles}/><KpiCard title="Pendientes de pago" value={`${stats.pending}`} icon={AlertTriangle}/><KpiCard title="Stock bajo / sin stock" value={`${stats.lowStock.length} / ${stats.noStock.length}`} icon={PackageSearch}/></section>
      {stats.count === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No hay datos para los filtros seleccionados.</CardContent></Card> : <>
      <section className="grid gap-4 xl:grid-cols-2"><ChartBox title="Ventas por día"><ChartContainer config={{ ventas: { color: '#2563eb' } }} className="h-72"><LineChart data={stats.byDay}><CartesianGrid vertical={false}/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line dataKey="ventas" stroke="#2563eb" strokeWidth={2}/></LineChart></ChartContainer></ChartBox><ChartBox title="Facturación por día"><ChartContainer config={{ facturacion: { color: '#16a34a' } }} className="h-72"><LineChart data={stats.byDay}><CartesianGrid vertical={false}/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v) => formatPrice(Number(v))}/><Line dataKey="facturacion" stroke="#16a34a" strokeWidth={2}/></LineChart></ChartContainer></ChartBox><ChartBox title="Ventas por mes"><ChartContainer config={{ ventas: { color: '#7c3aed' } }} className="h-72"><BarChart data={stats.byMonth}><CartesianGrid vertical={false}/><XAxis dataKey="month"/><YAxis/><Tooltip/><Bar dataKey="ventas" fill="#7c3aed" radius={6}/></BarChart></ChartContainer></ChartBox><ChartBox title="Facturación y ticket por mes"><ChartContainer config={{ facturacion: { color: '#f59e0b' }, ticket: { color: '#dc2626' } }} className="h-72"><ComposedChart data={stats.byMonth}><CartesianGrid vertical={false}/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v) => formatPrice(Number(v))}/><Bar dataKey="facturacion" fill="#f59e0b" radius={6}/><Line dataKey="ticket" stroke="#dc2626"/></ComposedChart></ChartContainer></ChartBox></section>
      <section className="grid gap-4 xl:grid-cols-3"><ChartBox title="Métodos de pago"><ChartContainer config={{ value: { color: '#2563eb' } }} className="h-72"><BarChart data={stats.payment}><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="facturacion" radius={6}>{stats.payment.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Bar></BarChart></ChartContainer></ChartBox><ChartBox title="Canales de venta"><ChartContainer config={{ value: { color: '#16a34a' } }} className="h-72"><PieChart><Tooltip/><Pie data={stats.channels} dataKey="value" nameKey="name" outerRadius={95} label>{stats.channels.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Pie></PieChart></ChartContainer></ChartBox><ChartBox title="Estados de venta"><ChartContainer config={{ value: { color: '#f59e0b' } }} className="h-72"><PieChart><Tooltip/><Pie data={stats.statuses} dataKey="value" nameKey="name" outerRadius={95} label>{stats.statuses.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Pie></PieChart></ChartContainer></ChartBox></section>
      <section className="grid gap-4 xl:grid-cols-3"><Ranking title="Categorías más vendidas" rows={stats.categories.map(c => [c.name, `${c.qty} u.`, formatPrice(c.revenue)])}/><Ranking title="Top productos vendidos" rows={stats.productRows.sort((a,b)=>b.qty-a.qty).slice(0,20).map(p => [p.name, `${p.qty} u.`, formatPrice(p.revenue)])}/><Ranking title="Productos con mayor facturación" rows={stats.productRows.sort((a,b)=>b.revenue-a.revenue).slice(0,20).map(p => [p.name, formatPrice(p.revenue), `${p.qty} u.`])}/></section>
      </>}
      <section><h2 className="mb-3 text-2xl font-semibold">Inventario</h2><div className="mb-3 flex items-center gap-2"><span className="text-sm text-muted-foreground">Umbral stock crítico</span><Input className="w-24" type="number" value={filters.lowStock} onChange={(e) => setFilters(f => ({ ...f, lowStock: Number(e.target.value) }))}/></div><div className="grid gap-4 xl:grid-cols-2"><InventoryTable title="Productos sin stock" products={stats.noStock}/><InventoryTable title="Stock crítico" products={stats.lowStock}/><Ranking title="Productos menos vendidos" rows={stats.productRows.sort((a,b)=>a.qty-b.qty).slice(0,20).map(p => [p.name, `${p.qty} u.`, <Badge key={p.id} variant="outline">Stock {p.stock}</Badge>])}/><InventoryTable title="Sin ventas recientes" products={(data?.products || []).filter(p => !stats.productRows.some(r => r.id === p.id)).slice(0,20)}/></div></section>
      <section><h2 className="mb-3 text-2xl font-semibold">Insights</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.insights.map((insight) => <InsightCard key={insight.title} insight={insight}/>)}</div></section>
      <section><h2 className="mb-3 text-2xl font-semibold">Forecast y proyecciones</h2><div className="grid gap-4 md:grid-cols-3"><ForecastCard title="Cierre mensual" value={formatPrice(stats.forecasts.monthProjection)} confidence={stats.forecasts.confidence} explanation="Promedio diario del rango seleccionado multiplicado por los días del mes actual."/><ForecastCard title="Ventas próximos 7 días" value={formatPrice(stats.forecasts.next7)} confidence={stats.forecasts.confidence} explanation="Promedio diario histórico del rango seleccionado proyectado a 7 días."/><ForecastCard title="Facturación próximos 30 días" value={formatPrice(stats.forecasts.next30)} confidence={stats.forecasts.confidence} explanation="Proyección lineal simple sin APIs externas, basada sólo en ventas históricas."/></div></section>
    </>}
  </div>
}

function Ranking({ title, rows }: { title: string; rows: (React.ReactNode[])[] }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><Table><TableBody>{rows.length ? rows.map((row, i) => <TableRow key={i}><TableCell className="font-medium">{i + 1}. {row[0]}</TableCell><TableCell>{row[1]}</TableCell><TableCell className="text-right">{row[2]}</TableCell></TableRow>) : <TableRow><TableCell className="text-muted-foreground">Sin datos</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
}
function InventoryTable({ title, products }: { title: string; products: Product[] }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{products.length} productos</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Categoría</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader><TableBody>{products.length ? products.map(p => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.category?.name || 'Sin categoría'}</TableCell><TableCell className="text-right"><Badge variant={p.stock <= 0 ? 'destructive' : 'secondary'}>{p.stock}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="text-muted-foreground">Sin alertas</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
}
