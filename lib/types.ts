// Database types for Oeste Gafas

export type Channel = 'LOCAL' | 'WEB' | 'OTHER'
export type SaleStatus = 'PENDING' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface PaymentMethod {
  id: string
  name: string
  discount_pct: number
  created_at: string
}

export interface Product {
  id: string
  name: string
  variant: string | null
  price: number
  stock: number
  image_url: string | null
  is_active: boolean
  category_id: string | null
  category?: Category | null
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  order_number: number | null
  point_of_sale: Channel
  status: SaleStatus
  tracking_sent: boolean
  notes: string | null
  payment_method_id: string
  payment_method?: PaymentMethod
  subtotal: number
  discount: number
  total: number
  receipt_image_url: string | null
  receipt_uploaded_at: string | null
  created_at: string
  items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  total: number
}

// Form types
export interface ProductFormData {
  name: string
  variant: string | null
  price: number
  stock: number
  image_url: string | null
  is_active: boolean
  category_id: string | null
}

export interface SaleFormData {
  order_number: number | null
  point_of_sale: Channel
  status: SaleStatus
  notes: string | null
  payment_method_id: string
  items: {
    product_id: string
    quantity: number
  }[]
}

// Table state for dirty tracking
export interface ProductRowState extends Product {
  isDirty?: boolean
  originalData?: Product
}

// Status labels in Spanish
export const statusLabels: Record<SaleStatus, string> = {
  PENDING: 'Pendiente',
  READY_FOR_PICKUP: 'Listo para Retirar',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export const channelLabels: Record<Channel, string> = {
  LOCAL: 'Local',
  WEB: 'Web',
  OTHER: 'Otro',
}

export const statusColors: Record<SaleStatus, string> = {
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  READY_FOR_PICKUP: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SHIPPED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DELIVERED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

// Cart item for new sale
export interface CartItem {
  product: Product
  quantity: number
}
