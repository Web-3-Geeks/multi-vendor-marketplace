import { CircleAlert, CircleCheck } from 'lucide-react'

const variants = {
  error: {
    icon: CircleAlert,
    role: 'alert',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  success: {
    icon: CircleCheck,
    role: 'status',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
}

function Alert({ children, variant = 'error' }) {
  if (!children) return null
  const { icon: Icon, role, className } = variants[variant]

  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

export default Alert
