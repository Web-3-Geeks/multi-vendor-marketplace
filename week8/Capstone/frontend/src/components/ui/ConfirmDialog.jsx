import { useState } from 'react'
import Alert from './Alert'
import Button from './Button'
import Modal from './Modal'

const TONES = {
  danger: 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-500 focus-visible:ring-rose-200',
  primary: '',
}

// Asks "are you sure?" before a destructive action. `onConfirm` may be async: the
// dialog shows a spinner while it runs and stays open with the error if it fails.
// The parent closes it (by clearing its own state) once the action succeeded.
function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setError('')
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <div className="text-sm text-slate-600">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <Button type="button" fullWidth={false} loading={busy} onClick={handleConfirm} className={TONES[tone]}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
