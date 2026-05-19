import Image from "next/image";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { getProductTableImage } from "@/utils";

type Props = {
  src?: string | null;
  alt: string;
  loading: boolean;
  onClick: () => void;
  isNew?: boolean;
};

export function ProductImageUpload({
  src,
  alt,
  loading,
  onClick,
  isNew,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-14 w-14 overflow-hidden rounded-md border border-border bg-muted/40"
      disabled={loading}
    >
      <Image
        width={54}
        height={54}
        loading="lazy"
        src={src ? getProductTableImage(src) : "/placeholder.jpg"}
        alt={alt}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isNew ? (
          <Upload className="h-4 w-4" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </div>
    </button>
  );
}
