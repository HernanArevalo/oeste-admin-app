'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import useSWRInfinite from 'swr/infinite'
import { createClient } from '@/lib/supabase/client'
import { Sale, SaleStatus, Channel, statusLabels, channelLabels } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SalesTable } from '@/components/SalesTable'
import { Search, Filter, PlusCircle } from 'lucide-react'
import { formatPrice } from '@/utils'

const supabase = createClient()
const SALES_PAGE_SIZE = 10

type SalesPageKey = ['sales-page', number, string, SaleStatus | 'all', Channel | 'all']
type SalesPageResponse = {
  sales: Sale[]
  count: number
}

const fetchSalesPage = async ([, pageIndex, search, statusFilter, channelFilter]: SalesPageKey): Promise<SalesPageResponse> => {
  const from = pageIndex * SALES_PAGE_SIZE
  const to = from + SALES_PAGE_SIZE - 1
  const searchTerm = search.trim()

  let query = supabase
    .from('sales')
    .select('*, payment_method:payment_methods(*), items:sale_items(*, product:products(*))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchTerm) {
    query = query.or(`id.ilike.%${searchTerm}%,order_number::text.ilike.%${searchTerm}%`)
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  if (channelFilter !== 'all') {
    query = query.eq('point_of_sale', channelFilter)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { sales: data as Sale[], count: count || 0 }
}

export default function SalesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all')
  const loadMoreSalesRef = useRef<HTMLDivElement | null>(null)
  const {
    data: salesPages,
    isLoading,
    isValidating,
    size: salesPageSize,
    setSize: setSalesPageSize,
  } = useSWRInfinite<SalesPageResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && previousPageData.sales.length === 0) return null
      return ['sales-page', pageIndex, search, statusFilter, channelFilter] as SalesPageKey
    },
    fetchSalesPage
  )

  const filteredSales = useMemo(() => salesPages?.flatMap((page) => page.sales) || [], [salesPages])
  const totalSales = salesPages?.[0]?.count || 0
  const hasMoreSales = filteredSales.length < totalSales
  const isLoadingMoreSales = isValidating && salesPageSize > 0

  useEffect(() => {
    const loadMoreElement = loadMoreSalesRef.current
    if (!loadMoreElement || !hasMoreSales || isLoading || isLoadingMoreSales) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setSalesPageSize((currentSize) => currentSize + 1)
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(loadMoreElement)
    return () => observer.disconnect()
  }, [hasMoreSales, isLoading, isLoadingMoreSales, setSalesPageSize])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Ventas</h1>
        <Link href="/">
          <Button>
            <PlusCircle />
            Nueva Venta
            </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID o numero de orden..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SaleStatus | 'all')}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.keys(statusLabels) as SaleStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as Channel | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {(Object.keys(channelLabels) as Channel[]).map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channelLabels[channel]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <SalesTable isLoading={isLoading} sales={filteredSales} />

      {/* Stats */}
      {!isLoading && filteredSales.length > 0 && (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Mostrando {filteredSales.length} de {totalSales} ventas encontradas</span>
          <span>
            Total: {formatPrice(filteredSales.reduce((sum, sale) => sum + sale.total, 0))}
          </span>
        </div>
      )}
      {hasMoreSales && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSalesPageSize((currentSize) => currentSize + 1)}
            disabled={isLoadingMoreSales}
          >
            {isLoadingMoreSales ? 'Cargando...' : 'Cargar más ventas'}
          </Button>
          <div ref={loadMoreSalesRef} className="h-1" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
