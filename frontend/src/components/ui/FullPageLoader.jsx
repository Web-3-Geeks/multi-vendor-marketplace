import { LoaderCircle } from 'lucide-react'

function FullPageLoader() {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100">
      <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-indigo-600" />
      <p className="text-sm text-slate-500">Checking your session...</p>
    </div>
  )
}

export default FullPageLoader
