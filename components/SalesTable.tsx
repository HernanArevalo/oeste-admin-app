import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Eye, Calendar, Filter } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatPrice } from '@/utils'
import { Sale, statusLabels, channelLabels, statusColors } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  sales: Sale[]
  isLoading: boolean
}

export function SalesTable ({ isLoading, sales }: Props) {
  return (
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
            ) : sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No se encontraron ventas
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
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
  )
}
