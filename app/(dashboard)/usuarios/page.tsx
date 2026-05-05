'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Product, Category, ProductRowState } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { Search, Plus, Save, X, Download, Upload, AlertCircle, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const supabase = createClient()

const fetchProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .order('name')
  if (error) throw error
  return data as Product[]
}

const fetchCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data as Category[]
}

export default function UsersPage() {
  const { data: products, isLoading: productsLoading } = useSWR('all-products', fetchProducts)
  const { data: categories } = useSWR('categories', fetchCategories)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editedProducts, setEditedProducts] = useState<Map<string, ProductRowState>>(new Map())
  const [isNewProductOpen, setIsNewProductOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const rowFileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const newProductFileInput = useRef<HTMLInputElement | null>(null)

  // New product form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    variant: '',
    price: '',
    stock: '',
    category_id: '',
    is_active: true,
    image_url: '',
  })
  const [uploadingImage, setUploadingImage] = useState<string | null>(null) // product id or 'new'
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.variant?.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter
      const matchesActive = showInactive || product.is_active
      return matchesSearch && matchesCategory && matchesActive
    })
  }, [products, search, categoryFilter, showInactive])

  const hasChanges = editedProducts.size > 0

  const handleImageUpload = async (file: File, productId: string | 'new', productName?: string | null, productVariant?: string | null) => {
    setUploadingImage(productId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (productName) {
        formData.append('productName', productName)
      }
      if (productVariant) {
        formData.append('productVariant', productVariant)
      }

      const response = await fetch('/api/cloudinary', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Error al subir imagen')
      }

      const { url } = await response.json()

      if (productId === 'new') {
        setNewProduct((p) => ({ ...p, image_url: url }))
        setImagePreview(url)
      } else {
        handleFieldChange(productId, 'image_url', url)
      }

      toast.success('Imagen subida correctamente')
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Error al subir la imagen')
    } finally {
      setUploadingImage(null)
    }
  }

  const getProductValue = useCallback(
    (product: Product, field: keyof Product) => {
      const edited = editedProducts.get(product.id)
      if (edited && field in edited) {
        return edited[field as keyof ProductRowState]
      }
      return product[field]
    },
    [editedProducts]
  )

  const handleFieldChange = (productId: string, field: keyof Product, value: unknown) => {
    const product = products?.find((p) => p.id === productId)
    if (!product) return

    setEditedProducts((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(productId) || { ...product, isDirty: true, originalData: product }
      newMap.set(productId, { ...existing, [field]: value, isDirty: true })
      return newMap
    })
  }

  const cancelChanges = () => {
    setEditedProducts(new Map())
  }

  const saveChanges = async () => {
    setIsSaving(true)
    try {
      const updates = Array.from(editedProducts.values())
      for (const product of updates) {
        const { id, name, variant, price, stock, category_id, is_active, image_url } = product
        const { error } = await supabase
          .from('products')
          .update({ name, variant, price, stock, category_id, is_active, image_url })
          .eq('id', id)
        if (error) throw error
      }
      toast.success(`${updates.length} producto(s) actualizado(s)`)
      setEditedProducts(new Map())
      mutate('all-products')
      mutate('products')
    } catch (error) {
      console.error('Error saving products:', error)
      toast.error('Error al guardar cambios')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.stock) {
      toast.error('Completa los campos requeridos')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('products').insert({
        name: newProduct.name,
        variant: newProduct.variant || null,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        category_id: newProduct.category_id || null,
        is_active: newProduct.is_active,
        image_url: newProduct.image_url || null,
      })

      if (error) throw error

      toast.success('Producto creado')
      setIsNewProductOpen(false)
      setNewProduct({ name: '', variant: '', price: '', stock: '', category_id: '', is_active: true, image_url: '' })
      setImagePreview(null)
      mutate('all-products')
      mutate('products')
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Error al crear producto')
    } finally {
      setIsSaving(false)
    }
  }

  const exportToExcel = () => {
    if (!products) return
    
    const data = products.map((p) => ({
      Nombre: p.name,
      Variante: p.variant || '',
      Precio: p.price,
      Stock: p.stock,
      Categoria: p.category?.name || '',
      Activo: p.is_active ? 'Si' : 'No',
    }))

    // Create CSV content
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map((row) => Object.values(row).join(','))
    const csv = [headers, ...rows].join('\n')

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Productos</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={!products?.length}>
            <Upload className="h-4 w-4 mr-2" />
            Importar 
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={!products?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Producto</DialogTitle>
                <DialogDescription>Completa los datos del nuevo producto</DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>Imagen</FieldLabel>
                  <button
                    type="button"
                    onClick={() => newProductFileInput.current?.click()}
                    className="group relative h-32 w-32 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40"
                    disabled={uploadingImage === 'new'}
                  >
                    <img
                      src={imagePreview || newProduct.image_url || '/placeholder.jpg'}
                      alt="Vista previa"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex">
                      {uploadingImage === 'new' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                    </div>
                  </button>
                  <input
                    ref={newProductFileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageUpload(file, 'new')
                      }
                      e.target.value = ''
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>Nombre *</FieldLabel>
                  <Input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre del producto"
                  />
                </Field>
                <Field>
                  <FieldLabel>Variante</FieldLabel>
                  <Input
                    value={newProduct.variant}
                    onChange={(e) => setNewProduct((p) => ({ ...p, variant: e.target.value }))}
                    placeholder="Color, talle, etc."
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Precio *</FieldLabel>
                    <Input
                      type="number"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Stock *</FieldLabel>
                    <Input
                      type="number"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct((p) => ({ ...p, stock: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Categoria</FieldLabel>
                  <Select
                    value={newProduct.category_id}
                    onValueChange={(v) => setNewProduct((p) => ({ ...p, category_id: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>Activo</FieldLabel>
                    <Switch
                      checked={newProduct.is_active}
                      onCheckedChange={(v) => setNewProduct((p) => ({ ...p, is_active: v }))}
                    />
                  </div>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewProductOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateProduct} disabled={isSaving}>
                  {isSaving ? 'Creando...' : 'Crear Producto'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorias</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
            <label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
              Mostrar inactivos
            </label>
          </div>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-amber-400 border-amber-400/30">
              {editedProducts.size} cambios sin guardar
            </Badge>
            <Button variant="outline" size="sm" onClick={cancelChanges}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={saveChanges} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Imagen</TableHead>
              <TableHead className="w-[250px]">Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Activo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-10 bg-secondary/50 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const isEdited = editedProducts.has(product.id)
                return (
                  <TableRow key={product.id} className={cn(isEdited && 'bg-amber-500/5')}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => rowFileInputs.current[product.id]?.click()}
                        className="group relative h-14 w-14 overflow-hidden rounded-md border border-border bg-muted/40"
                        disabled={uploadingImage === product.id}
                      >
                        <img
                          src={(getProductValue(product, 'image_url') as string) || '/placeholder.jpg'}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
                          {uploadingImage === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                      <input
                        ref={(el) => {
                          rowFileInputs.current[product.id] = el
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleImageUpload(file, product.id, product.name, product.variant)
                          }
                          e.target.value = ''
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={getProductValue(product, 'name') as string}
                        onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                        className="h-8 bg-transparent border-transparent hover:border-input focus:border-input"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={(getProductValue(product, 'variant') as string) || ''}
                        onChange={(e) => handleFieldChange(product.id, 'variant', e.target.value)}
                        className="h-8 bg-transparent border-transparent hover:border-input focus:border-input"
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={(getProductValue(product, 'category_id') as string) || 'none'}
                        onValueChange={(v) => handleFieldChange(product.id, 'category_id', v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-40 bg-transparent border-transparent hover:border-input">
                          <SelectValue placeholder="Sin categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin categoria</SelectItem>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={getProductValue(product, 'price') as number}
                        onChange={(e) => handleFieldChange(product.id, 'price', parseFloat(e.target.value) || 0)}
                        className="h-8 w-28 text-right bg-transparent border-transparent hover:border-input focus:border-input ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        min={0}
                        type="number"
                        value={getProductValue(product, 'stock') as number}
                        onChange={(e) => handleFieldChange(product.id, 'stock', parseInt(e.target.value) || 0)}
                        className="h-8 w-20 text-center bg-transparent border-transparent hover:border-input focus:border-input mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={getProductValue(product, 'is_active') as boolean}
                        onCheckedChange={(v) => handleFieldChange(product.id, 'is_active', v)}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      {!productsLoading && filteredProducts.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {filteredProducts.length} productos encontrados
        </div>
      )}
    </div>
  )
}
