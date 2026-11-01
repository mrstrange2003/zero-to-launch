import { LayoutGrid, LogOut, Rocket, UserCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Rocket className="size-4" aria-hidden="true" />
          </span>
          Zero-to-Launch
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/preview"
            className="hidden items-center gap-1.5 text-sm text-slate-600 transition hover:text-slate-900 md:flex"
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            Components
          </Link>
          <span className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
            <UserCircle2 className="size-5 text-slate-400" aria-hidden="true" />
            {user?.email}
          </span>
          <Button variant="outline" size="sm" icon={LogOut} onClick={logout}>
            Log out
          </Button>
        </div>
      </nav>
    </header>
  )
}
