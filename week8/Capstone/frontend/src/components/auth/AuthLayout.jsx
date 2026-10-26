import { ShieldCheck, ShoppingBag, Store, Users } from 'lucide-react'
import { APP_NAME } from '../../constants/app'

const highlights = [
  { icon: ShoppingBag, title: 'Customers', text: 'Shop from many independent stores in one place.' },
  { icon: Store, title: 'Vendors', text: 'Open a store, list products and manage orders.' },
  { icon: Users, title: 'Admins', text: 'Oversee users, vendors and the whole platform.' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white shadow-md">
        <ShoppingBag aria-hidden="true" className="size-4.5" />
      </span>
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  )
}

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-slate-100 p-3 sm:p-4">
      <aside className="relative hidden w-1/2 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-600 to-sky-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -left-24 -top-24 size-96 rounded-full bg-white/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 right-0 size-[28rem] rounded-full bg-sky-300/30 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <ShoppingBag aria-hidden="true" className="size-4.5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="relative max-w-md">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Role-based secure access
          </p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            One marketplace.
            <br />
            Many independent stores.
          </h2>
          <p className="mt-4 text-white/80">
            Customers shop, vendors sell and admins keep everything running, each with exactly the access they need.
          </p>
        </div>

        <ul className="relative grid gap-3">
          {highlights.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-md"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/20">
                <Icon aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-white/75">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-1 items-center justify-center px-2 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-3xl border border-white bg-white/70 p-6 shadow-xl shadow-slate-200/70 backdrop-blur-xl sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
          {footer && <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>}
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
