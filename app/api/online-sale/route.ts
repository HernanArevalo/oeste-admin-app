import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, Product, Sale } from "@/interfaces";

const onlineSaleProductSchema = z.object({
  quantity: z.number().int().positive(),
  title: z.string().trim().min(1),
  price: z.number().nonnegative(),
  SKU: z.string().trim().nullable().optional(),
});

const onlineSaleSchema = z.object({
  order: z.object({
    number: z.union([z.string().trim().min(1), z.number().int().positive()]),
    paymentMethod: z.string().trim().min(1),
    paymentStatus: z.string().trim().min(1),
    subtotal: z.number().nonnegative(),
    shippingCost: z.number().nonnegative().nullable().optional(),
    total: z.number().nonnegative(),
    products: z.array(onlineSaleProductSchema).min(1),
  }),
  customer: z
    .object({
      firstName: z.string().trim().nullable().optional(),
      lastName: z.string().trim().nullable().optional(),
      fullName: z.string().trim().nullable().optional(),
      email: z.string().trim().email().nullable().optional(),
      phone: z.string().trim().nullable().optional(),
      dni: z.string().trim().nullable().optional(),
    })
    .optional(),
  shipping: z.unknown().optional(),
  metadata: z.unknown().optional(),
});

const onlineSalesSchema = z.union([
  onlineSaleSchema,
  z.array(onlineSaleSchema).min(1),
]);

type OnlineSaleInput = z.infer<typeof onlineSaleSchema>;
type OnlineSaleProductInput = z.infer<typeof onlineSaleProductSchema>;
type ProductLookup = Pick<
  Product,
  "id" | "name" | "variant" | "price" | "stock" | "is_active"
>;

function getRequestApiKey(request: NextRequest) {
  const headerApiKey = request.headers.get("x-api-key");
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return headerApiKey?.trim();
}

function jsonError(message: string, status: number, data?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      message,
      data: data ?? null,
    },
    { status },
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getProductTitle(product: ProductLookup) {
  return [product.name, product.variant].filter(Boolean).join(" - ");
}

function findProductByTitle(
  products: ProductLookup[],
  item: OnlineSaleProductInput,
) {
  const normalizedTitle = normalize(item.title);

  return products.find((product) => {
    const fullTitle = normalize(getProductTitle(product));
    const productName = normalize(product.name);

    return fullTitle === normalizedTitle || productName === normalizedTitle;
  });
}

function isPaid(paymentStatus: string) {
  return !["pendiente", "pending", "no pagado", "unpaid"].includes(
    normalize(paymentStatus),
  );
}

function buildNotes(saleInput: OnlineSaleInput) {
  return JSON.stringify(
    {
      source: "online-sale-api",
      customer: saleInput.customer ?? null,
      shipping: saleInput.shipping ?? null,
      metadata: saleInput.metadata ?? null,
      paymentStatus: saleInput.order.paymentStatus,
      shippingCost: saleInput.order.shippingCost ?? null,
    },
    null,
    2,
  );
}

