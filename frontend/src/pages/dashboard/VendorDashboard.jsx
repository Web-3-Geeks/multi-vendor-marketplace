import { Boxes, Package } from 'lucide-react'
import { ROLE_CONFIG } from '../../constants/roleConfig'
import { AccountStats, EmptyState, HeroBanner, Panel, PermissionsPanel } from '../../components/dashboard/widgets'

function VendorDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Panel title="Your store">
            <EmptyState
              icon={Boxes}
              title="No products listed yet"
              text="Product listing is coming soon. Your products will appear here."
            />
          </Panel>
          <Panel title="Recent orders">
            <EmptyState
              icon={Package}
              title="No orders yet"
              text="Orders for your products will show up here."
            />
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <PermissionsPanel role={user.role} />
        </div>
      </div>
    </>
  )
}

export default VendorDashboard
