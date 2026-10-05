import { BarChart3, Users } from 'lucide-react'
import { ROLE_CONFIG } from '../../constants/roleConfig'
import { AccountStats, EmptyState, HeroBanner, Panel, PermissionsPanel } from '../../components/dashboard/widgets'

function AdminDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Panel title="Platform overview">
            <EmptyState
              icon={BarChart3}
              title="Platform metrics coming soon"
              text="Totals for users, vendors, orders and revenue will appear here."
            />
          </Panel>
          <Panel title="User management">
            <EmptyState
              icon={Users}
              title="User management coming soon"
              text="You will be able to view users and change their roles here."
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

export default AdminDashboard
