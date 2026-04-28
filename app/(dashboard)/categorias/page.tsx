'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Plus, Pencil, Trash2, Tags, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

const fetcher = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data as Category[]
}

export default function CategoriesPage() {
  const { data: categories, isLoading } = useSWR('categories', fetcher)

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('categories').insert({ name: name.trim() })
      if (error) throw error

      toast.success('Categoria creada')
      setIsNewDialogOpen(false)
      setName('')
      mutate('categories')
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error('Error al crear categoria')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingCategory || !name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', editingCategory.id)
      if (error) throw error

      toast.success('Categoria actualizada')
      setEditingCategory(null)
      setName('')
      mutate('categories')
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error('Error al actualizar categoria')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error

      toast.success('Categoria eliminada')
      mutate('categories')
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Error al eliminar categoria. Puede tener productos asociados.')
    }
  }

  const openEditDialog = (category: Category) => {
    setEditingCategory(category)
    setName(category.name)
  }

  const closeEditDialog = () => {
    setEditingCategory(null)
    setName('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Categorias</h1>
          <p className="text-muted-foreground mt-1">Administra las categorias de productos</p>
        </div>
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Categoria</DialogTitle>
              <DialogDescription>Ingresa el nombre de la nueva categoria</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la categoria"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </Field>
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

      {/* Categories Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-card animate-pulse rounded-lg border border-border" />
          ))}
        </div>
      ) : categories?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Tags className="h-12 w-12 mb-4 opacity-50" />
            <p>No hay categorias</p>
            <Button variant="link" onClick={() => setIsNewDialogOpen(true)} className="mt-2">
              Crear primera categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories?.map((category) => (
            <Card key={category.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <Tags className="h-4 w-4 text-foreground" />
                    </div>
                    <CardTitle className="text-base">{category.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(category)}>
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
                          <AlertDialogTitle>Eliminar categoria</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta accion no se puede deshacer. Los productos con esta categoria
                            quedaran sin categoria asignada.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(category.id)}>
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
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
            <DialogDescription>Modifica el nombre de la categoria</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Nombre</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la categoria"
              onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            />
          </Field>
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