export async function POST(request: NextRequest) {
  const expectedApiKey = process.env.API_KEY;
  const requestApiKey = getRequestApiKey(request);

  if (!expectedApiKey) {
    return jsonError("API_KEY is not configured", 500);
  }

  if (!requestApiKey || requestApiKey !== expectedApiKey) {
    return jsonError("Invalid API key", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const validation = onlineSalesSchema.safeParse(body);
  if (!validation.success) {
    return jsonError(
      "Invalid online sale data",
      400,
      validation.error.flatten(),
    );
  }

  const salesInput = Array.isArray(validation.data)
    ? validation.data
    : [validation.data];
  const supabase = createAdminClient();
  const createdSaleIds: string[] = [];
  const updatedStockItems: { productId: string; stock: number }[] = [];

  try {

    const createdSales: Sale[] = [];

    for (const saleInput of salesInput) {
      const paymentMethodName =
        saleInput.order.paymentMethod.charAt(0).toUpperCase() +
        saleInput.order.paymentMethod.slice(1).toLowerCase();

      const { data: paymentMethod, error: paymentMethodError } = await supabase
        .from("payment_methods")
        .select("id, name")
        .eq("name", paymentMethodName)
        .maybeSingle<{ id: string; name: string }>();

      if (paymentMethodError) throw paymentMethodError;
      if (!paymentMethod) {
        return jsonError(
          `Payment method ${saleInput.order.paymentMethod} not found`,
          404,
        );
      }

      const productIds = saleInput.order.products
        .map((item) => item.SKU)
        .filter(Boolean);

      const { data: matchedProducts, error: matchedProductsError } =
        await supabase
          .from("products")
          .select("id, name, variant, price, stock, is_active")
          .in("id", productIds)
          .returns<ProductLookup[]>();

      if (matchedProductsError) throw matchedProductsError;

      const productsById = new Map(
        matchedProducts?.map((product) => [product.id, product]) ?? [],
      );

      const matchedItems = saleInput.order.products.map((item) => ({
        input: item,
        product: item.SKU ? productsById.get(item.SKU) : undefined,
      }));
      const invalidItems = matchedItems.flatMap(({ input, product }) => {
        if (!product) return [`Product ${input.title} was not found`];
        if (product.stock < input.quantity) {
          return [
            `Product ${getProductTitle(product)} has insufficient stock (${product.stock})`,
          ];
        }
        return [];
      });

      if (invalidItems.length > 0) {
        return jsonError("Invalid online sale items", 400, invalidItems);
      }

      const orderNumber = Number(saleInput.order.number);
      const shippingCost = saleInput.order.shippingCost ?? 0;
      const discount = Math.max(
        saleInput.order.subtotal + shippingCost - saleInput.order.total,
        0,
      );

      const { data: existingSale } = await supabase
        .from("sales")
        .select("id")
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (existingSale) {
        return jsonError(`Order ${orderNumber} already exists`, 409);
      }

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          order_number: Number.isFinite(orderNumber) ? orderNumber : null,
          point_of_sale: "WEB",
          status: "PREPARING",
          // notes: buildNotes(saleInput),
          payment_method_id: paymentMethod.id,
          subtotal: saleInput.order.subtotal,
          discount,
          total: saleInput.order.shippingCost? saleInput.order.total - saleInput.order.shippingCost : saleInput.order.total,
          is_paid: isPaid(saleInput.order.paymentStatus),
        })
        .select("*")
        .single<Sale>();

      if (saleError) throw saleError;
      createdSaleIds.push(sale.id);

      const saleItems = matchedItems.map(({ input, product }) => ({
        sale_id: sale.id,
        product_id: product?.id,
        quantity: input.quantity,
        unit_price: Number(product?.price ?? input.price),
        total: Number(product?.price ?? input.price) * input.quantity,
      }));

      const { error: saleItemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);
      if (saleItemsError) throw saleItemsError;

      for (const { input, product } of matchedItems) {
        if (!product) {
          return [
            `Product with SKU ${input.SKU ?? 'undefined'} was not found`,
          ]
        }

        const { data: updatedProducts, error: stockError } = await supabase
          .from("products")
          .update({ stock: product.stock - input.quantity })
          .eq("id", product.id)
          .gte("stock", input.quantity)
          .select("id");

        if (stockError) throw stockError;
        if (!updatedProducts || updatedProducts.length === 0) {
          throw new Error(`Insufficient stock for product ${product.id}`);
        }

        updatedStockItems.push({
          productId: product.id,
          stock: product.stock,
        });
        product.stock -= input.quantity;
      }

      const { data: saleWithRelations, error: fetchSaleError } = await supabase
        .from("sales")
        .select(
          "*, payment_method:payment_methods(*), items:sale_items(*, product:products(*))",
        )
        .eq("id", sale.id)
        .single<Sale>();

      if (fetchSaleError) throw fetchSaleError;
      createdSales.push(saleWithRelations);
    }

    return NextResponse.json<ApiResponse<Sale[]>>(
      {
        ok: true,
        message: "Online sale created successfully",
        data: createdSales,
      },
      { status: 201 },
    );
  } catch (error) {
    await Promise.all(
      updatedStockItems.map((item) =>
        supabase
          .from("products")
          .update({ stock: item.stock })
          .eq("id", item.productId),
      ),
    );

    if (createdSaleIds.length > 0) {
      await supabase.from("sales").delete().in("id", createdSaleIds);
    }

    console.error("Error creating online sale:", error);
    return jsonError("Error creating online sale", 500);
  }
}
