import { LayoutDashboard, LayoutGrid, Rocket, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/preview', label: 'Components', Icon: LayoutGrid },
]

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Rocket className="size-4" aria-hidden="true" />
      </span>
      Zero-to-Launch
    </Link>
  )
}

function NavItems({ onNavigate }) {
  return (
    <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
            }`
          }
        >
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

const PANEL = 'flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'

export default function Sidebar({ mobileOpen, onClose }) {
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!mobileOpen) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen, onClose])

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <div className={PANEL}>
          <div className="flex h-16 shrink-0 items-center px-6">
            <Brand />
          </div>
          <NavItems />
        </div>
      </aside>

      {/* `invisible` removes the closed drawer from the tab order. It must flip instantly on open
          (so the close button can take focus) but only after the 300ms slide-out on close. */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileOpen ? 'visible' : 'invisible transition-[visibility] delay-300 duration-0'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`relative h-full w-64 transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`${PANEL} shadow-xl`}>
            <div className="flex h-16 shrink-0 items-center justify-between px-6">
              <Brand />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="-mr-2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <NavItems onNavigate={onClose} />
          </div>
        </div>
      </div>
    </>
  )
}
