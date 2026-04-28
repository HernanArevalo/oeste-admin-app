'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PaymentMethod } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { Plus, Pencil, Trash2, CreditCard, Percent } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

const fetcher = async () => {
  const { data, error } = await supabase.from('payment_methods').select('*').order('name')
  if (error) throw error
  return data as PaymentMethod[]
}

export default function PaymentMethodsPage() {
  const { data: paymentMethods, isLoading } = useSWR('payment_methods', fetcher)

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [name, setName] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const resetForm = () => {
    setName('')
    setDiscountPct('')
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('payment_methods').insert({
        name: name.trim(),
        discount_pct: parseFloat(discountPct) || 0,
      })
      if (error) throw error

      toast.success('Metodo de pago creado')
      setIsNewDialogOpen(false)
      resetForm()
      mutate('payment_methods')
    } catch (error) {
      console.error('Error creating payment method:', error)
      toast.error('Error al crear metodo de pago')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingMethod || !name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({
          name: name.trim(),
          discount_pct: parseFloat(discountPct) || 0,
        })
        .eq('id', editingMethod.id)
      if (error) throw error

      toast.success('Metodo de pago actualizado')
      setEditingMethod(null)
      resetForm()
      mutate('payment_methods')
    } catch (error) {
      console.error('Error updating payment method:', error)
      toast.error('Error al actualizar metodo de pago')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id)
      if (error) throw error

      toast.success('Metodo de pago eliminado')
      mutate('payment_methods')
    } catch (error) {
      console.error('Error deleting payment method:', error)
      toast.error('Error al eliminar. Puede tener ventas asociadas.')
    }
  }

  const openEditDialog = (method: PaymentMethod) => {
    setEditingMethod(method)
    setName(method.name)
    setDiscountPct(method.discount_pct.toString())
  }

  const closeEditDialog = () => {
    setEditingMethod(null)
    resetForm()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Metodos de Pago</h1>
          <p className="text-muted-foreground mt-1">Administra los metodos de pago y sus descuentos</p>
        </div>
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Metodo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Metodo de Pago</DialogTitle>
              <DialogDescription>Configura un nuevo metodo de pago</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel>Nombre</FieldLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del metodo"
                />
              </Field>
              <Field>
                <FieldLabel>Descuento (%)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Methods Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-card animate-pulse rounded-lg border border-border" />
          ))}
        </div>
      ) : paymentMethods?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CreditCard className="h-12 w-12 mb-4 opacity-50" />
            <p>No hay metodos de pago</p>
            <Button variant="link" onClick={() => setIsNewDialogOpen(true)} className="mt-2">
              Crear primer metodo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods?.map((method) => (
            <Card key={method.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <CreditCard className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{method.name}</CardTitle>
                      {method.discount_pct > 0 && (
                        <Badge 
                          variant="outline" 
                          className="mt-1 text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                        >
                          <Percent className="h-3 w-3 mr-1" />
                          {method.discount_pct}% descuento
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(method)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar metodo de pago</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta accion no se puede deshacer. No podras eliminar el metodo si
                            tiene ventas asociadas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(method.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingMethod} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Metodo de Pago</DialogTitle>
            <DialogDescription>Modifica la configuracion del metodo</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del metodo"
              />
            </Field>
            <Field>
              <FieldLabel>Descuento (%)</FieldLabel>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                placeholder="0"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
