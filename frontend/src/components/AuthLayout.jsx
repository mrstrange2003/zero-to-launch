import { Rocket } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Rocket className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 [&_a]:font-medium [&_a]:text-brand-600 [&_a:hover]:text-brand-700 dark:[&_a]:text-brand-400 dark:[&_a:hover]:text-brand-300">
            {footer}
          </p>
        )}
      </div>
    </main>
  )
}
