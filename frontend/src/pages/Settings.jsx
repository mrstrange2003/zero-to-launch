import { KeyRound, Save, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/apiError'
import { PASSWORD_MIN_LENGTH, validateEmail, validateNewPassword } from '../lib/validation'

function SettingsCard({ title, description, aside, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        {aside}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function profileFormFrom(user) {
  return { fullName: user?.full_name ?? '', email: user?.email ?? '' }
}

function ProfileForm() {
  const { user, updateProfile } = useAuth()
  const [form, setForm] = useState(() => profileFormFrom(user))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const fullName = form.fullName.trim()
  const email = form.email.trim().toLowerCase()
  const changes = {
    ...(fullName !== (user?.full_name ?? '') && { full_name: fullName || null }),
    ...(email !== user?.email && { email }),
  }
  const dirty = Object.keys(changes).length > 0

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {
      fullName: fullName.length > 255 ? 'Name is too long.' : null,
      email: validateEmail(form.email),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean) || !dirty) return

    setSaving(true)
    try {
      const updated = await updateProfile(changes)
      setForm(profileFormFrom(updated))
      toast.success('Profile updated.', { id: 'profile-saved' })
    } catch (err) {
      if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, email: 'This email is already registered.' }))
        toast.error('That email is already in use by another account.', { id: 'profile-error' })
      } else {
        toast.error(getErrorMessage(err, 'Could not update your profile.'), { id: 'profile-error' })
      }
    } finally {
      setSaving(false)
    }
  }

  const roleBadge = (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 capitalize ring-1 ring-brand-600/20 ring-inset dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/30">
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {user?.role}
    </span>
  )

  return (
    <SettingsCard title="Update Profile" description="Your name and the email you sign in with." aside={roleBadge}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="fullName"
            label="Full name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={form.fullName}
            onChange={updateField('fullName')}
            error={errors.fullName}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={updateField('email')}
            error={errors.email}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(profileFormFrom(user))
              setErrors({})
            }}
          >
            Reset
          </Button>
          <Button type="submit" icon={Save} disabled={!dirty} loading={saving} loadingText="Saving…">
            Save changes
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

function PasswordForm() {
  const { user, changePassword } = useAuth()
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  function validate() {
    const nextErrors = {
      currentPassword: form.currentPassword ? null : 'Current password is required.',
      newPassword:
        validateNewPassword(form.newPassword) ??
        (form.newPassword === form.currentPassword ? 'New password must be different.' : null),
      confirmPassword: form.confirmPassword === form.newPassword ? null : 'Passwords do not match.',
    }
    setErrors(nextErrors)
    return !Object.values(nextErrors).some(Boolean)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      setForm(EMPTY_PASSWORD_FORM)
      setErrors({})
      toast.success('Password changed.', { id: 'password-saved' })
    } catch (err) {
      if (err.response?.status === 400) {
        setErrors({ currentPassword: 'Current password is incorrect.' })
        toast.error('Your current password is incorrect.', { id: 'password-error' })
      } else {
        toast.error(getErrorMessage(err, 'Could not change your password.'), { id: 'password-error' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard title="Change Password" description="Use a long, unique password you don't use anywhere else.">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Lets password managers associate the new password with this account. */}
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} hidden readOnly />
        <Input
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={form.currentPassword}
          onChange={updateField('currentPassword')}
          error={errors.currentPassword}
          className="sm:max-w-sm"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={form.newPassword}
            onChange={updateField('newPassword')}
            error={errors.newPassword}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          />
          <Input
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={updateField('confirmPassword')}
            error={errors.confirmPassword}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" icon={KeyRound} loading={saving} loadingText="Updating…">
            Update password
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}

export default function Settings() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your account details and security.</p>

      <div className="mt-8 space-y-6">
        <ProfileForm />
        <PasswordForm />
      </div>
    </>
  )
}
