import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { ROLE_CONFIG } from '../../constants/roleConfig'

function DashboardLayout({ user, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const config = ROLE_CONFIG[user.role]

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-100 to-indigo-50/60">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200/70 bg-slate-50/80 backdrop-blur lg:block">
        <Sidebar user={user} config={config} onLogout={onLogout} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <aside className="relative h-full w-72 bg-slate-50 shadow-2xl">
            <Sidebar
              user={user}
              config={config}
              onLogout={onLogout}
              onClose={() => setMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{config.title}</p>
            <p className="text-xs text-slate-500">{today}</p>
          </div>
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.accentSoft}`}
          >
            {user.role}
          </span>
        </header>

        <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}

export default DashboardLayout
