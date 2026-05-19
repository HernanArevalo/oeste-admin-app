import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Category, Product } from '@/lib/types'

const supabase = createClient()

const fetchCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data as Category[]
}

export const fetchAllProductsForExport = async () => {
  const { data, error } = await supabase.from('products').select('*, category:categories(*)').order('name')
  if (error) throw error
  return data as Product[]
}

export function useProducts() {
  const { data: categories } = useSWR('categories', fetchCategories)
  return { categories }
}
