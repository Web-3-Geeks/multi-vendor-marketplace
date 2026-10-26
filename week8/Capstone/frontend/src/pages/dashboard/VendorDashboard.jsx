import { useState } from 'react'
import { Boxes, Plus, Search, TriangleAlert } from 'lucide-react'
import { ROLE_CONFIG } from '../../constants/roleConfig'
import { VENDOR_STATUS, VENDOR_STATUS_MESSAGE, VENDOR_STATUS_TONE, readableStatus } from '../../constants/status'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { useScrollToHash } from '../../hooks/useScrollToHash'
import { apiRequest } from '../../lib/api'
import { AccountStats, EmptyState, HeroBanner, Panel, PermissionsPanel } from '../../components/dashboard/widgets'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/marketplace/Pagination'
import { useNotice } from '../../hooks/useNotice'
import VendorProductRow from '../../components/vendor/VendorProductRow'
import ProductFormModal from '../../components/vendor/ProductFormModal'
import VendorOrdersPanel from '../../components/vendor/VendorOrdersPanel'
import VendorEarningsPanel from '../../components/vendor/VendorEarningsPanel'

const PRODUCT_PAGE_SIZE = 10

function VendorDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]
  const { token } = useAuth()
  const { data: storeData, loading: storeLoading } = useApi('/vendors/me', { auth: true })
  const [productPage, setProductPage] = useState(1)
  const [productSearch, setProductSearch] = useState('')
  const [productSearchInput, setProductSearchInput] = useState('')
  const productParams = new URLSearchParams({ page: String(productPage), limit: String(PRODUCT_PAGE_SIZE) })
  if (productSearch) productParams.set('search', productSearch)
  const { data: productData, loading: productsLoading, reload: reloadProducts } = useApi(
    `/vendor/products?${productParams}`,
    { auth: true },
  )
  const { data: categoryData } = useApi('/categories')
  const [modalProduct, setModalProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [notice, showNotice] = useNotice()

  const vendor = storeData?.vendor
  const products = productData?.products || []
  const categories = categoryData?.categories || []

  const counts = productData?.summary || { total: 0, active: 0, outOfStock: 0 }

  const openCreate = () => {
    setModalProduct(null)
    setShowModal(true)
  }
  const openEdit = (product) => {
    setModalProduct(product)
    setShowModal(true)
  }
  const closeModal = () => setShowModal(false)
  const handleSaved = () => {
    setShowModal(false)
    showNotice('Product saved.')
    reloadProducts()
  }

  const submitProductSearch = (e) => {
    e.preventDefault()
    setProductSearch(productSearchInput.trim())
    setProductPage(1)
  }

  const handleArchive = async (product) => {
    await apiRequest(`/vendor/products/${product._id}`, { method: 'DELETE', token })
    showNotice(`"${product.name}" was archived.`)
    // Archiving the last row of a later page would leave that page empty: step back one.
    if (products.length === 1 && productPage > 1) setProductPage(productPage - 1)
    reloadProducts()
  }

  const handleStockChange = async (product, stock) => {
    setActionError('')
    setBusyId(product._id)
    try {
      await apiRequest(`/vendor/products/${product._id}`, { method: 'PATCH', token, body: { stock } })
      reloadProducts()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  // Sidebar links to "My products" / "Orders" / "Earnings" are #hash anchors on this one page.
  useScrollToHash(!storeLoading)

  if (storeLoading) return <Spinner label="Loading your store..." />

  const isApproved = vendor?.status === VENDOR_STATUS.APPROVED

  return (
    <>
      <HeroBanner name={user.name} config={config} />
      <AccountStats user={user} config={config} />

      {vendor && !isApproved && (
        <Panel title="Store status" className="border-amber-200">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <TriangleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <p className="text-sm font-semibold">{vendor.storeName}</p>
                <Badge tone={VENDOR_STATUS_TONE[vendor.status]}>{readableStatus(vendor.status)}</Badge>
              </div>
              <p className="text-sm text-slate-600">{VENDOR_STATUS_MESSAGE[vendor.status]}</p>
            </div>
          </div>
        </Panel>
      )}

      {isApproved && (
        <>
          <section className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-white bg-white/70 p-4 text-center shadow-sm backdrop-blur-xl">
              <p className="text-2xl font-semibold">{counts.total}</p>
              <p className="text-xs text-slate-500">Total products</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/70 p-4 text-center shadow-sm backdrop-blur-xl">
              <p className="text-2xl font-semibold text-emerald-600">{counts.active}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/70 p-4 text-center shadow-sm backdrop-blur-xl">
              <p className="text-2xl font-semibold text-amber-600">{counts.outOfStock}</p>
              <p className="text-xs text-slate-500">Out of stock</p>
            </div>
          </section>

          <div id="products" className="scroll-mt-20" />
          <Panel
            title="Your products"
            action={
              <Button onClick={openCreate} fullWidth={false} size="sm">
                <Plus className="size-3.5" />
                Add product
              </Button>
            }
          >
            <form onSubmit={submitProductSearch} className="relative mb-3 max-w-xs">
              <label htmlFor="vendor-product-search" className="sr-only">
                Search your products
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                id="vendor-product-search"
                value={productSearchInput}
                onChange={(e) => setProductSearchInput(e.target.value)}
                placeholder="Search your products"
                maxLength={100}
                className="block w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </form>
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
            {!productData ? (
              productsLoading && <Spinner label="Loading products..." />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={productSearch ? 'No products match' : 'No products yet'}
                text={
                  productSearch
                    ? 'Try a different search.'
                    : 'Add your first product to start selling on the marketplace.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-3 font-semibold">Product</th>
                      <th className="pb-2 pr-3 font-semibold">Price</th>
                      <th className="pb-2 pr-3 font-semibold">Stock</th>
                      <th className="pb-2 pr-3 font-semibold">Status</th>
                      <th className="pb-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <VendorProductRow
                        key={product._id}
                        product={product}
                        onEdit={openEdit}
                        onArchive={setArchiveTarget}
                        onStockChange={handleStockChange}
                        busy={busyId === product._id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {productData && (
              <Pagination
                page={productPage}
                totalPages={productData.pagination.totalPages}
                onChange={setProductPage}
              />
            )}
          </Panel>
        </>
      )}

      {archiveTarget && (
        <ConfirmDialog
          title="Archive this product?"
          confirmLabel="Archive"
          message={
            <p>
              "{archiveTarget.name}" will disappear from the marketplace. Existing orders are not affected, and you
              can publish it again later by editing it.
            </p>
          }
          onCancel={() => setArchiveTarget(null)}
          onConfirm={async () => {
            await handleArchive(archiveTarget)
            setArchiveTarget(null)
          }}
        />
      )}

      {isApproved && (
        <>
          <div id="earnings" className="scroll-mt-20" />
          <VendorEarningsPanel />
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div id="orders" className="scroll-mt-20" />
          {isApproved && <VendorOrdersPanel />}
        </div>
        <div className="lg:col-span-2">
          <PermissionsPanel role={user.role} />
        </div>
      </div>

      {showModal && (
        <ProductFormModal
          product={modalProduct}
          categories={categories}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

export default VendorDashboard
