import { useState } from 'react'
import { Pencil, Tag, Trash2, X } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { toFieldErrors } from '../../lib/formErrors'
import { Panel, EmptyState } from '../dashboard/widgets'
import TextField from '../ui/TextField'
import TextArea from '../ui/TextArea'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import Spinner from '../ui/Spinner'

const emptyForm = { name: '', description: '' }

function AdminCategoriesPanel() {
  const { token } = useAuth()
  const { data, loading, error, reload } = useApi('/categories')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const categories = data?.categories || []

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const startEdit = (category) => {
    setEditingId(category._id)
    setForm({ name: category.name, description: category.description || '' })
    setFieldErrors({})
    setFormError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFieldErrors({})
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFieldErrors({})
    setSubmitting(true)
    try {
      if (editingId) {
        await apiRequest(`/categories/${editingId}`, { method: 'PATCH', token, body: form })
      } else {
        await apiRequest('/categories', { method: 'POST', token, body: form })
      }
      cancelEdit()
      reload()
    } catch (err) {
      setFieldErrors(toFieldErrors(err.errors))
      if (!err.errors?.length) setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (category) => {
    setDeleteError('')
    setBusyId(category._id)
    try {
      await apiRequest(`/categories/${category._id}`, { method: 'DELETE', token })
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel title="Categories">
      <form noValidate className="mb-5 space-y-3 rounded-2xl bg-slate-50/70 p-3.5" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {editingId ? 'Edit category' : 'New category'}
          </p>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              <X className="size-3.5" />
              Cancel
            </button>
          )}
        </div>
        <Alert>{formError}</Alert>
        <TextField
          id="categoryName"
          name="name"
          label="Name"
          icon={Tag}
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
        />
        <TextArea
          id="categoryDescription"
          name="description"
          label="Description (optional)"
          rows={2}
          value={form.description}
          onChange={handleChange}
          error={fieldErrors.description}
        />
        <Button type="submit" loading={submitting} fullWidth={false} size="sm">
          {editingId ? 'Save changes' : 'Add category'}
        </Button>
      </form>

      {deleteError && (
        <div className="mb-3">
          <Alert>{deleteError}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading categories..." />
      ) : categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" text="Add a category to organize products." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {categories.map((category) => (
            <li key={category._id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{category.name}</p>
                <p className="truncate text-xs text-slate-400">/{category.slug}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(category)}
                  aria-label={`Edit ${category.name}`}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(category)}
                  disabled={busyId === category._id}
                  aria-label={`Delete ${category.name}`}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default AdminCategoriesPanel
