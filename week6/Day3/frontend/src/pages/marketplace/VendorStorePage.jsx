import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Store } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import ProductCard from '../../components/marketplace/ProductCard'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'

function VendorStorePage() {
  const { id } = useParams()
  const { data: storeData, error: storeError, loading: storeLoading } = useApi(`/vendors/${id}`)
  const { data: productData, loading: productsLoading } = useApi(
    storeData ? `/products?vendor=${id}&limit=24` : null,
  )

  if (storeLoading) return <Spinner label="Loading store..." />

  if (storeError) {
    return (
      <div className="space-y-4">
        <Alert>{storeError.status === 404 ? 'This store is not available.' : storeError.message}</Alert>
        <Link to="/products" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Back to marketplace
        </Link>
      </div>
    )
  }

  if (!storeData) return null

  const vendor = storeData.vendor
  const products = productData?.products || []

  return (
    <div className="space-y-5">
      <Link
        to="/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to marketplace
      </Link>

      <div className="flex items-start gap-4 rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
        {vendor.logo ? (
          <img src={vendor.logo} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500">
            <Store aria-hidden="true" className="size-7" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{vendor.storeName}</h1>
          <p className="mt-1 text-sm text-slate-600">{vendor.storeDescription}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Products from this store</h2>
        {productsLoading ? (
          <Spinner label="Loading products..." />
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center text-sm text-slate-500">
            This store has no products listed yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default VendorStorePage
