import { LogOut, ShoppingBag, X } from 'lucide-react'
import { APP_NAME } from '../../constants/app'

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function Sidebar({ user, config, onLogout, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-6 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white shadow-md">
            <ShoppingBag aria-hidden="true" className="size-4.5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {config.navSection}
        </p>
        <ul className="space-y-1">
          {config.nav.map(({ label, icon: Icon, active }) => (
            <li key={label}>
              {active ? (
                <span
                  aria-current="page"
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200"
                >
                  <Icon aria-hidden="true" className={`size-4.5 ${config.accentText}`} />
                  {label}
                </span>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
                >
                  <Icon aria-hidden="true" className="size-4.5" />
                  {label}
                  <span className="ml-auto rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Soon
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="m-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{config.label}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          <LogOut className="size-4.5" />
        </button>
      </div>
    </div>
  )
}

export default Sidebar
