import { memo } from 'react'
import { Category } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export const ProductFilters = memo(function ProductFilters({ search, onSearch, categoryFilter, onCategoryFilter, showInactive, onShowInactive, categories }: { search: string; onSearch: (v: string)=>void; categoryFilter: string; onCategoryFilter: (v: string)=>void; showInactive: boolean; onShowInactive: (v: boolean)=>void; categories: Category[] }) {
  return <div className='flex items-center gap-4 w-fit'><Input value={search} onChange={(e)=>onSearch(e.target.value)} placeholder='Buscar productos...' className='w-64'/><Select value={categoryFilter} onValueChange={onCategoryFilter}><SelectTrigger className='w-48'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todas las categorias</SelectItem>{categories.map((c)=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><div className='flex items-center gap-2'><Switch checked={showInactive} onCheckedChange={onShowInactive} /><span className='text-sm'>Mostrar inactivos</span></div></div>
})
