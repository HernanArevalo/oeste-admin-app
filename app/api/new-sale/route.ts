import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ApiResponse, NewSaleRequestBody, NewSaleResponse, Product, Sale } from '@/interfaces'

const channelSchema = z.enum(['LOCAL', 'WEB', 'OTHER'])
const saleStatusSchema = z.enum(['PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'])



const newSaleSchema = z.object({
  order_number: z.number().int().positive().nullable().optional(),
  point_of_sale: channelSchema.default('OTHER'),
  status: saleStatusSchema.default('PREPARING'),
  notes: z.string().trim().max(1000).nullable().optional(),
  payment_method_id: z.string().uuid(),
  is_paid: z.boolean().default(false),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
}) satisfies z.ZodType<NewSaleRequestBody>

function getRequestApiKey(request: NextRequest) {
  const headerApiKey = request.headers.get('x-api-key')
  const authorization = request.headers.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim()
  }

  return headerApiKey?.trim()
}

function jsonError(message: string, status: number, data?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      message,
      data: data ?? null,
    },
    { status },
  )
}

export async function POST(request: NextRequest) {
  const expectedApiKey = process.env.API_KEY
  const requestApiKey = getRequestApiKey(request)

  if (!expectedApiKey) {
    return jsonError('API_KEY is not configured', 500)
  }

  if (!requestApiKey || requestApiKey !== expectedApiKey) {
    return jsonError('Invalid API key', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const validation = newSaleSchema.safeParse(body)
  if (!validation.success) {
    return jsonError('Invalid sale data', 400, validation.error.flatten())
  }

  const saleInput = validation.data
  const supabase = createAdminClient()
  let createdSaleId: string | null = null
  const updatedStockItems: { productId: string; stock: number }[] = []

  try {
    const { data: paymentMethod, error: paymentMethodError } = await supabase
      .from('payment_methods')
      .select('id, discount_pct')
      .eq('id', saleInput.payment_method_id)
      .maybeSingle<{ id: string; discount_pct: number }>()

    if (paymentMethodError) throw paymentMethodError
    if (!paymentMethod) return jsonError('Payment method not found', 404)

    const productIds = [...new Set(saleInput.items.map((item) => item.product_id))]
    if (productIds.length !== saleInput.items.length) {
      return jsonError('Duplicate products are not allowed in the same sale', 400)
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, stock, is_active')
      .in('id', productIds)
      .returns<Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'is_active'>[]>()

    if (productsError) throw productsError

    const productsById = new Map(products?.map((product) => [product.id, product]) ?? [])
    const invalidItems = saleInput.items.flatMap((item) => {
      const product = productsById.get(item.product_id)
      if (!product) return [`Product ${item.product_id} was not found`]
      if (!product.is_active) return [`Product ${product.name} is inactive`]
      if (product.stock < item.quantity) {
        return [`Product ${product.name} has insufficient stock (${product.stock})`]
      }
      return []
    })

    if (invalidItems.length > 0) {
      return jsonError('Invalid sale items', 400, invalidItems)
    }

    const subtotal = saleInput.items.reduce((sum, item) => {
      const product = productsById.get(item.product_id)
      return sum + Number(product?.price ?? 0) * item.quantity
    }, 0)
    const discount = subtotal * (Number(paymentMethod.discount_pct ?? 0) / 100)
    const total = subtotal - discount

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        order_number: saleInput.order_number ?? null,
        point_of_sale: saleInput.point_of_sale,
        status: saleInput.status,
        notes: saleInput.notes ?? null,
        payment_method_id: saleInput.payment_method_id,
        subtotal,
        discount,
        total,
        is_paid: saleInput.is_paid,
      })
      .select('*')
      .single<Sale>()

    if (saleError) throw saleError
    createdSaleId = sale.id

    const saleItems = saleInput.items.map((item) => {
      const product = productsById.get(item.product_id)
      const unitPrice = Number(product?.price ?? 0)

      return {
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total: unitPrice * item.quantity,
      }
    })

    const { error: saleItemsError } = await supabase.from('sale_items').insert(saleItems)
    if (saleItemsError) throw saleItemsError

    for (const item of saleInput.items) {
      const product = productsById.get(item.product_id)
      const { data: updatedProducts, error: stockError } = await supabase
        .from('products')
        .update({ stock: Number(product?.stock ?? 0) - item.quantity })
        .eq('id', item.product_id)
        .gte('stock', item.quantity)
        .select('id')

      if (stockError) throw stockError
      if (!updatedProducts || updatedProducts.length === 0) {
        throw new Error(`Insufficient stock for product ${item.product_id}`)
      }

      updatedStockItems.push({
        productId: item.product_id,
        stock: Number(product?.stock ?? 0),
      })
    }

    // enviar venta por telegram aqui

    const { data: saleWithRelations, error: fetchSaleError } = await supabase
      .from('sales')
      .select('*, payment_method:payment_methods(*), items:sale_items(*, product:products(*))')
      .eq('id', sale.id)
      .single<Sale>()

    if (fetchSaleError) throw fetchSaleError

return NextResponse.json<ApiResponse<Sale>>(
  {
    ok: true,
    message: 'Sale created successfully',
    data: saleWithRelations,
  },
  { status: 201 },
)
  } catch (error) {
    await Promise.all(
      updatedStockItems.map((item) =>
        supabase.from('products').update({ stock: item.stock }).eq('id', item.productId),
      ),
    )

    if (createdSaleId) {
      await supabase.from('sales').delete().eq('id', createdSaleId)
    }

    console.error('Error creating external sale:', error)
    return jsonError('Error creating sale', 500)
  }
}
