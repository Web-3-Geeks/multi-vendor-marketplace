import { MapPin } from 'lucide-react'

export function AddressLines({ address }) {
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ')

  return (
    <address className="space-y-0.5 text-sm not-italic text-slate-600">
      <p className="font-medium text-slate-900">{address.fullName}</p>
      <p>{address.line1}</p>
      {address.line2 && <p>{address.line2}</p>}
      <p>{cityLine}</p>
      <p>{address.country}</p>
      <p className="pt-1 text-slate-500">{address.phone}</p>
    </address>
  )
}

function ShippingAddress({ address }) {
  if (!address) return null

  return (
    <section
      aria-label="Shipping address"
      className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
    >
      <p className="mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-3 text-sm font-semibold">
        <MapPin aria-hidden="true" className="size-4 text-slate-400" />
        Shipping address
      </p>
      <AddressLines address={address} />
    </section>
  )
}

export default ShippingAddress
