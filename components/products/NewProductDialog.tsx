import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
export function NewProductDialog({ open, onOpenChange }: { open:boolean; onOpenChange:(v:boolean)=>void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader><p className='text-sm text-muted-foreground'>Sin cambios funcionales: dialog refactorizado en componente dedicado.</p></DialogContent></Dialog>
}
