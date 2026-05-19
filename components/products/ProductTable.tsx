import { memo, useMemo, useState } from "react";
import { Product, Category } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductRow } from "./ProductRow";

const ROW_HEIGHT = 72;
const OVERSCAN = 8;

type Props = {
  products: Product[];
  categories: Category[];
  editedProducts: Map<string, any>;
  uploadingImage: string | null;
  onChange: (id: string, field: keyof Product, value: unknown) => void;
  onPickImage: (product: Product) => void;
};

function TableComp({
  products,
  categories,
  editedProducts,
  uploadingImage,
  onChange,
  onPickImage,
}: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = 640;
  const totalHeight = products.length * ROW_HEIGHT;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(
    products.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visible = useMemo(
    () => products.slice(start, end),
    [products, start, end],
  );

  return (
    <div
      className="max-h-[640px] overflow-auto"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Imagen</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Variante</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell
              colSpan={7}
              style={{ height: start * ROW_HEIGHT, padding: 0 }}
            />
          </TableRow>
          {visible.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              categories={categories}
              edited={editedProducts.get(product.id)}
              isUploading={uploadingImage === product.id}
              onChange={onChange}
              onPickImage={onPickImage}
            />
          ))}
          <TableRow>
            <TableCell
              colSpan={7}
              style={{
                height: Math.max(0, totalHeight - end * ROW_HEIGHT),
                padding: 0,
              }}
            />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export const ProductTable = memo(TableComp);
