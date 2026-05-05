"use client";

import { Fragment, useCallback, useState } from "react";
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
import { Search, Eye, Calendar, Filter } from "lucide-react";
import Link from "next/link";
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Metodo de Pago</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <div className="h-10 bg-secondary/50 animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : sales.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center py-12 text-muted-foreground"
              >
                No se encontraron ventas
              </TableCell>
            </TableRow>
          ) : (
            sales.map((sale) => {
              const isExpanded = expandedSales.has(sale.id);
              const saleDate = new Date(sale.created_at);

              return (
                <Fragment key={sale.id}>
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/ventas/${sale.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleSale(sale.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                        aria-label={
                          isExpanded ? "Ocultar productos" : "Mostrar productos"
                        }
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="leading-tight">
                        <p>{dateFormatter.format(saleDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {timeFormatter.format(saleDate)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="leading-tight">
                        <p className="font-mono text-xs text-muted-foreground">
                          {sale.id.slice(0, 8)}...
                        </p>
                        <p className="font-mono text-sm text-white">#3456</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {channelLabels[sale.point_of_sale]}
                      </Badge>
                    </TableCell>
                    <TableCell>{sale.payment_method?.name}</TableCell>
                    <TableCell>
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
                      <>
                        <TableRow className="w-full mx-auto">
                          <TableHead colSpan={3}>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Precio unitario</TableHead>
                          <TableHead>Subtotal</TableHead>
                        </TableRow>
                        {sale.items && sale.items.length > 0 ? (
                          <>
                            {sale.items.map((item) => (
                              <TableRow className="" key={item.id}>
                                <TableCell
                                  colSpan={3}
                                  className="flex flex-row gap-2 items-center"
                                >
                                  <div className="group relative h-10 w-10 overflow-hidden rounded-md border border-border bg-muted/40">
                                    <img
                                      src={
                                        item.product?.image_url ||
                                        "/placeholder.jpg"
                                      }
                                      alt={item.product?.name}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span>
                                      {item.product?.name ??
                                        "Producto sin nombre"}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {item.product?.variant ?? "-"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.quantity}
                                </TableCell>
                                <TableCell>
                                  {formatPrice(item.unit_price)}
                                </TableCell>
                                <TableCell>
                                  {formatPrice(item.quantity * item.unit_price)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        ) : (
                          <p className="py-2 text-sm text-muted-foreground">
                            Esta venta no tiene productos cargados.
                          </p>
                        )}
                      </>
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
