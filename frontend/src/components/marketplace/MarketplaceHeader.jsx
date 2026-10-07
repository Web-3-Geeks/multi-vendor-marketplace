import { Link } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, ShoppingCart } from 'lucide-react'
import { APP_NAME } from '../../constants/app'
import { ROLE_HOME } from '../../constants/roles'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'

function MarketplaceHeader() {
  const { user } = useAuth()
  const { cart } = useCart()
  const itemCount = cart?.itemCount || 0

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/products" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white shadow-md">
            <ShoppingBag aria-hidden="true" className="size-4.5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <Link
              to="/cart"
              aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
              className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100"
            >
              <ShoppingCart aria-hidden="true" className="size-5" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid size-4.5 min-w-4.5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
            <Link
              to={ROLE_HOME[user.role]}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <LayoutDashboard aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

export default MarketplaceHeader
