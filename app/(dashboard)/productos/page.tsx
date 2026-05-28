'use client'

import { ChangeEvent, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import useSWR, { mutate } from 'swr'
import useSWRInfinite from 'swr/infinite'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { Search, Plus, Save, X, Download, Upload, AlertCircle, ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { capitalize, getOptimizedCloudinaryImage } from '@/utils'
import Image from 'next/image'

const supabase = createClient()
const PRODUCTS_PAGE_SIZE = 10

type ImportRow = Record<string, string | number | boolean | null | undefined>

const getImportValue = (row: ImportRow, columnName: string) => {
  const normalizedColumnName = columnName.trim().toLowerCase()
  const matchingKey = Object.keys(row).find((key) => key.trim().toLowerCase() === normalizedColumnName)
  const value = matchingKey ? row[matchingKey] : undefined
  return value === null || value === undefined ? '' : String(value).trim()
}

const parseImportNumber = (value: string, fallback = 0) => {
  const normalizedValue = value.replace(/\./g, '').replace(',', '.').trim()
  if (!normalizedValue) return fallback

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const getImportedProductNameParts = (rawName: string) => rawName.split(/\s+/).filter(Boolean)

const buildImportedProductName = (rawName: string) => {
  const [firstNamePart] = getImportedProductNameParts(rawName)
  return capitalize(firstNamePart) || capitalize(rawName)
}

const buildImportedProductVariant = (
  rawName: string,
  attributeValue: string
) => {
  if (attributeValue) return attributeValue

  const variantParts =
    getImportedProductNameParts(rawName).slice(1)

  if (!variantParts.length) return null

  if (variantParts[0] === '-') {
    variantParts.shift()
  }

  const variant = capitalize(
    variantParts.join(' ').trim()
  )

  return variant || null
}

type ProductsPageKey = [
  'products-page',
  number,
  string,
  string,
  boolean,
]

type ProductsPageResponse = {
  products: Product[]
  count: number
}

const sanitizeSearchTerm = (value: string) => value.replace(/[%,]/g, '').trim()

const fetchProductsPage = async ([, pageIndex, search, categoryFilter, showInactive]: ProductsPageKey) => {
  const from = pageIndex * PRODUCTS_PAGE_SIZE
  const to = from + PRODUCTS_PAGE_SIZE - 1
  const searchTerm = sanitizeSearchTerm(search)

  let query = supabase
    .from('products')
    .select('*, category:categories(*)', { count: 'exact' })
    .order('name', { ascending: true })
    .order('variant', { ascending: true })
    .range(from, to)

  if (searchTerm) {
    query = query.or(`name.ilike.%${searchTerm}%,variant.ilike.%${searchTerm}%`)
  }

  if (categoryFilter !== 'all') {
    query = query.eq('category_id', categoryFilter)
  }

  if (!showInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error, count } = await query
  if (error) throw error

  return {
    products: data as Product[],
    count: count || 0,
  }
}

const fetchAllProductsForExport = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .order('name')

  if (error) throw error
  return data as Product[]
}

const fetchExistingProductKeys = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('name, variant')

  if (error) throw error

  return new Set(
    (data || []).map((product) => {
      const name = product.name?.trim().toLowerCase() || ''
      const variant = product.variant?.trim().toLowerCase() || ''

      return `${name}::${variant}`
    })
  )
}

const fetchCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data as Category[]
}

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const {
    data: productPages,
    isLoading: productsLoading,
    isValidating: productsValidating,
    size: productPagesSize,
    setSize: setProductPagesSize,
    mutate: mutateProductPages,
  } = useSWRInfinite<ProductsPageResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && previousPageData.products.length === 0) return null

      return ['products-page', pageIndex, search, categoryFilter, showInactive] as ProductsPageKey
    },
    fetchProductsPage
  )
  const { data: categories } = useSWR('categories', fetchCategories)

  const [editedProducts, setEditedProducts] = useState<Map<string, ProductRowState>>(new Map())
  const [isNewProductOpen, setIsNewProductOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const rowFileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const newProductFileInput = useRef<HTMLInputElement | null>(null)
  const importFileInput = useRef<HTMLInputElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

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

  const products = useMemo(
    () => productPages?.flatMap((page) => page.products) || [],
    [productPages]
  )
  const totalProducts = productPages?.[0]?.count || 0
  const hasMoreProducts = products.length < totalProducts
  const isLoadingMoreProducts = productsValidating && productPagesSize > 0

  useEffect(() => {
    const loadMoreElement = loadMoreRef.current

    if (!loadMoreElement || !hasMoreProducts || productsLoading || isLoadingMoreProducts) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setProductPagesSize((currentSize) => currentSize + 1)
        }
      },
      { rootMargin: '300px' }
    )

    observer.observe(loadMoreElement)

    return () => observer.disconnect()
  }, [hasMoreProducts, isLoadingMoreProducts, productsLoading, setProductPagesSize])

  const refreshProducts = useCallback(() => {
    mutateProductPages()
    mutate('products')
  }, [mutateProductPages])

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
      toast.success(`${updates.length} producto${updates.length !== 1 ? 's' : ''} actualizado${updates.length !== 1 ? 's' : ''}`)
      setEditedProducts(new Map())
      refreshProducts()
    } catch (error) {
      console.error('Error saving products:', error)
      toast.error('Error al guardar cambios')
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportProducts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setIsImporting(true)

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]

      const rows = XLSX.utils.sheet_to_json<ImportRow>(worksheet, {
        defval: '',
      })

      if (!rows.length) {
        toast.error('El archivo no tiene productos para importar')
        return
      }

      const categoryNames = Array.from(
        new Set(
          rows
            .map((row) => getImportValue(row, 'Categorías'))
            .filter(Boolean)
        )
      )

      const categoryByName = new Map(
        (categories || []).map((category) => [category.name, category])
      )

      const missingCategoryNames = categoryNames.filter(
        (categoryName) => !categoryByName.has(categoryName)
      )

      if (missingCategoryNames.length) {
        const { data: createdCategories, error: categoriesError } =
          await supabase
            .from('categories')
            .upsert(
              missingCategoryNames.map((name) => ({ name })),
              { onConflict: 'name' }
            )
            .select('*')

        if (categoriesError) throw categoriesError

        createdCategories?.forEach((category) => {
          categoryByName.set(category.name, category as Category)
        })
      }

      const productsToImport = rows
        .map((row) => {
          const rawName = getImportValue(row, 'Nombre')

          if (!rawName) return null

          const categoryName = getImportValue(row, 'Categorías')

          const category = categoryName
            ? categoryByName.get(categoryName)
            : null

          return {
            name: buildImportedProductName(rawName),
            variant: buildImportedProductVariant(
              rawName,
              getImportValue(row, 'Valor atributo 1')
            ),
            price: parseImportNumber(getImportValue(row, 'Precio')),
            stock: Math.trunc(
              parseImportNumber(getImportValue(row, 'Stock'))
            ),
            category_id: category?.id || null,
            is_active: true,
            image_url: null,
            empretienda_product_id: getImportValue(row, 'IDProduct') || null,
            empretienda_stock_id: getImportValue(row, 'IDStock') || null,
          }
        })
        .filter(
          (product): product is NonNullable<typeof product> =>
            Boolean(product)
        )

      if (!productsToImport.length) {
        toast.error('No se encontraron productos con nombre para importar')
        return
      }

      // Consultar todos los productos existentes para evitar duplicados aunque la tabla esté paginada.
      const existingProductsKeys = await fetchExistingProductKeys()

      // Filtrar productos que no existan
      const filteredProducts = productsToImport.filter((product) => {
        const key = `${product.name.trim().toLowerCase()}::${product.variant?.trim().toLowerCase() || ''}`

        return !existingProductsKeys.has(key)
      })

      if (!filteredProducts.length) {
        toast.error('Todos los productos ya existen')
        return
      }

      const { error: productsError } = await supabase
        .from('products')
        .insert(filteredProducts)

      if (productsError) throw productsError

      toast.success(`${filteredProducts.length} producto${filteredProducts.length !== 1 ? 's' : ''} importado${filteredProducts.length !== 1 ? 's' : ''}`)

      mutate('categories')
      refreshProducts()
    } catch (error) {
      console.error('Error importing products:', error)
      toast.error('Error al importar productos')
    } finally {
      setIsImporting(false)
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
      refreshProducts()
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Error al crear producto')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return

    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id)

      if (error) throw error

      setEditedProducts((prev) => {
        const newMap = new Map(prev)
        newMap.delete(productToDelete.id)
        return newMap
      })
      toast.success('Producto eliminado')
      setProductToDelete(null)
      refreshProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Error al eliminar el producto')
    } finally {
      setIsDeleting(false)
    }
  }

  const productToDeleteName = productToDelete
    ? `"${productToDelete.name}${productToDelete.variant ? ` - ${productToDelete.variant}` : ''}"`
    : 'este producto'

  const exportToExcel = async () => {
    try {
      const allProducts = await fetchAllProductsForExport()
      if (!allProducts.length) return

      const data = allProducts.map((p) => ({
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
    } catch (error) {
      console.error('Error exporting products:', error)
      toast.error('Error al exportar productos')
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Productos</h1>
          <div className="flex items-center gap-2">
            <input
              ref={importFileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportProducts}
            />
            <Button variant="outline" onClick={() => importFileInput.current?.click()} disabled={isImporting}>
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isImporting ? 'Importando...' : 'Importar'}
            </Button>
            <Button variant="outline" onClick={exportToExcel} disabled={!products?.length}>
              <Upload className="h-4 w-4 mr-2" />
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
                      <Image
                        width={54}
                        height={54}
                        src={imagePreview || (newProduct.image_url && getOptimizedCloudinaryImage(newProduct.image_url, 54)) || "/placeholder.jpg"}
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
              <TableHead className="w-fit">Imagen</TableHead>
              <TableHead className="w-[150px]">Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <div className="h-10 bg-secondary/50 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const isEdited = editedProducts.has(product.id)
                return (
                  <TableRow key={product.id} className={cn(isEdited && 'bg-amber-500/5')}>
                    <TableCell className='w-fit'>
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
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setProductToDelete(product)}
                        aria-label={`Eliminar ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      {!productsLoading && totalProducts > 0 && (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mostrando {products.length} de {totalProducts} productos encontrados
          </span>
          {hasMoreProducts && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProductPagesSize((currentSize) => currentSize + 1)}
              disabled={isLoadingMoreProducts}
            >
              {isLoadingMoreProducts ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isLoadingMoreProducts ? 'Cargando...' : 'Cargar más'}
            </Button>
          )}
        </div>
      )}
      {hasMoreProducts && <div ref={loadMoreRef} className="h-1" aria-hidden="true" />}
    </div>

    <AlertDialog
      open={Boolean(productToDelete)}
      onOpenChange={(open) => !open && !isDeleting && setProductToDelete(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás por eliminar {productToDeleteName}. Esta acción no tiene vuelta atrás.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDeleteProduct()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar definitivamente'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
