import { formatPrice } from './format'
import { readableStatus } from '../constants/status'

const status = (value) => (value ? readableStatus(value) : '')

// One plain-English sentence per audit entry.
export function describeAudit(log) {
  const m = log.metadata || {}
  switch (log.action) {
    case 'PAYMENT_CREATED':
      return `Payment started for ${formatPrice(m.amount)}`
    case 'PAYMENT_PAID':
      return `Payment of ${formatPrice(m.amount)} confirmed`
    case 'PAYMENT_FAILED':
      return `Payment of ${formatPrice(m.amount)} failed`
    case 'PAYMENT_CANCELLED':
      return `Payment cancelled${m.reason ? ` (${m.reason.toLowerCase()})` : ''}`
    case 'PAYMENT_REFUNDED':
      return `Payment of ${formatPrice(m.amount)} refunded${m.reason ? `: ${m.reason}` : ''}`
    case 'ORDER_STATUS_CHANGED':
      return m.orderStatusFrom === m.orderStatusTo && m.itemStatus
        ? `Items marked ${status(m.itemStatus)}`
        : `Order moved from ${status(m.orderStatusFrom)} to ${status(m.orderStatusTo)}${m.reason ? ` (${m.reason.toLowerCase()})` : ''}`
    case 'ORDER_AUTO_CANCELLED':
      return `Order cancelled automatically: ${(m.reason || 'unpaid').toLowerCase()}`
    case 'VENDOR_STATUS_CHANGED':
      return `Store "${m.storeName}" changed from ${status(m.from)} to ${status(m.to)}`
    case 'PRODUCT_STATUS_CHANGED':
      return `Product "${m.name}" changed from ${status(m.from)} to ${status(m.to)}`
    case 'CATEGORY_CREATED':
      return `Category "${m.name}" created`
    case 'CATEGORY_UPDATED':
      return `Category "${m.name}" updated`
    case 'CATEGORY_DELETED':
      return `Category "${m.name}" deleted`
    default:
      return readableStatus(log.action)
  }
}

export function describeActor(log) {
  if (log.source === 'webhook') return 'Payment provider'
  if (!log.actor) return 'System'
  return log.actor.name ? `${log.actor.name} (${status(log.actorRole)})` : status(log.actorRole)
}

export const AUDIT_ACTIONS = [
  'PAYMENT_CREATED',
  'PAYMENT_PAID',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'PAYMENT_REFUNDED',
  'ORDER_STATUS_CHANGED',
  'ORDER_AUTO_CANCELLED',
  'VENDOR_STATUS_CHANGED',
  'PRODUCT_STATUS_CHANGED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DELETED',
]
