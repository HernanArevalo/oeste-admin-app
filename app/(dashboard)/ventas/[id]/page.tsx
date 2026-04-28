'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Sale, SaleItem, SaleStatus, statusLabels, channelLabels, statusColors } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ArrowLeft, Calendar, CreditCard, MapPin, MessageSquare, Package, Send, Image, ExternalLink, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const supabase = createClient()

const fetcher = async (id: string) => {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*, payment_method:payment_methods(*)')
    .eq('id', id)
    .single()

  if (saleError) throw saleError

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('*, product:products(*, category:categories(*))')
    .eq('sale_id', id)

  if (itemsError) throw itemsError

  return { ...sale, items } as Sale & { items: SaleItem[] }
}

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: sale, isLoading, error } = useSWR(id, fetcher)

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false)
  const [whatsAppMessage, setWhatsAppMessage] = useState('')
  const [copied, setCopied] = useState(false)

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

  const handleStatusChange = async (newStatus: SaleStatus) => {
    setIsUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('sales')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      toast.success('Estado actualizado')
      mutate(id)
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Error al actualizar estado')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const generateWhatsAppMessage = () => {
    if (!sale) return ''
    const items = sale.items?.map(item => 
      `- ${item.quantity}x ${item.product?.name}${item.product?.variant ? ` (${item.product.variant})` : ''}`
    ).join('\n')
    
    return `Hola! Tu pedido de Oeste Gafas esta listo.

Detalle:
${items}

Total: ${formatPrice(sale.total)}

Gracias por tu compra!`
  }

  const openWhatsAppDialog = () => {
    setWhatsAppMessage(generateWhatsAppMessage())
    setShowWhatsAppDialog(true)
  }

  const copyUploadLink = () => {
    const link = `${window.location.origin}/subir-comprobante/${id}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Link copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  const openWhatsApp = (message: string) => {
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
    setShowWhatsAppDialog(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-secondary/50 animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-64 bg-secondary/50 animate-pulse rounded-lg" />
          <div className="h-64 bg-secondary/50 animate-pulse rounded-lg" />
        </div>
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>Venta no encontrada</p>
        <Link href="/ventas" className="mt-4">
          <Button variant="outline">Volver a Ventas</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ventas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Detalle de Venta</h1>
            <p className="text-sm text-muted-foreground font-mono">{sale.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyUploadLink}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Link Comprobante
          </Button>
          <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openWhatsAppDialog}>
                <Send className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar por WhatsApp</DialogTitle>
                <DialogDescription>
                  Edita el mensaje antes de enviarlo
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={whatsAppMessage}
                onChange={(e) => setWhatsAppMessage(e.target.value)}
                rows={10}
                className="resize-none"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => openWhatsApp(whatsAppMessage)}>
                  <Send className="h-4 w-4 mr-2" />
                  Abrir WhatsApp
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Items */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.product?.name}</p>
                        {item.product?.variant && (
                          <p className="text-sm text-muted-foreground">{item.product.variant}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="mt-6 border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Descuento</span>
                  <span>-{formatPrice(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span>{formatPrice(sale.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={sale.status}
                onValueChange={(v) => handleStatusChange(v as SaleStatus)}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <Badge className={cn('border', statusColors[sale.status])}>
                      {statusLabels[sale.status]}
                    </Badge>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabels) as SaleStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      <Badge className={cn('border', statusColors[status])}>
                        {statusLabels[status]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Informacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-medium">{formatDate(sale.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Canal</p>
                  <p className="font-medium">{channelLabels[sale.point_of_sale]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Metodo de Pago</p>
                  <p className="font-medium">{sale.payment_method?.name}</p>
                </div>
              </div>
              {sale.notes && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="font-medium">{sale.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Image className="h-4 w-4" />
                Comprobante
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sale.receipt_image_url ? (
                <div className="space-y-2">
                  <a
                    href={sale.receipt_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-colors"
                  >
                    <img
                      src={sale.receipt_image_url}
                      alt="Comprobante"
                      className="w-full h-auto"
                    />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Subido: {sale.receipt_uploaded_at ? formatDate(sale.receipt_uploaded_at) : 'N/A'}
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin comprobante</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={copyUploadLink}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Copiar link de subida
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
