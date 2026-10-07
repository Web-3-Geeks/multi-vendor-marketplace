import { Outlet } from 'react-router-dom'
import MarketplaceHeader from './MarketplaceHeader'

function MarketplaceLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <MarketplaceHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export default MarketplaceLayout
