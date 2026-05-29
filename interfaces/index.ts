// Domain and API types for Oeste Gafas

export type Channel = 'LOCAL' | 'WEB' | 'OTHER'
export type SaleStatus = 'PREPARING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

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

export interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  updated_at: string
  image_url: string | null
  is_active: boolean
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
  is_paid: boolean
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

export interface NewSaleItemInput {
  product_id: string
  quantity: number
}

export interface NewSaleRequestBody {
  order_number?: number | null
  point_of_sale?: Channel
  status?: SaleStatus
  notes?: string | null
  payment_method_id: string
  is_paid?: boolean
  items: NewSaleItemInput[]
}

export interface NewSaleResponse {
  sale: Sale
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
  items: NewSaleItemInput[]
}

// Table state for dirty tracking
export interface ProductRowState extends Product {
  isDirty?: boolean
  originalData?: Product
}


export type ImportRow = Record<string, string | number | boolean | null | undefined>

export type ProductsPageKey = ['products-page', number, string, string, boolean]

export interface ProductsPageResponse {
  products: Product[]
  count: number
}

export type NewSaleProductsPageKey = ['new-sale-products', number, string]

export interface NewSaleProductsPageResponse {
  products: Product[]
  count: number
}

export type SalesPageKey = ['sales-page', number, string, SaleStatus | 'all', Channel | 'all']

export interface SalesPageResponse {
  sales: Sale[]
  count: number
}

export interface UserRowState extends User {
  isDirty: boolean
  originalData: User
}

export interface SalesTableProps {
  sales: Sale[]
  isLoading: boolean
}

export interface UploadReceiptPageProps {
  params: Promise<{ id: string }>
}

// Status labels in Spanish
export const statusLabels: Record<SaleStatus, string> = {
  PREPARING: 'Preparando',
  READY: 'Listo',
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
  PREPARING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  READY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SHIPPED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DELIVERED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

// Cart item for new sale
export interface CartItem {
  product: Product
  quantity: number
}
