'use client'

import { useState, useMemo, useCallback } from 'react'

import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { User, UserRowState } from '@/interfaces'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  Search,
  Save,
  X,
  Download,
  AlertCircle,
} from 'lucide-react'

import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const supabase = createClient()


const roles = [
  { id: 'ADMIN', name: 'Admin' },
  { id: 'SELLER', name: 'Seller' },
  { id: 'USER', name: 'User' },
]

const fetchUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name')

  if (error) throw error

  return data as User[]
}

export default function UsersPage() {
  const { data: users, isLoading } = useSWR('all-users', fetchUsers)
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)

  const [editedUsers, setEditedUsers] = useState<Map<string, UserRowState>>(
    new Map()
  )

  const [isSaving, setIsSaving] = useState(false)

  const filteredUsers = useMemo(() => {
    if (!users) return []

    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())

      const matchesRole =
        roleFilter === 'all' || user.role === roleFilter

      const matchesActive =
        showInactive || user.is_active

      return matchesSearch && matchesRole && matchesActive
    })
  }, [users, search, roleFilter, showInactive])

  const hasChanges = editedUsers.size > 0

  const getUserValue = useCallback(
    (user: User, field: keyof User) => {
      const edited = editedUsers.get(user.id)

      if (edited && field in edited) {
        return edited[field]
      }

      return user[field]
    },
    [editedUsers]
  )

  const handleFieldChange = (
    userId: string,
    field: keyof User,
    value: unknown
  ) => {
    const user = users?.find((u) => u.id === userId)

    if (!user) return

    setEditedUsers((prev) => {
      const map = new Map(prev)

      const existing =
        map.get(userId) || {
          ...user,
          isDirty: true,
          originalData: user,
        }

      map.set(userId, {
        ...existing,
        [field]: value,
        isDirty: true,
      })

      return map
    })
  }

  const cancelChanges = () => {
    setEditedUsers(new Map())
  }

  const saveChanges = async () => {
    setIsSaving(true)

    try {
      const updates = Array.from(editedUsers.values())

      for (const user of updates) {
        const { id, role, is_active } = user

        const { error } = await supabase
          .from('users')
          .update({
            role,
            is_active,
          })
          .eq('id', id)

        if (error) throw error
      }

      toast.success(`${updates.length} usuario(s) actualizado(s)`)

      setEditedUsers(new Map())

      mutate('all-users')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Error al guardar cambios')
    } finally {
      setIsSaving(false)
    }
  }

  const exportToCSV = () => {
    if (!users?.length) return

    const data = users.map((u) => ({
      Nombre: u.name,
      Email: u.email,
      Rol: u.role,
      Activo: u.is_active ? 'Sí' : 'No',
    }))

    const headers = Object.keys(data[0]).join(',')

    const rows = data.map((row) =>
      Object.values(row).join(',')
    )

    const csv = [headers, ...rows].join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const link = document.createElement('a')

    link.href = URL.createObjectURL(blob)

    link.download = `usuarios_${
      new Date().toISOString().split('T')[0]
    }.csv`

    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Usuarios
        </h1>

        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={!users?.length}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

            <Input
              placeholder="Buscar usuarios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={setRoleFilter}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                Todos los roles
              </SelectItem>

              {roles.map((role) => (
                <SelectItem
                  key={role.id}
                  value={role.id}
                >
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              checked={showInactive}
              onCheckedChange={setShowInactive}
              id="show-inactive"
            />

            <label
              htmlFor="show-inactive"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Mostrar inactivos
            </label>
          </div>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-amber-400 border-amber-400/30"
            >
              {editedUsers.size} cambios sin guardar
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={cancelChanges}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>

            <Button
              size="sm"
              onClick={saveChanges}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-1" />

              {isSaving
                ? 'Guardando...'
                : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card m-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">
                Rol
              </TableHead>
              <TableHead className="text-right">
                Activo
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <div className="h-10 bg-secondary/50 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />

                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isEdited = editedUsers.has(user.id)

                return (
                  <TableRow
                    key={user.id}
                    className={cn(
                      isEdited && 'bg-amber-500/5'
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Image
                          width={40}
                          height={40}
                          src={
                            (getUserValue(user, 'image_url') as string | null) ||
                            '/placeholder.jpg'
                          }
                          alt={user.name}
                          className="h-10 w-10 rounded-full object-cover border"
                        />
                        <div>
                          <div className="font-medium">
                            {getUserValue(
                              user,
                              'name'
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            id: {user.id.split('-')[0].toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {getUserValue(user, 'email')}
                    </TableCell>

                    <TableCell className="text-center">
                      <Select
                        value={
                          (getUserValue(
                            user,
                            'role'
                          ) as string) || 'user'
                        }
                        onValueChange={(v) =>
                          handleFieldChange(
                            user.id,
                            'role',
                            v
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-40 mx-auto">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem
                              key={role.id}
                              value={role.id}
                            >
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <Switch
                          checked={
                            getUserValue(
                              user,
                              'is_active'
                            ) as boolean
                          }
                          onCheckedChange={(v) =>
                            handleFieldChange(
                              user.id,
                              'is_active',
                              v
                            )
                          }
                          disabled={true}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && filteredUsers.length > 0 && (
        <div className="text-sm text-muted-foreground mt-3 mb-4">
          {filteredUsers.length} usuarios encontrados
        </div>
      )}
      <p className="text-sm text-muted-foreground m-0">
        El rol "Admin" tiene acceso total.
      </p>
      <p className="text-sm text-muted-foreground m-0">
        El rol "Seller" puede gestionar productos y ventas.
      </p>
      <p className="text-sm text-muted-foreground m-0">
        El rol "User" es el rol por default, no tiene acceso.
      </p>
    </div>
  )
}