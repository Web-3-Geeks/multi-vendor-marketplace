import { useState } from 'react'
import { Store } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { toFieldErrors } from '../../lib/formErrors'
import { VENDOR_STATUS_MESSAGE, VENDOR_STATUS_TONE, readableStatus } from '../../constants/status'
import { Panel } from '../dashboard/widgets'
import Badge from '../ui/Badge'
import TextField from '../ui/TextField'
import TextArea from '../ui/TextArea'
import Button from '../ui/Button'
import Alert from '../ui/Alert'

function BecomeVendorCard() {
  const { token } = useAuth()
  const { data, loading, reload } = useApi('/vendors/me', { auth: true })
  const [form, setForm] = useState({ storeName: '', storeDescription: '', logo: '' })
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
    try {
      await apiRequest('/vendors', {
        method: 'POST',
        token,
        body: { ...form, logo: form.logo || undefined },
      })
      reload()
    } catch (err) {
      setFieldErrors(toFieldErrors(err.errors))
      if (!err.errors?.length) setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  const vendor = data?.vendor

  if (vendor) {
    return (
      <Panel title="Vendor application">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{vendor.storeName}</p>
            <Badge tone={VENDOR_STATUS_TONE[vendor.status]}>{readableStatus(vendor.status)}</Badge>
          </div>
          <p className="text-sm text-slate-600">{VENDOR_STATUS_MESSAGE[vendor.status]}</p>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="Become a vendor">
      <p className="mb-4 text-sm text-slate-500">
        Apply to open your own store. An admin will review your application.
      </p>
      <form noValidate className="space-y-4" onSubmit={handleSubmit}>
        <Alert>{formError}</Alert>
        <TextField
          id="storeName"
          name="storeName"
          label="Store name"
          icon={Store}
          placeholder="My Awesome Store"
          value={form.storeName}
          onChange={handleChange}
          error={fieldErrors.storeName}
        />
        <TextArea
          id="storeDescription"
          name="storeDescription"
          label="Store description"
          placeholder="What will you sell?"
          value={form.storeDescription}
          onChange={handleChange}
          error={fieldErrors.storeDescription}
        />
        <TextField
          id="logo"
          name="logo"
          label="Logo URL (optional)"
          placeholder="https://..."
          value={form.logo}
          onChange={handleChange}
          error={fieldErrors.logo}
        />
        <Button type="submit" loading={submitting}>
          Submit application
        </Button>
      </form>
    </Panel>
  )
}

export default BecomeVendorCard
