'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Sale, SaleStatus, Channel, statusLabels, channelLabels, statusColors } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Eye, Calendar, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

const supabase = createClient()

const fetcher = async () => {
  const { data, error } = await supabase
    .from('sales')
    .select('*, payment_method:payment_methods(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Sale[]
}

export default function SalesPage() {
  const { data: sales, isLoading } = useSWR('sales', fetcher)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all')

  const filteredSales = useMemo(() => {
    if (!sales) return []
    return sales.filter((sale) => {
      const matchesSearch = 
        sale.id.toLowerCase().includes(search.toLowerCase()) ||
        sale.order_number?.toString().includes(search)
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter
      const matchesChannel = channelFilter === 'all' || sale.point_of_sale === channelFilter
      return matchesSearch && matchesStatus && matchesChannel
    })
  }, [sales, search, statusFilter, channelFilter])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Ventas</h1>
        <Link href="/">
          <Button>Nueva Venta</Button>
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
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Metodo de Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-10 bg-secondary/50 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No se encontraron ventas
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {formatDate(sale.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {sale.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{channelLabels[sale.point_of_sale]}</Badge>
                  </TableCell>
                  <TableCell>{sale.payment_method?.name}</TableCell>
                  <TableCell>
                    <Badge className={cn('border', statusColors[sale.status])}>
                      {statusLabels[sale.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(sale.total)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/ventas/${sale.id}`}>
                      <Button variant="ghost" size="icon-sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      {!isLoading && filteredSales.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredSales.length} ventas encontradas</span>
          <span>
            Total: {formatPrice(filteredSales.reduce((sum, sale) => sum + sale.total, 0))}
          </span>
        </div>
      )}
    </div>
  )
}
