import { LogIn, LogOut, Menu, UserCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import { Button } from './ui'

export default function Navbar({ onOpenSidebar }) {
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
          className="-ml-2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="font-semibold text-slate-900 lg:hidden dark:text-white">Zero-to-Launch</span>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <span className="hidden items-center gap-2 text-sm text-slate-600 sm:flex dark:text-slate-300">
                <UserCircle2 className="size-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                {user?.email}
              </span>
              <Button variant="outline" size="sm" icon={LogOut} onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
