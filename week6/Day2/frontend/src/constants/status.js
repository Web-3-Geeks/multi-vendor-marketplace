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
