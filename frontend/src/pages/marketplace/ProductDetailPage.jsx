import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ImageOff, ShoppingCart, Store, Tag } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { formatPrice, stockInfo } from '../../lib/format'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import QuantityStepper from '../../components/ui/QuantityStepper'

function ProductDetailPage() {
  const { id } = useParams()
  const { data, error, loading } = useApi(`/products/${id}`)
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [added, setAdded] = useState(false)
  const { user } = useAuth()
  const { addItem } = useCart()

  const handleAddToCart = async () => {
    setAddError('')
    setAdded(false)
    setAdding(true)
    try {
      await addItem(id, quantity)
      setAdded(true)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <Spinner label="Loading product..." />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error.status === 404 ? 'This product is not available.' : error.message}</Alert>
        <Link to="/products" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Back to marketplace
        </Link>
      </div>
    )
  }

  if (!data) return null

  const product = data.product
  const stock = stockInfo(product.stock)
  const images = product.images?.length ? product.images : [null]

  return (
    <div className="space-y-5">
      <Link
        to="/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to marketplace
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl border border-white bg-white/70 shadow-sm">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt={product.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-slate-300">
                <ImageOff aria-hidden="true" className="size-14" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button
                  key={img || i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                  aria-current={activeImage === i}
                  className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                    activeImage === i ? 'border-indigo-500' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {product.category && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Tag aria-hidden="true" className="size-4" />
              {product.category.name}
            </div>
          )}

          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>

          <div className="flex items-center gap-3">
            <p className="text-3xl font-semibold">{formatPrice(product.price)}</p>
            <Badge tone={stock.tone}>{stock.label}</Badge>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {product.description || 'No description provided.'}
          </p>

          <Link
            to={`/vendor/${product.vendor.id}`}
            className="flex items-center gap-3 rounded-2xl border border-white bg-white/70 p-3 shadow-sm transition hover:bg-white"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <Store aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{product.vendor.storeName}</p>
              <p className="text-xs text-slate-500">View store</p>
            </div>
          </Link>

          {addError && <Alert>{addError}</Alert>}
          {added && (
            <Alert variant="success">
              Added to cart.{' '}
              <Link to="/cart" className="font-semibold underline">
                View cart
              </Link>
            </Alert>
          )}

          {product.stock > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Quantity</span>
              <QuantityStepper
                value={quantity}
                onChange={(next) => {
                  setQuantity(next)
                  setAdded(false)
                }}
                min={1}
                max={product.stock}
                disabled={adding}
              />
            </div>
          )}

          {user ? (
            <Button onClick={handleAddToCart} loading={adding} disabled={product.stock <= 0}>
              <ShoppingCart aria-hidden="true" className="size-4" />
              {product.stock <= 0 ? 'Out of stock' : 'Add to Cart'}
            </Button>
          ) : (
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              Log in to add to cart
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductDetailPage
