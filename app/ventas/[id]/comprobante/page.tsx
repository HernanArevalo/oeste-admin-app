"use client";

import { useState, useCallback, use } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Loader2,
  Package,
  Receipt,
  Truck,
  User,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import type { Sale, UploadReceiptPageProps } from "@/interfaces";
import { createClient } from "@/lib/supabase/client";
import useSWR from "swr";


type SaleNotes = {
  customer?: {
    firstName?: string | null
    lastName?: string | null
    fullName?: string | null
    email?: string | null
    phone?: string | null
    dni?: string | null
  } | null
  shipping?: Record<string, unknown> | null
  shippingCost?: number | null
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

function parseSaleNotes(notes?: string | null): SaleNotes | null {
  if (!notes) return null

  try {
    return JSON.parse(notes) as SaleNotes
  } catch {
    return null
  }
}

function getCustomerName(customer?: SaleNotes["customer"]) {
  if (!customer) return "No informado"
  return (
    customer.fullName ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    "No informado"
  )
}

function getShippingMethod(shipping?: SaleNotes["shipping"]) {
  if (!shipping) return "No informado"

  const method =
    shipping.method ||
    shipping.methodName ||
    shipping.shippingMethod ||
    shipping.shipping_method ||
    shipping.name ||
    shipping.type ||
    shipping.option

  return typeof method === "string" && method.trim() ? method : "No informado"
}

const supabase = createClient()

const fetcher = async (id: string) => {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*, payment_method:payment_methods(*), items:sale_items(*, product:products(*))')
    .eq('id', id)
    .single()

  if (saleError) throw saleError
  return { ...sale } as Sale 
}

export default function UploadReceiptPage({ params }: UploadReceiptPageProps) {
  const { id } = use(params);
  const { data: sale, isLoading } = useSWR(id, fetcher)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("saleId", id);

      const response = await fetch("/api/cloudinary/comprobante", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al subir el archivo");
      }

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          receipt_image_url: data.url,
          receipt_uploaded_at: new Date().toISOString(),
        })
        .eq('id', id)
  
      if (updateError) {
        console.error('Error updating sale:', updateError)
        throw new Error('Error al actualizar la venta')
      }
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al subir el archivo",
      );
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  if (success || sale?.receipt_image_url) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-100 mb-2">
              Comprobante Subido
            </h2>
            <p className="text-zinc-400">
              Tu comprobante de pago ha sido recibido exitosamente. Gracias por
              tu compra.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-WH2awBxTYepKe5jWtWZLgHJ31IYZ8G.png"
              alt="Oeste Gafas"
              width={120}
              height={40}
              className="invert"
            />
          </div>
          <CardTitle className="text-zinc-100">Subir Comprobante</CardTitle>
          <CardDescription className="text-zinc-400">
            Sube una foto de tu comprobante de pago para confirmar tu pedido
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando datos de la venta...
            </div>
          ) : sale ? (
            <SaleSummary sale={sale} />
          ) : null}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!file ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${
                  isDragActive
                    ? "border-zinc-500 bg-zinc-800/50"
                    : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30"
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <Upload className="w-6 h-6 text-zinc-400" />
              </div>
              {isDragActive ? (
                <p className="text-zinc-300">Suelta la imagen aquí...</p>
              ) : (
                <>
                  <p className="text-zinc-300 mb-1">
                    Arrastra una imagen aquí o haz clic para seleccionar
                  </p>
                  <p className="text-zinc-500 text-sm">
                    JPG, PNG, WebP o HEIC (máximo 10MB)
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-zinc-800">
                {preview ? (
                  <Image
                    src={preview}
                    alt="Vista previa"
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Cambiar
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Subir Comprobante
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SaleSummary({ sale }: { sale: Sale }) {
  const notes = parseSaleNotes(sale.notes)
  const customer = notes?.customer
  const shippingMethod = getShippingMethod(notes?.shipping)

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Pedido</p>
          <h3 className="text-lg font-semibold text-zinc-100">
            {sale.order_number ? `#${sale.order_number}` : "Sin número"}
          </h3>
        </div>
        <div className="rounded-full bg-zinc-800 p-2">
          <Receipt className="h-5 w-5 text-zinc-300" />
        </div>
      </div>

      <div className="grid gap-3 text-sm">
        <InfoRow icon={User} label="Cliente" value={getCustomerName(customer)} />
        <InfoRow icon={CreditCard} label="Método de pago" value={sale.payment_method?.name ?? "No informado"} />
        <InfoRow icon={Truck} label="Método de envío" value={shippingMethod} />
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Package className="h-4 w-4" />
          Productos
        </div>
        <div className="space-y-2">
          {sale.items && sale.items.length > 0 ? (
            sale.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 text-sm">
                <div className="min-w-0 text-zinc-300">
                  <p className="truncate">
                    {item.product?.name ?? "Producto"}
                    {item.product?.variant ? ` - ${item.product.variant}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.quantity} x {formatPrice(Number(item.unit_price))}
                  </p>
                </div>
                <span className="shrink-0 text-zinc-200">{formatPrice(Number(item.total))}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No hay productos cargados.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-4 text-base font-semibold text-zinc-100">
        <span>Total final</span>
        <span>{formatPrice(Number(sale.total))}</span>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate text-zinc-200">{value}</p>
      </div>
    </div>
  )
}
