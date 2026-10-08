import { useState } from 'react'
import { BadgeDollarSign, CircleCheck, Clock, Percent, ReceiptText, TrendingUp, Wallet } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { formatDate, formatPrice } from '../../lib/format'
import {
  COMMISSION_STATUS,
  COMMISSION_STATUS_TONE,
  readableStatus,
} from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'
import Alert from '../ui/Alert'

const TABS = [
  { value: '', label: 'All' },
  { value: COMMISSION_STATUS.PENDING, label: 'Pending' },
  { value: COMMISSION_STATUS.PAID, label: 'Paid' },
  { value: COMMISSION_STATUS.REFUNDED, label: 'Refunded' },
  { value: COMMISSION_STATUS.CANCELLED, label: 'Cancelled' },
]

const PAGE_SIZE = 10

function EarningStat({ icon: Icon, label, value, tone = 'text-slate-900' }) {
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

function VendorEarningsPanel() {
  const [tab, setTab] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (tab) params.set('status', tab)
  const { data, loading, error } = useApi(`/vendor/earnings?${params}`, { auth: true })

  const changeTab = (value) => {
    setTab(value)
    setPage(1)
  }

  const summary = data?.summary
  const transactions = data?.transactions || []

  return (
    <Panel title="Earnings">
      {error && (
        <div className="mb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {!summary ? (
        loading && <Spinner label="Loading earnings..." />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <EarningStat icon={ReceiptText} label="Total sales" value={`${summary.salesCount} item${summary.salesCount === 1 ? '' : 's'}`} />
            <EarningStat icon={BadgeDollarSign} label="Gross revenue" value={formatPrice(summary.totalSales)} />
            <EarningStat icon={Percent} label="Platform commission" value={formatPrice(summary.totalCommission)} tone="text-rose-600" />
            <EarningStat icon={TrendingUp} label="Net earnings" value={formatPrice(summary.netEarnings)} tone="text-emerald-600" />
            <EarningStat icon={Clock} label="Pending earnings" value={formatPrice(summary.pendingEarnings)} tone="text-amber-600" />
            <EarningStat icon={CircleCheck} label="Paid earnings" value={formatPrice(summary.paidEarnings)} tone="text-emerald-600" />
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Earnings are pending until the customer's order is delivered, then they count as paid. Refunded and
            cancelled sales are not included in the totals.
          </p>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => changeTab(t.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No earnings to show"
              text="Once customers pay for your products, each sale appears here with its commission."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">Order</th>
                    <th className="pb-2 pr-3 font-semibold">Product</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Sale</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Commission</th>
                    <th className="pb-2 pr-3 text-right font-semibold">You get</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="align-top">
                      <td className="py-2.5 pr-3 font-medium">#{t.orderId.slice(-8).toUpperCase()}</td>
                      <td className="max-w-48 py-2.5 pr-3">
                        <p className="truncate">{t.productName}</p>
                        <p className="text-xs text-slate-400">x{t.quantity}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{formatPrice(t.grossAmount)}</td>
                      <td className="py-2.5 pr-3 text-right text-rose-600">
                        -{formatPrice(t.commissionAmount)}
                        <span className="block text-xs text-slate-400">{Math.round(t.commissionRate * 1000) / 10}%</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-slate-900">{formatPrice(t.vendorAmount)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={COMMISSION_STATUS_TONE[t.status]}>{readableStatus(t.status)}</Badge>
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-slate-500">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}
    </Panel>
  )
}

export default VendorEarningsPanel
