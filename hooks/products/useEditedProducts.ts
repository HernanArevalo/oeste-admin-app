import { useCallback, useMemo, useState } from 'react'
import { Product, ProductRowState } from '@/lib/types'

export function useEditedProducts(products: Product[]) {
  const [editedProducts, setEditedProducts] = useState<Map<string, ProductRowState>>(new Map())

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const getProductValue = useCallback((product: Product, field: keyof Product) => {
    const edited = editedProducts.get(product.id)
    if (edited && field in edited) return edited[field as keyof ProductRowState]
    return product[field]
  }, [editedProducts])

  const handleFieldChange = useCallback((productId: string, field: keyof Product, value: unknown) => {
    const product = productsById.get(productId)
    if (!product) return

    setEditedProducts((prev) => {
      const map = new Map(prev)
      const existing = map.get(productId) || { ...product, isDirty: true, originalData: product }
      map.set(productId, { ...existing, [field]: value, isDirty: true })
      return map
    })
  }, [productsById])

  const cancelChanges = useCallback(() => setEditedProducts(new Map()), [])

  return {
    editedProducts,
    hasChanges: editedProducts.size > 0,
    getProductValue,
    handleFieldChange,
    cancelChanges,
    setEditedProducts,
  }
}
