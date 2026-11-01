import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { Alert, Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/apiError'
import { PASSWORD_MIN_LENGTH, validateEmail, validateNewPassword } from '../lib/validation'

const INITIAL_FORM = { fullName: '', email: '', password: '', confirmPassword: '' }

export default function Register() {
  const { register, login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  function validate() {
    const errors = {
      fullName: form.fullName.length > 255 ? 'Name is too long.' : null,
      email: validateEmail(form.email),
      password: validateNewPassword(form.password),
      confirmPassword:
        form.confirmPassword !== form.password ? 'Passwords do not match.' : null,
    }
    setFieldErrors(errors)
    return !Object.values(errors).some(Boolean)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    const email = form.email.trim().toLowerCase()
    setLoading(true)
    try {
      await register({ email, password: form.password, fullName: form.fullName.trim() })
    } catch (err) {
      if (err.response?.status === 409) {
        setError(
          <>
            An account with this email already exists.{' '}
            <Link to="/login" state={{ email }} className="font-medium underline">
              Sign in instead
            </Link>
            .
          </>,
        )
        setFieldErrors((prev) => ({ ...prev, email: 'This email is already registered.' }))
      } else {
        setError(getErrorMessage(err, 'Unable to create your account. Please try again.'))
      }
      setLoading(false)
      return
    }

    try {
      await login(email, form.password)
      navigate('/dashboard', { replace: true })
    } catch {
      navigate('/login', { replace: true, state: { registered: true, email } })
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started in seconds"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert>{error}</Alert>}

        <Input
          id="fullName"
          label="Full name (optional)"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={form.fullName}
          onChange={updateField('fullName')}
          error={fieldErrors.fullName}
          autoFocus
        />
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={updateField('email')}
          error={fieldErrors.email}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.password}
          onChange={updateField('password')}
          error={fieldErrors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <Input
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.confirmPassword}
          onChange={updateField('confirmPassword')}
          error={fieldErrors.confirmPassword}
        />

        <Button type="submit" fullWidth loading={loading} loadingText="Creating account…">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
