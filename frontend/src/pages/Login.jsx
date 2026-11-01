import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { Alert, Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/apiError'
import { validateEmail } from '../lib/validation'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    const errors = {
      email: validateEmail(email),
      password: password ? null : 'Password is required.',
    }
    setFieldErrors(errors)
    if (Object.values(errors).some(Boolean)) return

    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(
        err.response?.status === 401
          ? 'Incorrect email or password.'
          : getErrorMessage(err, 'Unable to sign in. Please try again.'),
      )
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {location.state?.registered && !error && (
          <Alert variant="success">Account created. Please sign in.</Alert>
        )}
        {error && <Alert>{error}</Alert>}

        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoFocus
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        <Button type="submit" fullWidth loading={loading} loadingText="Signing in…">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
