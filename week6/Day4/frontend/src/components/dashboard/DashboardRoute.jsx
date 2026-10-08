import DashboardLayout from './DashboardLayout'
import { useAuth } from '../../hooks/useAuth'

function DashboardRoute({ page: Page }) {
  const { user, logout } = useAuth()

  return (
    <DashboardLayout user={user} onLogout={logout}>
      <Page user={user} />
    </DashboardLayout>
  )
}

export default DashboardRoute
