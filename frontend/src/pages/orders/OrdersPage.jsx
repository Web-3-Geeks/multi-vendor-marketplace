import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Package } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { formatDate, formatPrice } from '../../lib/format'
import { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, orderPaymentLabel, readableStatus } from '../../constants/status'
import Pagination from '../../components/marketplace/Pagination'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'

const PAGE_SIZE = 10

function OrdersPage() {
  const [page, setPage] = useState(1)
  const { data, error, loading } = useApi(`/orders?page=${page}&limit=${PAGE_SIZE}`, { auth: true })

  const changePage = (next) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading && !data) return <Spinner label="Loading your orders..." />
  if (error && !data) return <Alert>{error.message}</Alert>
  if (!data) return null

  const orders = data.orders
  const { total, totalPages } = data.pagination

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>
        {total > 0 && (
          <p className="text-sm text-slate-500">
            {total} order{total === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {error && <Alert>{error.message}</Alert>}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
          <Package aria-hidden="true" className="size-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-slate-500">Orders you place will show up here.</p>
          <Link
            to="/products"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <ul aria-busy={loading} className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl transition hover:bg-white sm:p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Order #{order.id.slice(-8).toUpperCase()}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(order.createdAt)} &middot; {order.items.length} item
                    {order.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>{readableStatus(order.status)}</Badge>
                  <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{orderPaymentLabel(order.paymentStatus)}</Badge>
                  <p className="w-20 text-right text-sm font-semibold">{formatPrice(order.totalAmount)}</p>
                  <ChevronRight aria-hidden="true" className="size-4 text-slate-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={changePage} />
    </div>
  )
}

export default OrdersPage
