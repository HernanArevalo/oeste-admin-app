import { memo } from 'react'
import { Button } from '@/components/ui/button'

export const ProductStats = memo(function ProductStats({ shown, total, hasMore, isLoadingMore, onMore }: { shown:number; total:number; hasMore:boolean; isLoadingMore:boolean; onMore:()=>void }) {
  return <div className='flex items-center justify-between text-sm text-muted-foreground'><span>Mostrando {shown} de {total}</span>{hasMore && <Button variant='outline' size='sm' onClick={onMore} disabled={isLoadingMore}>{isLoadingMore ? 'Cargando...' : 'Cargar más'}</Button>}</div>
})
