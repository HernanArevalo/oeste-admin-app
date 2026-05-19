import { useMemo } from 'react'
import useSWRInfinite from 'swr/infinite'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'

const supabase = createClient()
const PRODUCTS_PAGE_SIZE = 50
export type ProductsPageKey = ['products-page', number, string, string, boolean]
export type ProductsPageResponse = { products: Product[]; count: number }

const sanitizeSearchTerm = (value: string) => value.replace(/[%,]/g, '').trim()

async function fetchProductsPage([, pageIndex, search, categoryFilter, showInactive]: ProductsPageKey): Promise<ProductsPageResponse> {
  const from = pageIndex * PRODUCTS_PAGE_SIZE
  const to = from + PRODUCTS_PAGE_SIZE - 1
  const searchTerm = sanitizeSearchTerm(search)

  let query = supabase.from('products').select('*, category:categories(*)', { count: 'exact' }).order('name', { ascending: true }).order('variant', { ascending: true }).range(from, to)
  if (searchTerm) query = query.or(`name.ilike.%${searchTerm}%,variant.ilike.%${searchTerm}%`)
  if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter)
  if (!showInactive) query = query.eq('is_active', true)

  const { data, error, count } = await query
  if (error) throw error
  return { products: data as Product[], count: count || 0 }
}

export function useInfiniteProducts(search: string, categoryFilter: string, showInactive: boolean) {
  const swr = useSWRInfinite<ProductsPageResponse>((pageIndex, prev) => (prev && prev.products.length === 0 ? null : ['products-page', pageIndex, search, categoryFilter, showInactive]), fetchProductsPage)
  const products = useMemo(() => swr.data?.flatMap((p) => p.products) || [], [swr.data])
  const totalProducts = swr.data?.[0]?.count || 0
  const hasMoreProducts = products.length < totalProducts
  const isLoadingMoreProducts = swr.isValidating && swr.size > 0
  return { ...swr, products, totalProducts, hasMoreProducts, isLoadingMoreProducts }
}
