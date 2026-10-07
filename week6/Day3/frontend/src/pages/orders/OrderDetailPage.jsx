import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Store } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { formatDate, formatPrice } from '../../lib/format'
import { ORDER_STATUS_TONE, readableStatus } from '../../constants/status'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'

function groupByVendor(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.vendor?.id || 'unknown'
    if (!groups.has(key)) groups.set(key, { vendor: item.vendor, items: [] })
    groups.get(key).items.push(item)
  }
  return Array.from(groups.values())
}

function OrderDetailPage() {
  const { id } = useParams()
  const { data, error, loading } = useApi(`/orders/${id}`, { auth: true })

  if (loading) return <Spinner label="Loading order..." />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error.status === 404 ? 'This order could not be found.' : error.message}</Alert>
        <Link to="/orders" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Back to orders
        </Link>
      </div>
    )
  }

  if (!data) return null

  const order = data.order
  const groups = groupByVendor(order.items)

  return (
    <div className="space-y-5">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Order #{order.id.slice(-8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDate(order.createdAt)}</p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{readableStatus(order.status)}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {groups.map((group) => (
            <section
              key={group.vendor?.id || 'unknown'}
              className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
            >
              <p className="mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-3 text-sm font-semibold">
                <Store aria-hidden="true" className="size-4 text-slate-400" />
                {group.vendor?.storeName || 'Unknown store'}
              </p>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">
                        {formatPrice(item.unitPrice)} &times; {item.quantity}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={ORDER_STATUS_TONE[item.status]}>{readableStatus(item.status)}</Badge>
                      <span className="w-16 text-right font-semibold text-slate-900">
                        {formatPrice(item.subtotal)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-2 rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
          <h2 className="mb-2 text-base font-semibold">Order total</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.shippingAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.discountAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
              <dt className="font-semibold">Grand total</dt>
              <dd className="font-semibold text-slate-900">{formatPrice(order.totalAmount)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}

export default OrderDetailPage
