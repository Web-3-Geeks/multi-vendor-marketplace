const PHONE = /^[0-9+()\-\s]{7,20}$/
const POSTAL = /^[A-Za-z0-9\s-]{3,12}$/

export const ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country']

export const EMPTY_ADDRESS = Object.freeze(Object.fromEntries(ADDRESS_FIELDS.map((key) => [key, ''])))

const REQUIRED = {
  fullName: ['Full name', 100],
  phone: ['Phone number', 20],
  line1: ['Address', 200],
  city: ['City', 100],
  postalCode: ['Postal code', 12],
  country: ['Country', 100],
}

const OPTIONAL = { line2: ['Address line 2', 200], state: ['State or region', 100] }

// Mirrors the backend's checkout rules so most mistakes are caught before a request is sent.
// The backend remains the real check.
export function validateAddress(values) {
  const errors = {}
  const value = (key) => (values[key] || '').trim()

  for (const [key, [label, max]] of Object.entries(REQUIRED)) {
    if (!value(key)) errors[key] = `${label} is required`
    else if (value(key).length > max) errors[key] = `${label} must be at most ${max} characters`
  }
  for (const [key, [label, max]] of Object.entries(OPTIONAL)) {
    if (value(key).length > max) errors[key] = `${label} must be at most ${max} characters`
  }
  if (!errors.phone && !PHONE.test(value('phone'))) errors.phone = 'Enter a valid phone number'
  if (!errors.postalCode && !POSTAL.test(value('postalCode'))) errors.postalCode = 'Enter a valid postal code'
  return errors
}

export function toShippingPayload(values) {
  const payload = {}
  for (const key of ADDRESS_FIELDS) {
    const trimmed = (values[key] || '').trim()
    if (trimmed) payload[key] = trimmed
  }
  return payload
}

// Backend validation errors look like { field: 'shippingAddress.phone', message }.
export function addressErrorsFromApi(errors = []) {
  const result = {}
  for (const { field, message } of errors) {
    const match = /^shippingAddress\.(\w+)$/.exec(field || '')
    if (match && !result[match[1]]) result[match[1]] = message
  }
  return result
}
