import { CalendarDays, Hash, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 truncate text-base font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '—'

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{user?.full_name ? `, ${user.full_name}` : ''}!
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        You are signed in. This page is only visible to authenticated users.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard icon={Mail} label="Email" value={user?.email ?? '—'} />
        <InfoCard icon={Hash} label="User ID" value={user?.id ?? '—'} />
        <InfoCard icon={ShieldCheck} label="Status" value={user?.is_active ? 'Active' : 'Inactive'} />
        <InfoCard icon={CalendarDays} label="Joined" value={joined} />
      </section>
    </>
  )
}
