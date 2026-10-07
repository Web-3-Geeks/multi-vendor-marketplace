import { ROLE_CONFIG } from '../../constants/roleConfig'
import { AccountStats, HeroBanner, PermissionsPanel } from '../../components/dashboard/widgets'
import AdminVendorsPanel from '../../components/admin/AdminVendorsPanel'
import AdminCategoriesPanel from '../../components/admin/AdminCategoriesPanel'

function AdminDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <AdminVendorsPanel />
          <AdminCategoriesPanel />
        </div>
        <div className="lg:col-span-2">
          <PermissionsPanel role={user.role} />
        </div>
      </div>
    </>
  )
}

export default AdminDashboard
