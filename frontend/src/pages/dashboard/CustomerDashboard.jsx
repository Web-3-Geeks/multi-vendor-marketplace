import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { ROLE_CONFIG } from '../../constants/roleConfig'
import { AccountStats, HeroBanner, Panel, PermissionsPanel } from '../../components/dashboard/widgets'
import BecomeVendorCard from '../../components/vendor/BecomeVendorCard'
import RecentOrdersList from '../../components/orders/RecentOrdersList'

function CustomerDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Panel
            title="Marketplace"
            action={
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                <ShoppingBag className="size-4" />
                Browse products
              </Link>
            }
          >
            <p className="text-sm text-slate-500">
              Discover products from every approved vendor on the platform.
            </p>
          </Panel>
          <RecentOrdersList />
        </div>
        <div className="space-y-5 lg:col-span-2">
          <BecomeVendorCard />
          <PermissionsPanel role={user.role} />
        </div>
      </div>
    </>
  )
}

export default CustomerDashboard
