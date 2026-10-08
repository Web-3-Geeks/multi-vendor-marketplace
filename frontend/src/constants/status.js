export const VENDOR_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
})

export const PRODUCT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  ARCHIVED: 'ARCHIVED',
})

export const VENDOR_STATUS_TONE = {
  [VENDOR_STATUS.PENDING]: 'amber',
  [VENDOR_STATUS.APPROVED]: 'emerald',
  [VENDOR_STATUS.SUSPENDED]: 'rose',
  [VENDOR_STATUS.REJECTED]: 'slate',
}

export const PRODUCT_STATUS_TONE = {
  [PRODUCT_STATUS.DRAFT]: 'slate',
  [PRODUCT_STATUS.ACTIVE]: 'emerald',
  [PRODUCT_STATUS.OUT_OF_STOCK]: 'amber',
  [PRODUCT_STATUS.ARCHIVED]: 'rose',
}

export const VENDOR_STATUS_MESSAGE = {
  [VENDOR_STATUS.PENDING]:
    'Your application is under review. You can start selling once an admin approves your store.',
  [VENDOR_STATUS.APPROVED]: 'Your store is approved. You can publish products to the marketplace.',
  [VENDOR_STATUS.SUSPENDED]:
    'Your store is suspended, so your products are hidden from the marketplace. Contact an admin for details.',
  [VENDOR_STATUS.REJECTED]:
    'Your application was rejected. Contact an admin if you think this is a mistake.',
}

export const readableStatus = (status) =>
  status
    .split('_')
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ')

export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
})

// Same forward order as the backend's ORDER_STATUS_SEQUENCE -- used to figure out
// which status a vendor can move an order segment to next.
export const ORDER_STATUS_SEQUENCE = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
]

export const ORDER_STATUS_TONE = {
  [ORDER_STATUS.PENDING]: 'slate',
  [ORDER_STATUS.CONFIRMED]: 'indigo',
  [ORDER_STATUS.PROCESSING]: 'amber',
  [ORDER_STATUS.SHIPPED]: 'indigo',
  [ORDER_STATUS.DELIVERED]: 'emerald',
  [ORDER_STATUS.CANCELLED]: 'rose',
}

// The one status a vendor can move an order segment to next, or null if it's
// already in a terminal state (matches the backend's isValidTransition rule:
// one step forward at a time).
export const nextOrderStatus = (status) => {
  const index = ORDER_STATUS_SEQUENCE.indexOf(status)
  if (index === -1 || index === ORDER_STATUS_SEQUENCE.length - 1) return null
  return ORDER_STATUS_SEQUENCE[index + 1]
}

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
})

export const PAYMENT_STATUS_TONE = {
  [PAYMENT_STATUS.PENDING]: 'slate',
  [PAYMENT_STATUS.PROCESSING]: 'amber',
  [PAYMENT_STATUS.PAID]: 'emerald',
  [PAYMENT_STATUS.FAILED]: 'rose',
  [PAYMENT_STATUS.REFUNDED]: 'indigo',
  [PAYMENT_STATUS.CANCELLED]: 'slate',
}

// On an order, PENDING means nothing has been paid yet.
export const orderPaymentLabel = (status) => (status === PAYMENT_STATUS.PENDING ? 'Unpaid' : readableStatus(status))

export const COMMISSION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
})

export const COMMISSION_STATUS_TONE = {
  [COMMISSION_STATUS.PENDING]: 'amber',
  [COMMISSION_STATUS.PAID]: 'emerald',
  [COMMISSION_STATUS.REFUNDED]: 'indigo',
  [COMMISSION_STATUS.CANCELLED]: 'slate',
}
