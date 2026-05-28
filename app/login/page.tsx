import { AuthOverlay } from '@/components/auth/auth-overlay'
import { GoogleLoginButton } from '@/components/auth/google-login-button'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams

  return (
    <AuthOverlay message="Debes iniciar sesión para avanzar">
      <GoogleLoginButton callbackUrl={callbackUrl ?? '/'} />
    </AuthOverlay>
  )
}
