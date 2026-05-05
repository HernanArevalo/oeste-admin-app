"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/utils";
import { Sale, statusLabels, channelLabels, statusColors } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  sales: Sale[];
  isLoading: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function SalesTable({ isLoading, sales }: Props) {
  const router = useRouter();
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  const toggleSale = (saleId: string) => {
    setExpandedSales((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table className="min-w-[900px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center"></TableHead>
            <TableHead className="w-32 text-center">Fecha</TableHead>
            <TableHead className="w-36 text-center">ID</TableHead>
            <TableHead className="w-28 text-center">Canal</TableHead>
            <TableHead className="w-40 text-center">Método de Pago</TableHead>
            <TableHead className="w-40 text-center">Estado</TableHead>
            <TableHead className="w-32 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <div className="h-10 rounded bg-secondary/50 animate-pulse" />
                </TableCell>
              </TableRow>
            ))
          ) : sales.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-12 text-center text-muted-foreground"
              >
                No se encontraron ventas
              </TableCell>
            </TableRow>
          ) : (
            sales.map((sale) => {
              const isExpanded = expandedSales.has(sale.id);
              const saleDate = new Date(sale.created_at);
              const saleItems = [...(sale.items ?? [])].sort((a, b) =>
                (a.product?.name ?? "Producto sin nombre").localeCompare(
                  b.product?.name ?? "Producto sin nombre",
                  "es",
                ),
              );

              return (
                <Fragment key={sale.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => router.push(`/ventas/${sale.id}`)}
                  >
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSale(sale.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                        aria-label={
                          isExpanded ? "Ocultar productos" : "Mostrar productos"
                        }
                        aria-expanded={isExpanded}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="leading-tight">
                        <p>{dateFormatter.format(saleDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {timeFormatter.format(saleDate)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="leading-tight">
                        <p className="font-mono text-xs text-muted-foreground">
                          {sale.id.slice(0, 8)}...
                        </p>
                        <p className="font-mono text-sm text-foreground">
                          {sale.order_number != null ? `#${sale.order_number}` : "Sin orden"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {channelLabels[sale.point_of_sale]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="truncate" title={sale.payment_method?.name ?? "-"}>
                        {sale.payment_method?.name ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn("border", statusColors[sale.status])}
                      >
                        {statusLabels[sale.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(sale.total)}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={7} className="px-4 py-4">
                        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-background/70">
                          <table className="w-full table-fixed text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="w-[46%] px-4 py-3 text-left font-medium">
                                  Producto
                                </th>
                                <th className="w-[18%] px-4 py-3 text-center font-medium">
                                  Cantidad
                                </th>
                                <th className="w-[18%] px-4 py-3 text-right font-medium">
                                  Precio unitario
                                </th>
                                <th className="w-[18%] px-4 py-3 text-right font-medium">
                                  Subtotal
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {saleItems.length > 0 ? (
                                saleItems.map((item) => (
                                  <tr
                                    className="border-b border-border/70 last:border-0"
                                    key={item.id}
                                  >
                                    <td className="px-4 py-3 align-middle">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
                                          <img
                                            src={
                                              item.product?.image_url ||
                                              "/placeholder.jpg"
                                            }
                                            alt={
                                              item.product?.name ??
                                              "Producto sin nombre"
                                            }
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                        <div className="min-w-0 leading-tight">
                                          <p className="truncate font-medium text-foreground">
                                            {item.product?.name ??
                                              "Producto sin nombre"}
                                          </p>
                                          <p className="truncate text-xs text-muted-foreground">
                                            {item.product?.variant ?? "Sin variante"}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center align-middle">
                                      {item.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-right align-middle">
                                      {formatPrice(item.unit_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right align-middle font-medium">
                                      {formatPrice(item.total)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                                  >
                                    Esta venta no tiene productos cargados.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
