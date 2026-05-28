"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import useSWR, { mutate } from "swr";
import useSWRInfinite from "swr/infinite";
import { createClient } from "@/lib/supabase/client";
import {
  Product,
  PaymentMethod,
  CartItem,
  Channel,
  channelLabels,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Check as CheckIcon,
  AlertCircle,
  MessageCircleMore,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPrice, getOptimizedCloudinaryImage } from "@/utils";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";

const supabase = createClient();
const PRODUCTS_PAGE_SIZE = 10;

type ProductsPageKey = ["new-sale-products", number, string];
type ProductsPageResponse = {
  products: Product[];
  count: number;
};

const fetchProductsPage = async ([
  ,
  pageIndex,
  search,
]: ProductsPageKey): Promise<ProductsPageResponse> => {
  const from = pageIndex * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;
  const searchTerm = search.trim().replace(/[%,]/g, "");

  let query = supabase
    .from("products")
    .select("*, category:categories(*)", { count: "exact" })
    .eq("is_active", true)
    .order("name", { ascending: true })
    .order("variant", { ascending: true })
    .range(from, to);

  if (searchTerm) {
    query = query.or(
      `name.ilike.%${searchTerm}%,variant.ilike.%${searchTerm}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    products: data as Product[],
    count: count || 0,
  };
};

const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
};

export default function NewSalePage() {
  const [search, setSearch] = useState("");
  const {
    data: productsPages,
    isLoading: productsLoading,
    isValidating: productsValidating,
    size: productsPageSize,
    setSize: setProductsPageSize,
  } = useSWRInfinite<ProductsPageResponse>((pageIndex, previousPageData) => {
    if (previousPageData && previousPageData.products.length === 0) return null;
    return ["new-sale-products", pageIndex, search] as ProductsPageKey;
  }, fetchProductsPage);
  const { data: paymentMethods } = useSWR<PaymentMethod[]>(
    "payment_methods",
    fetchPaymentMethods,
  );

  const loadMoreProductsRef = useRef<HTMLDivElement | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [pointOfSale, setPointOfSale] = useState<Channel>("LOCAL");
  const [notes, setNotes] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [isDelivered, setIsDelivered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (paymentMethods && paymentMethods.length > 0 && !paymentMethodId) {
      setPaymentMethodId(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethodId]);

  const filteredProducts = useMemo(
    () => productsPages?.flatMap((page) => page.products) || [],
    [productsPages],
  );
  const totalProducts = productsPages?.[0]?.count || 0;
  const hasMoreProducts = filteredProducts.length < totalProducts;
  const isLoadingMoreProducts = productsValidating && productsPageSize > 0;

  useEffect(() => {
    const loadMoreElement = loadMoreProductsRef.current;
    if (
      !loadMoreElement ||
      !hasMoreProducts ||
      productsLoading ||
      isLoadingMoreProducts
    )
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setProductsPageSize((currentSize) => currentSize + 1);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [
    hasMoreProducts,
    isLoadingMoreProducts,
    productsLoading,
    setProductsPageSize,
  ]);

  const selectedPaymentMethod = paymentMethods?.find(
    (pm) => pm.id === paymentMethodId,
  );
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);



  const { subtotal, discount, total } = useMemo(() => {
    const sub = cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
    const discountPct = selectedPaymentMethod?.discount_pct || 0;
    const disc = sub * (discountPct / 100);
    return { subtotal: sub, discount: disc, total: sub - disc };
  }, [cart, selectedPaymentMethod]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error("No hay suficiente stock");
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty > item.product.stock) {
            toast.error("No hay suficiente stock");
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  const clearCart = () => {
    setCart([]);
    setNotes("");
    setOrderNumber("");
    setPaymentMethodId(paymentMethods?.[0]?.id || "");
    setPointOfSale("LOCAL");
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return toast.error("El carrito esta vacio");
    if (!paymentMethodId) return toast.error("Selecciona un método de pago");
    setIsSubmitting(true);
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          point_of_sale: pointOfSale,
          payment_method_id: paymentMethodId,
          notes: notes || null,
          subtotal,
          discount,
          total,
          status: isDelivered ? "DELIVERED" : "PREPARING",
          is_paid: isPaid || false,
          order_number: orderNumber || null,
        })
        .select()
        .single();
      if (saleError) throw saleError;
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total: item.product.price * item.quantity,
      }));
      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);
      if (itemsError) throw itemsError;
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock: item.product.stock - item.quantity })
          .eq("id", item.product.id);
        if (stockError) throw stockError;
      }
      toast.success("Venta registrada correctamente", {
        duration: 4000,
        position: "top-center",
        style: { color: "green" },
      });
      clearCart();
      mutate("products");
      mutate("new-sale-products");
      setIsCartOpen(false);
    } catch (error) {
      console.error("Error creating sale:", error);
      toast.error("Error al registrar la venta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cartContent = (
    <>
      <CardHeader className="border-b border-border py-0 pb-0">
        <CardTitle className="flex items-center justify-start w-full gap-2 px-0 pt-4">
          <ShoppingCart className="h-5 w-5 flex flex-row items-center" />
          Carrito
          {itemCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {itemCount} items
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Carrito vacio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm line-clamp-1">
                    {item.product.name}
                  </p>
                  {item.product.variant && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.product.variant}
                    </p>
                  )}
                  <p className="text-sm text-foreground mt-1">
                    {formatPrice(item.product.price * item.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => updateQuantity(item.product.id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => updateQuantity(item.product.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="col-span-2 flex flex-col justify-between h-full">
              <label className="text-xs text-muted-foreground mb-1 block">
                Canal *
              </label>
              <Select
                value={pointOfSale}
                onValueChange={(v) => {
                  console.log("Selected channel:", v);
                  setPointOfSale(v as Channel)
                  if (v == "LOCAL") {
                      setIsPaid(true);
                      setIsDelivered(true);
                      setOrderNumber("");
                    }else{
                      setIsPaid(false);
                      setIsDelivered(false);
                    }
                  
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(channelLabels) as Channel[]).map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channelLabels[channel]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">
                Método de Pago *
              </label>
              <Select
                value={paymentMethodId}
                onValueChange={setPaymentMethodId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}{" "}
                      {pm.discount_pct > 0 && `(-${pm.discount_pct}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block w-full">
                Orden de Compra
              </label>
              <span
                className={cn(
                  "absolute left-3 top-7.5 text-muted-foreground leading-none",
                  pointOfSale !== "WEB" && "opacity-50",
                )}
              >
                #
              </span>
              <Textarea
                placeholder="0000"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                rows={1}
                className="resize-none pl-7 min-h-0 w-20"
                disabled={pointOfSale !== "WEB"}
              />
            </div>

            <div className="flex flex-col items-center justify-between">
              <label className="text-xs text-muted-foreground mb-1 block text-center">
                Abonado
              </label>
              <Checkbox
                className={cn(
                  "h-6 w-6 border-gray-400 mb-2 opacity-80",
                  "data-[state=checked]:bg-green-500",
                  "data-[state=checked]:border-green-500",
                  "data-[state=checked]:text-white",
                )}
                checked={isPaid}
                onCheckedChange={(checked) => setIsPaid(checked === true)}  
              />
            </div>
            <div className="flex flex-col items-center justify-between">
              <label className="text-xs text-muted-foreground mb-1 block">
                Entregado
              </label>
              <Checkbox
                className={cn(
                  "h-6 w-6 border-gray-400 mb-2 opacity-80",
                  "data-[state=checked]:bg-green-500",
                  "data-[state=checked]:border-green-500",
                  "data-[state=checked]:text-white",
                )}
                checked={isDelivered}
                onCheckedChange={(checked) => setIsDelivered(checked === true)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Notas
            </label>
            <Textarea
              placeholder="Notas opcionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className="resize-none"
            />
          </div>
        </div>
        <div className="space-y-2 border-t border-border pt-4 mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-400">
              <span>Descuento ({selectedPaymentMethod?.discount_pct}%)</span>
              <span>-{formatPrice(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button
            variant="outline"
            className="flex-1"
            onClick={clearCart}
            disabled={cart.length === 0 || isSubmitting}
          >
            Limpiar
          </Button>
          <Button
            className="flex-2"
            onClick={handleSubmit}
            disabled={cart.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              "Procesando..."
            ) : (
              <>
                <CheckIcon className="h-4 w-4 mr-1" />
                Confirmar y Enviar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-1rem)] flex-col lg:flex-row gap-4 lg:gap-6">
      <div className="flex-1 flex flex-col min-w-0 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Nueva Venta
          </h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto pb-20 lg:pb-0 pr-2">
          {productsLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg bg-card animate-pulse"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-2" />
              <p>No se encontraron productos</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredProducts.map((product) => {
                  const inCart = cart.find(
                    (item) => item.product.id === product.id,
                  );
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={cn(
                        "relative p-4 rounded-lg border text-left transition-all overflow-hidden",
                        product.stock > 0
                          ? "bg-card hover:bg-accent/90 hover:border-foreground/20 cursor-pointer"
                          : "bg-card cursor-not-allowed opacity-30",
                        inCart && product.stock > 0 && "ring-2 ring-primary",
                      )}
                      disabled={product.stock === 0}
                    >
                      {inCart && (
                        <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center">
                          {inCart.quantity}
                        </Badge>
                      )}
                      <div className="mb-3 h-28 w-full overflow-hidden rounded-md bg-muted/40">
                        <img
                          src={product.image_url || "/placeholder.jpg"}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground line-clamp-1">
                          {product.name}
                        </p>
                        {product.variant && (
                          <p className="text-gray-400 text-xs">
                            {product.variant}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                          <span className="text-lg font-semibold text-foreground">
                            {formatPrice(product.price)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Stock: {product.stock}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {hasMoreProducts && (
                <>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setProductsPageSize((currentSize) => currentSize + 1)
                      }
                      disabled={isLoadingMoreProducts}
                    >
                      {isLoadingMoreProducts
                        ? "Cargando..."
                        : "Cargar más productos"}
                    </Button>
                  </div>
                  <div
                    ref={loadMoreProductsRef}
                    className="h-1"
                    aria-hidden="true"
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Card className="hidden lg:flex w-96 shrink-0 flex-col gap-0 p-0">
        {cartContent}
      </Card>

      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0">
          {cartContent}
        </SheetContent>
      </Sheet>

      <div className="fixed bottom-4 right-4 lg:hidden z-40">
        <Button onClick={() => setIsCartOpen(true)} className="shadow-lg">
          <ShoppingCart className="mr-2 h-4 w-4" /> Abrir carrito ({itemCount})
        </Button>
      </div>
    </div>
  );
}
