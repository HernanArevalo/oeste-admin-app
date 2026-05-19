'use client'

import { useCallback, useRef, useState } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductFilters } from '@/components/products/ProductFilters'
import { ProductTable } from '@/components/products/ProductTable'
import { ProductStats } from '@/components/products/ProductStats'
import { NewProductDialog } from '@/components/products/NewProductDialog'
import { useInfiniteProducts } from '@/hooks/products/useInfiniteProducts'
import { useProducts } from '@/hooks/products/useProducts'
import { useEditedProducts } from '@/hooks/products/useEditedProducts'
import { Plus, Save, X } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [isNewProductOpen, setIsNewProductOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const rowFileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const { categories = [] } = useProducts()
  const { products, totalProducts, hasMoreProducts, isLoadingMoreProducts, setSize, mutate: mutateProducts } = useInfiniteProducts(search, categoryFilter, showInactive)
  const { editedProducts, hasChanges, handleFieldChange, cancelChanges, setEditedProducts } = useEditedProducts(products)

  const refreshProducts = useCallback(() => {
    mutateProducts()
    mutate('products')
  }, [mutateProducts])

  const saveChanges = async () => {
    setIsSaving(true)
    try {
      const updates = Array.from(editedProducts.values())
      for (const product of updates) {
        const { id, name, variant, price, stock, category_id, is_active, image_url } = product
        const { error } = await supabase.from('products').update({ name, variant, price, stock, category_id, is_active, image_url }).eq('id', id)
        if (error) throw error
      }
      toast.success(`${updates.length} producto(s) actualizado(s)`)
      setEditedProducts(new Map())
      refreshProducts()
    } catch {
      toast.error('Error al guardar cambios')
    } finally {
      setIsSaving(false)
    }
  }

  const onPickImage = (product: Product) => {
    rowFileInputs.current[product.id]?.click()
  }

  return <div className='space-y-6'>
    <div className='flex items-center justify-between'>
      <h1 className='text-2xl font-semibold'>Productos</h1>
      <Button onClick={() => setIsNewProductOpen(true)}><Plus className='h-4 w-4 mr-2' />Nuevo Producto</Button>
    </div>

    <ProductFilters search={search} onSearch={setSearch} categoryFilter={categoryFilter} onCategoryFilter={setCategoryFilter} showInactive={showInactive} onShowInactive={setShowInactive} categories={categories} />

    {hasChanges && <div className='flex items-center gap-2 w-fit'>
      <Badge variant='outline'>{editedProducts.size} cambios sin guardar</Badge>
      <Button variant='outline' size='sm' onClick={cancelChanges}><X className='h-4 w-4 mr-1' />Cancelar</Button>
      <Button size='sm' onClick={saveChanges} disabled={isSaving}><Save className='h-4 w-4 mr-1' />{isSaving ? 'Guardando...' : 'Guardar'}</Button>
    </div>}

    <ProductTable products={products} categories={categories} editedProducts={editedProducts} uploadingImage={uploadingImage} onChange={handleFieldChange} onPickImage={onPickImage} />
    <ProductStats shown={products.length} total={totalProducts} hasMore={hasMoreProducts} isLoadingMore={isLoadingMoreProducts} onMore={() => setSize((s) => s + 1)} />
    <NewProductDialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen} />
  </div>
}
