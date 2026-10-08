import { ROLE_CONFIG } from '../../constants/roleConfig'
import { useScrollToHash } from '../../hooks/useScrollToHash'
import { AccountStats, HeroBanner, PermissionsPanel } from '../../components/dashboard/widgets'
import AdminStatsPanel from '../../components/admin/AdminStatsPanel'
import AdminOrdersPanel from '../../components/admin/AdminOrdersPanel'
import AdminPaymentsPanel from '../../components/admin/AdminPaymentsPanel'
import AdminVendorsPanel from '../../components/admin/AdminVendorsPanel'
import AdminCategoriesPanel from '../../components/admin/AdminCategoriesPanel'

function AdminDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]

  // Sidebar links point at #anchors on this one page.
  useScrollToHash()

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />
      <AdminStatsPanel />
      <div id="orders" className="scroll-mt-20" />
      <AdminOrdersPanel />
      <div id="payments" className="scroll-mt-20" />
      <AdminPaymentsPanel />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div id="vendors" className="scroll-mt-20" />
          <AdminVendorsPanel />
          <div id="categories" className="scroll-mt-20" />
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
