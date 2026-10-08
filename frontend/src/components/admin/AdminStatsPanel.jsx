import { Link } from 'react-router-dom'
import {
  BadgeDollarSign,
  Boxes,
  CircleCheck,
  CircleX,
  Clock,
  CreditCard,
  Package,
  Percent,
  ShoppingBag,
  Store,
  Tags,
  Wallet,
} from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { formatPrice } from '../../lib/format'
import { Panel } from '../dashboard/widgets'
import Spinner from '../ui/Spinner'
import Alert from '../ui/Alert'

const QUICK_LINKS = [
  { label: 'Orders', icon: Package, to: '/admin#orders' },
  { label: 'Payments', icon: CreditCard, to: '/admin#payments' },
  { label: 'Vendors', icon: Store, to: '/admin#vendors' },
  { label: 'Products', icon: Boxes, to: '/products' },
  { label: 'Categories', icon: Tags, to: '/admin#categories' },
]

function Stat({ icon: Icon, label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-4">
      <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>
      <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-semibold ${tone}`} title={String(value)}>
        {value}
      </p>
    </div>
  )
}

function AdminStatsPanel() {
  const { data, loading, error } = useApi('/admin/stats', { auth: true })
  const stats = data?.stats

  return (
    <Panel title="Marketplace overview">
      {error && <Alert>{error.message}</Alert>}
      {!stats ? (
        loading && <Spinner label="Loading stats..." />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={ShoppingBag} label="Total orders" value={stats.totalOrders} />
          <Stat icon={CircleCheck} label="Paid orders" value={stats.paidOrders} tone="text-emerald-600" />
          <Stat icon={Clock} label="Pending payments" value={stats.pendingPayments} tone="text-amber-600" />
          <Stat icon={CircleX} label="Failed payments" value={stats.failedPayments} tone="text-rose-600" />
          <Stat icon={BadgeDollarSign} label="Marketplace sales" value={formatPrice(stats.totalSales)} />
          <Stat icon={Percent} label="Total commission" value={formatPrice(stats.totalCommission)} tone="text-emerald-600" />
          <Stat icon={Wallet} label="Vendor earnings" value={formatPrice(stats.vendorEarnings)} />
          <Stat icon={CreditCard} label="Refunded payments" value={stats.refundedPayments} />
        </div>
      )}

      <nav aria-label="Quick access" className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {QUICK_LINKS.map(({ label, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <Icon aria-hidden="true" className="size-4 text-slate-500" />
            {label}
          </Link>
        ))}
      </nav>
    </Panel>
  )
}

export default AdminStatsPanel
