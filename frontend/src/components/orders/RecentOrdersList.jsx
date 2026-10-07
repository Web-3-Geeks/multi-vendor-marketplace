import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { formatDate, formatPrice } from '../../lib/format'
import { ORDER_STATUS_TONE, readableStatus } from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'

function RecentOrdersList({ limit = 3 }) {
  const { data, loading } = useApi('/orders', { auth: true })
  const orders = data?.orders.slice(0, limit) || []

  return (
    <Panel
      title="Recent orders"
      action={
        data?.orders.length > 0 && (
          <Link to="/orders" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            View all
          </Link>
        )
      }
    >
      {loading ? (
        <Spinner label="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          text="When you place an order, it will show up here with its status."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="flex items-center justify-between gap-3 py-2.5 text-sm transition hover:text-indigo-600"
              >
                <span className="truncate">
                  #{order.id.slice(-8).toUpperCase()}
                  <span className="ml-2 text-xs text-slate-400">{formatDate(order.createdAt)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>{readableStatus(order.status)}</Badge>
                  <span className="font-semibold text-slate-900">{formatPrice(order.totalAmount)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default RecentOrdersList
