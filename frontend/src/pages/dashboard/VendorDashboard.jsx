import { useState } from 'react'
import { Boxes, Plus, TriangleAlert } from 'lucide-react'
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
import VendorProductRow from '../../components/vendor/VendorProductRow'
import ProductFormModal from '../../components/vendor/ProductFormModal'
import VendorOrdersPanel from '../../components/vendor/VendorOrdersPanel'
import VendorEarningsPanel from '../../components/vendor/VendorEarningsPanel'

function VendorDashboard({ user }) {
  const config = ROLE_CONFIG[user.role]
  const { token } = useAuth()
  const { data: storeData, loading: storeLoading } = useApi('/vendors/me', { auth: true })
  const { data: productData, loading: productsLoading, reload: reloadProducts } = useApi('/vendor/products', {
    auth: true,
  })
  const { data: categoryData } = useApi('/categories')
  const [modalProduct, setModalProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const vendor = storeData?.vendor
  const products = productData?.products || []
  const categories = categoryData?.categories || []

  const counts = {
    total: products.length,
    active: products.filter((p) => p.status === 'ACTIVE').length,
    outOfStock: products.filter((p) => p.status === 'OUT_OF_STOCK').length,
  }

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
    reloadProducts()
  }

  const handleArchive = async (product) => {
    setActionError('')
    setBusyId(product._id)
    try {
      await apiRequest(`/vendor/products/${product._id}`, { method: 'DELETE', token })
      reloadProducts()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
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
            {actionError && (
              <div className="mb-3">
                <Alert>{actionError}</Alert>
              </div>
            )}
            {productsLoading ? (
              <Spinner label="Loading products..." />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="No products yet"
                text="Add your first product to start selling on the marketplace."
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
                        onArchive={handleArchive}
                        onStockChange={handleStockChange}
                        busy={busyId === product._id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
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
