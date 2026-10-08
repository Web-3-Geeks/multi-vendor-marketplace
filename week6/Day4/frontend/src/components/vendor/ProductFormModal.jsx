import { useState } from 'react'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { toFieldErrors } from '../../lib/formErrors'
import { PRODUCT_STATUS } from '../../constants/status'
import Modal from '../ui/Modal'
import TextField from '../ui/TextField'
import TextArea from '../ui/TextArea'
import SelectField from '../ui/SelectField'
import Button from '../ui/Button'
import Alert from '../ui/Alert'

const STATUS_OPTIONS = [
  { value: PRODUCT_STATUS.DRAFT, label: 'Draft (not visible to customers)' },
  { value: PRODUCT_STATUS.ACTIVE, label: 'Active (published to marketplace)' },
  { value: PRODUCT_STATUS.ARCHIVED, label: 'Archived' },
]

const toFormState = (product) => ({
  name: product?.name || '',
  description: product?.description || '',
  price: product?.price ?? '',
  stock: product?.stock ?? '',
  category: product?.category?._id || product?.category || '',
  images: product?.images?.join(', ') || '',
  status: product?.status === PRODUCT_STATUS.OUT_OF_STOCK ? PRODUCT_STATUS.ACTIVE : product?.status || PRODUCT_STATUS.DRAFT,
})

function ProductFormModal({ product, categories, onClose, onSaved }) {
  const { token } = useAuth()
  const [form, setForm] = useState(() => toFormState(product))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFieldErrors({})
    setSubmitting(true)

    const images = form.images
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)

    const body = {
      name: form.name,
      description: form.description,
      price: form.price,
      stock: form.stock,
      category: form.category,
      images,
      status: form.status,
    }

    try {
      if (product) {
        await apiRequest(`/vendor/products/${product._id}`, { method: 'PATCH', token, body });
      } else {
        await apiRequest('/vendor/products', { method: 'POST', token, body });
      }
      onSaved()
    } catch (err) {
      setFieldErrors(toFieldErrors(err.errors))
      if (!err.errors?.length) setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={product ? 'Edit product' : 'Add product'}
      description="Products saved as Draft are not shown in the marketplace."
      onClose={onClose}
      size="lg"
    >
      <form noValidate className="space-y-4" onSubmit={handleSubmit}>
        <Alert>{formError}</Alert>

        <TextField
          id="name"
          name="name"
          label="Product name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
        />

        <TextArea
          id="description"
          name="description"
          label="Description"
          hint="Required to publish as Active."
          value={form.description}
          onChange={handleChange}
          error={fieldErrors.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            label="Price"
            value={form.price}
            onChange={handleChange}
            error={fieldErrors.price}
          />
          <TextField
            id="stock"
            name="stock"
            type="number"
            min="0"
            step="1"
            label="Stock"
            value={form.stock}
            onChange={handleChange}
            error={fieldErrors.stock}
          />
        </div>

        <SelectField
          id="category"
          name="category"
          label="Category"
          value={form.category}
          onChange={handleChange}
          error={fieldErrors.category}
          options={[
            { value: '', label: 'Select a category' },
            ...categories.map((c) => ({ value: c._id, label: c.name })),
          ]}
        />

        <TextField
          id="images"
          name="images"
          label="Image URLs (comma separated, optional)"
          placeholder="https://example.com/a.png, https://example.com/b.png"
          value={form.images}
          onChange={handleChange}
          error={fieldErrors.images}
        />

        <SelectField
          id="status"
          name="status"
          label="Status"
          value={form.status}
          onChange={handleChange}
          error={fieldErrors.status}
          options={STATUS_OPTIONS}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <Button type="submit" loading={submitting} fullWidth={false}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ProductFormModal
