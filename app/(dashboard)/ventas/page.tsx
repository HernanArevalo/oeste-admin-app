"use client";

import { ChangeEvent, useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import useSWRInfinite from "swr/infinite";
import { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import {
  Sale,
  SaleStatus,
  Channel,
  Product,
  PaymentMethod,
  ImportRow,
  SalesPageKey,
  SalesPageResponse,
  statusLabels,
  channelLabels,
} from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SalesTable } from "@/components/SalesTable";
import { Search, Filter, PlusCircle, Upload, Loader2 } from "lucide-react";
import { formatPrice } from "@/utils";
import { toast } from "sonner";

const supabase = createClient();
const SALES_PAGE_SIZE = 10;

const SALE_IMPORT_COLUMNS = {
  date: "Fecha",
  channel: "Punto de venta",
  orderNumber: "Nro Orden",
  products: "Producto",
  quantity: "Cant.",
  subtotal: "Precio",
  paymentMethod: "Método de pago",
  total: "Valor final",
  status: "Estado",
  trackingSent: "Seg.\nEnviado",
  detail: "Detalle",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getImportValue = (row: ImportRow, columnName: string) => {
  const normalizedColumnName = normalizeText(columnName);
  const matchingKey = Object.keys(row).find(
    (key) => normalizeText(key) === normalizedColumnName,
  );
  const value = matchingKey ? row[matchingKey] : undefined;
  return value === null || value === undefined ? "" : String(value).trim();
};

const parseImportNumber = (value: any, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  
  // Si Excel ya devolvió un número nativo
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : fallback;
  }

  const strValue = String(value).replace(/[$\s]/g, "").trim();
  if (!strValue) return fallback;

  // Si tiene puntos y comas (ej: "1.234,56" o "1,234.56")
  let normalized = strValue;
  if (strValue.includes(".") && strValue.includes(",")) {
    if (strValue.lastIndexOf(".") < strValue.lastIndexOf(",")) {
      // Formato latino: 1.234,56 -> 1234.56
      normalized = strValue.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato anglo: 1,234.56 -> 1234.56
      normalized = strValue.replace(/,/g, "");
    }
  } else if (strValue.includes(",")) {
    // Formato latino con decimales: 31762,5 -> 31762.5
    normalized = strValue.replace(",", ".");
  }

  const parsedValue = Number(normalized);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) / 100 : fallback;
};

const parseImportDate = (value: any) => {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }

  const strValue = String(value).trim();
  if (!strValue) return null;

  // Formato YYYY-MM-DD o ISO string
  if (strValue.includes("-") && strValue.length >= 10 && strValue.indexOf("-") === 4) {
    const parsed = new Date(strValue);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const parts = strValue.split(/[/-]/).map(Number);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year) {
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(Date.UTC(fullYear, month - 1, day, 12)).toISOString();
    }
  }

  const parsedFallback = new Date(strValue);
  return isNaN(parsedFallback.getTime()) ? null : parsedFallback.toISOString();
};

const mapImportChannel = (value: string): Channel => {
  const normalized = normalizeText(value);
  if (normalized.includes("online")) return "WEB";
  if (normalized.includes("showroom")) return "LOCAL";
  return "OTHER";
};

const mapImportStatus = (value: string): SaleStatus => {
  const normalized = normalizeText(value);
  if (normalized.includes("retirado")) return "DELIVERED";
  if (normalized.includes("despachado")) return "SHIPPED";
  if (normalized.includes("preparado") || normalized.includes("retirar")) return "READY";
  if (normalized.includes("cancel")) return "CANCELLED";
  return "PREPARING";
};

const buildProductKey = (product: Pick<Product, "name" | "variant"> | string) => {
  if (typeof product === "string") {
    return normalizeText(product);
  }
  return normalizeText([product.name, product.variant].filter(Boolean).join(" "));
};

const splitImportedProducts = (value: string) =>
  value
    .split(/\r?\n/)
    .map((productName) => productName.trim())
    .filter(Boolean);

const buildSaleFingerprint = (sale: {
  created_at: string;
  point_of_sale: Channel;
  order_number: number | null;
  payment_method_id: string;
  subtotal: number;
  total: number;
  status: SaleStatus;
  tracking_sent?: boolean;
  notes?: string | null;
  items?: { product_id: string; quantity: number; unit_price?: number; total?: number }[];
}) => {
  const items = [...(sale.items ?? [])]
    .map((item) => `${item.product_id}:${item.quantity}:${Math.round(Number(item.total ?? 0))}`)
    .sort()
    .join("|");

  return [
    sale.created_at.slice(0, 10),
    sale.point_of_sale,
    sale.order_number ?? "",
    sale.payment_method_id,
    Math.round(Number(sale.subtotal ?? 0)),
    Math.round(Number(sale.total ?? 0)),
    sale.status,
    Boolean(sale.tracking_sent),
    normalizeText(sale.notes ?? ""),
    items,
  ].join("::");
};

const fetchSalesPage = async ([
  ,
  pageIndex,
  search,
  statusFilter,
  channelFilter,
]: SalesPageKey): Promise<SalesPageResponse> => {
  const from = pageIndex * SALES_PAGE_SIZE;
  const to = from + SALES_PAGE_SIZE - 1;
  const searchTerm = search.trim();

  let query = supabase
    .from("sales")
    .select(
      "*, payment_method:payment_methods(*), items:sale_items(*, product:products(*))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (searchTerm) {
    query = query.or(
      `id.ilike.%${searchTerm}%,order_number::text.ilike.%${searchTerm}%`,
    );
  }

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (channelFilter !== "all") {
    query = query.eq("point_of_sale", channelFilter);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { sales: data as Sale[], count: count || 0 };
};

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [isImporting, setIsImporting] = useState(false);
  const loadMoreSalesRef = useRef<HTMLDivElement | null>(null);
  const importFileInput = useRef<HTMLInputElement | null>(null);

  const {
    data: salesPages,
    isLoading,
    isValidating,
    size: salesPageSize,
    setSize: setSalesPageSize,
  } = useSWRInfinite<SalesPageResponse>((pageIndex, previousPageData) => {
    if (previousPageData && previousPageData.sales.length === 0) return null;
    return [
      "sales-page",
      pageIndex,
      search,
      statusFilter,
      channelFilter,
    ] as SalesPageKey;
  }, fetchSalesPage);

  const filteredSales = useMemo(
    () => salesPages?.flatMap((page) => page.sales) || [],
    [salesPages],
  );
  const totalSales = salesPages?.[0]?.count || 0;
  const hasMoreSales = filteredSales.length < totalSales;
  const isLoadingMoreSales = isValidating && salesPageSize > 0;

  const handleImportSales = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ImportRow>(worksheet, { defval: "" });

      if (!rows.length) {
        toast.error("El archivo no tiene ventas para importar");
        return;
      }

      const [
        { data: products, error: productsError },
        { data: paymentMethods, error: paymentMethodsError },
        { data: existingSales, error: existingSalesError },
      ] = await Promise.all([
        supabase.from("products").select("id, name, variant, price, stock, is_active"),
        supabase.from("payment_methods").select("*"),
        supabase.from("sales").select("*, items:sale_items(product_id, quantity, unit_price, total)"),
      ]);

      if (productsError) throw productsError;
      if (paymentMethodsError) throw paymentMethodsError;
      if (existingSalesError) throw existingSalesError;

      const productsByKey = new Map((products as Product[]).map((product) => [buildProductKey(product), product]));
      const paymentMethodsByName = new Map((paymentMethods as PaymentMethod[]).map((method) => [normalizeText(method.name), method]));
      const fingerprints = new Set((existingSales as Sale[]).map((sale) => buildSaleFingerprint(sale)));
      const importedFingerprints = new Set<string>();
      const unmatchedProducts = new Set<string>();
      const salesToInsert: Array<Omit<Sale, "id" | "receipt_image_url" | "receipt_uploaded_at" | "seller_id" | "seller_name" | "customer" | "shipping" | "payment_method" | "items"> & { items: { product_id: string; quantity: number; unit_price: number; total: number }[] }> = [];
      let skippedDuplicates = 0;
      let skippedInvalid = 0;

      for (const row of rows) {
        const rawDate = row[SALE_IMPORT_COLUMNS.date] || getImportValue(row, SALE_IMPORT_COLUMNS.date);
        const createdAt = parseImportDate(rawDate);
        const productNames = splitImportedProducts(getImportValue(row, SALE_IMPORT_COLUMNS.products));
        const paymentMethod = paymentMethodsByName.get(normalizeText(getImportValue(row, SALE_IMPORT_COLUMNS.paymentMethod)));

        if (!createdAt || !productNames.length || !paymentMethod) {
          skippedInvalid += 1;
          continue;
        }

        const quantity = parseImportNumber(getImportValue(row, SALE_IMPORT_COLUMNS.quantity), productNames.length) || productNames.length;
        const subtotal = parseImportNumber(getImportValue(row, SALE_IMPORT_COLUMNS.subtotal));
        const total = parseImportNumber(getImportValue(row, SALE_IMPORT_COLUMNS.total));
        const orderNumber = parseImportNumber(getImportValue(row, SALE_IMPORT_COLUMNS.orderNumber), NaN);

        const items = productNames.map((productName) => {
          const product = productsByKey.get(buildProductKey(productName));
          if (!product) unmatchedProducts.add(productName);
          const itemQuantity = productNames.length === 1 ? quantity : 1;
          const unitPrice = subtotal && quantity ? Math.round(subtotal / quantity) : Number(product?.price ?? 0);
          return product ? { product_id: product.id, quantity: itemQuantity, unit_price: unitPrice, total: unitPrice * itemQuantity } : null;
        });

        if (items.some((item) => item === null)) {
          skippedInvalid += 1;
          continue;
        }

        const saleToInsert = {
          created_at: createdAt,
          point_of_sale: mapImportChannel(getImportValue(row, SALE_IMPORT_COLUMNS.channel)),
          order_number: Number.isFinite(orderNumber) ? orderNumber : null,
          payment_method_id: paymentMethod.id,
          subtotal,
          discount: Math.max(subtotal - total, 0),
          total,
          status: mapImportStatus(getImportValue(row, SALE_IMPORT_COLUMNS.status)),
          tracking_sent: normalizeText(getImportValue(row, SALE_IMPORT_COLUMNS.trackingSent)) === "true" || getImportValue(row, SALE_IMPORT_COLUMNS.trackingSent) === "1",
          notes: getImportValue(row, SALE_IMPORT_COLUMNS.detail) || null,
          is_paid: total > 0 && normalizeText(paymentMethod.name) !== "en espera",
          items: items as { product_id: string; quantity: number; unit_price: number; total: number }[],
        };

        const fingerprint = buildSaleFingerprint(saleToInsert);
        if (fingerprints.has(fingerprint) || importedFingerprints.has(fingerprint)) {
          skippedDuplicates += 1;
          continue;
        }
        importedFingerprints.add(fingerprint);
        salesToInsert.push(saleToInsert);
      }

      if (!salesToInsert.length) {
        toast.warning(`No se importaron ventas nuevas. Duplicadas: ${skippedDuplicates}. Inválidas: ${skippedInvalid}.`);
        if (unmatchedProducts.size) console.warn("Productos no encontrados", [...unmatchedProducts]);
        return;
      }

      const { data: insertedSales, error: salesError } = await supabase
        .from("sales")
        .insert(salesToInsert.map(({ items, ...sale }) => sale))
        .select("id");
      if (salesError) throw salesError;

      const saleItems = insertedSales.flatMap((sale, index) =>
        salesToInsert[index].items.map((item) => ({ ...item, sale_id: sale.id })),
      );
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      
      await mutate((key) => Array.isArray(key) && key[0] === "sales-page");
      toast.success(`Se importaron ${insertedSales.length} ventas nuevas. Duplicadas: ${skippedDuplicates}. Inválidas: ${skippedInvalid}.`);
      console.log("Productos no encontrados:", unmatchedProducts);
      if (unmatchedProducts.size) toast.warning(`${unmatchedProducts.size} productos no se pudieron ligar. Revisá la consola.`);
    } catch (error) {
      console.error("Error importing sales:", error);
      toast.error("Error al importar ventas");
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    const loadMoreElement = loadMoreSalesRef.current;
    if (!loadMoreElement || !hasMoreSales || isLoading || isLoadingMoreSales)
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setSalesPageSize((currentSize) => currentSize + 1);
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [hasMoreSales, isLoading, isLoadingMoreSales, setSalesPageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Ventas</h1>
        <div className="flex items-center gap-2">
          <input
            ref={importFileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportSales}
          />
          <Button
            variant="outline"
            onClick={() => importFileInput.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? <Loader2 className="animate-spin" /> : <Upload />}
            {isImporting ? "Importando..." : "Importar"}
          </Button>
          <Link href="/">
            <Button>
              <PlusCircle />
              Nueva Venta
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID o numero de orden..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as SaleStatus | "all")}
        >
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.keys(statusLabels) as SaleStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={channelFilter}
          onValueChange={(v) => setChannelFilter(v as Channel | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {(Object.keys(channelLabels) as Channel[]).map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channelLabels[channel]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <SalesTable isLoading={isLoading} sales={filteredSales} />

      {/* Stats */}
      {!isLoading && filteredSales.length > 0 && (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mostrando {filteredSales.length} de {totalSales} ventas encontradas
          </span>
          <span>
            Total:{" "}
            {formatPrice(
              filteredSales.reduce((sum, sale) => sum + sale.total, 0),
            )}
          </span>
        </div>
      )}
      {hasMoreSales && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSalesPageSize((currentSize) => currentSize + 1)}
            disabled={isLoadingMoreSales}
          >
            {isLoadingMoreSales ? "Cargando..." : "Cargar más ventas"}
          </Button>
          <div ref={loadMoreSalesRef} className="h-1" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}