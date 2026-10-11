import { Check, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { FEATURES } from '../../constants/roleConfig'

export function HeroBanner({ name, config }) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${config.hero} px-6 py-12 text-center text-white shadow-xl sm:py-16`}
    >
      <div aria-hidden="true" className="absolute -left-20 -top-20 size-72 rounded-full bg-white/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 -right-10 size-80 rounded-full bg-white/15 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="relative">
        <p className="text-lg font-light text-white/85 sm:text-xl">Welcome back,</p>
        <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-5xl">{name}.</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">{config.tagline}</p>
      </div>
    </section>
  )
}

function StatCard({ icon: Icon, label, value, badge, badgeClass }) {
  return (
    <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold" title={value}>
        {value}
      </p>
    </div>
  )
}

export function AccountStats({ user, config }) {
  const allowed = FEATURES.filter((f) => f.roles.includes(user.role)).length

  return (
    <section aria-label="Account summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        icon={ShieldCheck}
        label="Role"
        value={config.label}
        badge={user.role}
        badgeClass={config.accentSoft}
      />
      <StatCard icon={Mail} label="Email" value={user.email} />
      <StatCard
        icon={UserRound}
        label="Account status"
        value="Active"
        badge="Verified login"
        badgeClass="bg-emerald-50 text-emerald-700 ring-emerald-200"
      />
      <StatCard
        icon={Check}
        label="Access level"
        value={`${allowed} of ${FEATURES.length} features`}
      />
    </section>
  )
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <section
      className={`rounded-3xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>
    </div>
  )
}

export function PermissionsPanel({ role }) {
  return (
    <Panel title="Your permissions">
      <ul className="divide-y divide-slate-100">
        {FEATURES.map(({ label, roles }) => {
          const allowed = roles.includes(role)
          return (
            <li key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className={allowed ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
              {allowed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <Check aria-hidden="true" className="size-3" />
                  Allowed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  <X aria-hidden="true" className="size-3" />
                  No access
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
