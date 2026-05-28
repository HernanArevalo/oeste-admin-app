import { AuthOverlay } from '@/components/auth/auth-overlay'
import { LogoutButton } from '@/components/auth/logout-button'

export default function UnauthorizedPage() {
  return (
    <AuthOverlay message="Esta es una web meramente de gestión interna. Comunicate con Oeste Gafas para obtener acceso">
      <LogoutButton />
    </AuthOverlay>
  )
}
