import { LoaderCircle } from 'lucide-react'

function Spinner({ label = 'Loading...' }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2 py-12">
      <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-indigo-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

export default Spinner
