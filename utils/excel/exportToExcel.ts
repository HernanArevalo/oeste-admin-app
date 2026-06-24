import * as XLSX from "xlsx";
import { Product } from "@/interfaces";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient();

const fetchAllProductsForExport = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .order("name");

  if (error) throw error;
  return data as Product[];
};

export const exportToExcel = async () => {
  try {
    const allProducts = await fetchAllProductsForExport();
    if (!allProducts.length) return;

    const data = allProducts.map((p) => ({
      id: p.id,
      name: p.name,
      variant: p.variant || "",
      stock: p.stock,
      price: p.price,
      category: p.category?.name || "",
      is_active: p.is_active ? "Si" : "No",
      image_url: p.image_url || "",
      created_at: p.created_at,
      updated_at: p.updated_at,
      empretienda_product_id: p.empretienda_product_id || "",
      empretienda_stock_id: p.empretienda_stock_id || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "products");

    XLSX.writeFile(
      workbook,
      `productos_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  } catch (error) {
    console.error("Error exporting products:", error);
    toast.error("Error al exportar productos");
  }
};