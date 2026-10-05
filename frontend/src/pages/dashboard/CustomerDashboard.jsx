import { Package } from 'lucide-react'
import { ROLE_CONFIG } from '../../constants/roleConfig'
import { AccountStats, EmptyState, HeroBanner, Panel, PermissionsPanel } from '../../components/dashboard/widgets'

const steps = ['Browse products from different vendors', 'Add items to your cart', 'Place an order and track it here']

function CustomerDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Panel title="Recent orders">
            <EmptyState
              icon={Package}
              title="No orders yet"
              text="When you place an order, it will show up here with its status."
            />
          </Panel>
          <Panel title="Getting started">
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <PermissionsPanel role={user.role} />
        </div>
      </div>
    </>
  )
}

export default CustomerDashboard
