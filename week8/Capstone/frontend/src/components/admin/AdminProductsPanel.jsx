import { useState } from 'react'
import { Boxes, ImageOff, Search } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { useNotice } from '../../hooks/useNotice'
import { apiRequest } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_TONE,
  VENDOR_STATUS,
  VENDOR_STATUS_TONE,
  readableStatus,
} from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import ConfirmDialog from '../ui/ConfirmDialog'
import SelectField from '../ui/SelectField'
import Spinner from '../ui/Spinner'

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.values(PRODUCT_STATUS).map((value) => ({ value, label: readableStatus(value) })),
]

function AdminProductsPanel() {
  const { token } = useAuth()
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [notice, showNotice] = useNotice()
  const [takedownTarget, setTakedownTarget] = useState(null)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const { data, loading, error, reload } = useApi(`/admin/products?${params}`, { auth: true })

  const applyFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const submitSearch = (e) => {
    e.preventDefault()
    applyFilter({ search: searchInput.trim() })
  }

  const changeStatus = async (product, status) => {
    await apiRequest(`/admin/products/${product.id}/status`, { method: 'PATCH', token, body: { status } })
    showNotice(
      status === PRODUCT_STATUS.ARCHIVED ? `"${product.name}" was taken down.` : `"${product.name}" was restored.`,
    )
    reload()
  }

  const restore = async (product) => {
    setActionError('')
    setBusyId(product.id)
    try {
      await changeStatus(product, PRODUCT_STATUS.ACTIVE)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const products = data?.products || []

  return (
    <Panel title="Products">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <form onSubmit={submitSearch}>
          <label htmlFor="admin-product-search" className="mb-1.5 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-product-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Product name"
              maxLength={100}
              className="block w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-3.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </form>
        <SelectField
          id="admin-product-status"
          label="Status"
          value={filters.status}
          onChange={(e) => applyFilter({ status: e.target.value })}
          options={STATUS_OPTIONS}
        />
      </div>

      {notice && (
        <div className="mb-3">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}
      {actionError && (
        <div className="mb-3">
          <Alert>{actionError}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {!data ? (
        loading && <Spinner label="Loading products..." />
      ) : products.length === 0 ? (
        <EmptyState icon={Boxes} title="No products found" text="Try changing the search or filter." />
      ) : (
        <ul aria-busy={loading} className={`divide-y divide-slate-100 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                  {product.image ? <img src={product.image} alt="" className="size-full object-cover" /> : <ImageOff className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{product.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {product.vendor?.storeName}
                    {product.vendor && product.vendor.status !== VENDOR_STATUS.APPROVED && (
                      <Badge tone={VENDOR_STATUS_TONE[product.vendor.status]} className="ml-1.5">
                        Store {readableStatus(product.vendor.status).toLowerCase()}
                      </Badge>
                    )}{' '}
                    &middot; {product.category?.name || 'Uncategorized'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
                <span className="text-xs text-slate-500">{product.stock} in stock</span>
                <Badge tone={PRODUCT_STATUS_TONE[product.status]}>{readableStatus(product.status)}</Badge>
                {product.takenDownByAdmin && <Badge tone="rose">Taken down</Badge>}
                {product.status === PRODUCT_STATUS.ARCHIVED ? (
                  <button
                    type="button"
                    disabled={busyId === product.id}
                    onClick={() => restore(product)}
                    className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTakedownTarget(product)}
                    className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Take down
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      {takedownTarget && (
        <ConfirmDialog
          title="Take this product down?"
          confirmLabel="Take down"
          message={
            <p>
              "{takedownTarget.name}" will be removed from the marketplace, and {takedownTarget.vendor?.storeName} won't be
              able to publish it again until you restore it. Existing orders are not affected.
            </p>
          }
          onCancel={() => setTakedownTarget(null)}
          onConfirm={async () => {
            await changeStatus(takedownTarget, PRODUCT_STATUS.ARCHIVED)
            setTakedownTarget(null)
          }}
        />
      )}
    </Panel>
  )
}

export default AdminProductsPanel
