import { memo, useState, useEffect } from "react";
import { Product, Category } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ProductImageUpload } from "./ProductImageUpload";

type Props = {
  product: Product;
  categories: Category[];
  edited: Partial<Product> | undefined;
  isUploading: boolean;
  onChange: (id: string, field: keyof Product, value: unknown) => void;
  onPickImage: (product: Product) => void;
};

function Row({
  product,
  categories,
  edited,
  isUploading,
  onChange,
  onPickImage,
}: Props) {
  const current = { ...product, ...edited };
  const [name, setName] = useState(current.name);
  const [variant, setVariant] = useState(current.variant || "");
  useEffect(() => {
    setName(current.name);
    setVariant(current.variant || "");
  }, [current.name, current.variant]);

  return (
    <TableRow className={cn(edited && "bg-amber-500/5")}>
      <TableCell>
        <ProductImageUpload
          src={current.image_url || undefined}
          alt={product.name}
          loading={isUploading}
          onClick={() => onPickImage(product)}
        />
      </TableCell>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onChange(product.id, "name", name)}
          className="h-8 bg-transparent border-transparent hover:border-input focus:border-input"
        />
      </TableCell>
      <TableCell>
        <Input
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          onBlur={() => onChange(product.id, "variant", variant)}
          className="h-8 bg-transparent border-transparent hover:border-input focus:border-input"
        />
      </TableCell>
      <TableCell>
        <Select
          value={current.category_id || "none"}
          onValueChange={(v) =>
            onChange(product.id, "category_id", v === "none" ? null : v)
          }
        >
          <SelectTrigger className="h-8 w-40 bg-transparent border-transparent hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin categoria</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={Number(current.price)}
          onChange={(e) =>
            onChange(product.id, "price", parseFloat(e.target.value) || 0)
          }
          className="h-8 w-28 text-right ml-auto"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={Number(current.stock)}
          onChange={(e) =>
            onChange(product.id, "stock", parseInt(e.target.value) || 0)
          }
          className="h-8 w-20 text-center mx-auto"
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={Boolean(current.is_active)}
          onCheckedChange={(v) => onChange(product.id, "is_active", v)}
        />
      </TableCell>
    </TableRow>
  );
}

export const ProductRow = memo(Row);
