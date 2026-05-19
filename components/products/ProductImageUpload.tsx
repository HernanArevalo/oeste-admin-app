import Image from 'next/image'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import { getOptimizedCloudinaryImage } from '@/utils'

type Props = {
  src?: string | null
  alt: string
  loading: boolean
  onClick: () => void
  isNew?: boolean
}

export function ProductImageUpload({ src, alt, loading, onClick, isNew }: Props) {
  return (
    <button type="button" onClick={onClick} className="group relative h-14 w-14 overflow-hidden rounded-md border border-border bg-muted/40" disabled={loading}>
      <Image width={56} height={56} loading="lazy" src={src ? getOptimizedCloudinaryImage(src, 56, 'w_56,c_limit,q_auto,f_auto,dpr_auto') : '/placeholder.jpg'} alt={alt} className="h-full w-full object-cover" />
      <div className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isNew ? <Upload className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
      </div>
    </button>
  )
}
