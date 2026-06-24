import { Product } from "@/interfaces";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient()

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
      name: p.name,
      id: p.id,
      variant: p.variant || "",
      price: p.price,
      stock: p.stock,
      category: p.category?.name || "",
      is_active: p.is_active ? "Si" : "No",
      image_url: p.image_url || "",
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    // Create CSV content
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    const csv = [headers, ...rows].join("\n");

    // Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `productos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  } catch (error) {
    console.error("Error exporting products:", error);
    toast.error("Error al exportar productos");
  }
};
