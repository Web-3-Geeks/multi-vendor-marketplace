import { describe, expect, test } from 'vitest'
import { AUDIT_ACTIONS, describeActor, describeAudit } from './audit'

const log = (action, metadata = {}, extra = {}) => ({ action, metadata, source: 'api', actor: null, actorRole: 'SYSTEM', ...extra })

describe('describeAudit', () => {
  test.each([
    [log('PAYMENT_CREATED', { amount: 40 }), 'Payment started for $40.00'],
    [log('PAYMENT_PAID', { amount: 40 }), 'Payment of $40.00 confirmed'],
    [log('PAYMENT_FAILED', { amount: 40 }), 'Payment of $40.00 failed'],
    [log('PAYMENT_CANCELLED', { reason: 'Payment session expired' }), 'Payment cancelled (payment session expired)'],
    [log('PAYMENT_REFUNDED', { amount: 40, reason: 'Wrong item' }), 'Payment of $40.00 refunded: Wrong item'],
    [log('PAYMENT_REFUNDED', { amount: 40 }), 'Payment of $40.00 refunded'],
    [log('ORDER_AUTO_CANCELLED', { reason: 'Unpaid for 24 hours' }), 'Order cancelled automatically: unpaid for 24 hours'],
    [log('VENDOR_STATUS_CHANGED', { storeName: 'Demo Store', from: 'PENDING', to: 'APPROVED' }), 'Store "Demo Store" changed from Pending to Approved'],
    [log('PRODUCT_STATUS_CHANGED', { name: 'Mouse', from: 'ACTIVE', to: 'ARCHIVED' }), 'Product "Mouse" changed from Active to Archived'],
    [log('CATEGORY_CREATED', { name: 'Toys' }), 'Category "Toys" created'],
    [log('CATEGORY_UPDATED', { name: 'Toys' }), 'Category "Toys" updated'],
    [log('CATEGORY_DELETED', { name: 'Toys' }), 'Category "Toys" deleted'],
  ])('describes %#', (entry, sentence) => {
    expect(describeAudit(entry)).toBe(sentence)
  })

  test('an order moving between statuses names both ends and the reason', () => {
    const entry = log('ORDER_STATUS_CHANGED', { orderStatusFrom: 'PENDING', orderStatusTo: 'CONFIRMED', reason: 'Payment confirmed' })
    expect(describeAudit(entry)).toBe('Order moved from Pending to Confirmed (payment confirmed)')
  })

  test('an item-level change that leaves the order where it was is described by the item status', () => {
    const entry = log('ORDER_STATUS_CHANGED', { itemStatus: 'SHIPPED', orderStatusFrom: 'PROCESSING', orderStatusTo: 'PROCESSING' })
    expect(describeAudit(entry)).toBe('Items marked Shipped')
  })

  test('an unknown action falls back to a readable label', () => {
    expect(describeAudit(log('SOMETHING_NEW'))).toBe('Something New')
  })

  test('every action the filter offers has a sentence', () => {
    for (const action of AUDIT_ACTIONS) expect(describeAudit(log(action, { amount: 1, name: 'x', storeName: 'x' }))).not.toBe('')
  })
})

describe('describeActor', () => {
  test('a payment-provider webhook', () => {
    expect(describeActor(log('PAYMENT_PAID', {}, { source: 'webhook' }))).toBe('Payment provider')
  })

  test('the system when nobody triggered it', () => {
    expect(describeActor(log('ORDER_AUTO_CANCELLED', {}, { source: 'system' }))).toBe('System')
  })

  test('a person with their role', () => {
    const entry = log('PAYMENT_CREATED', {}, { actor: { id: '1', name: 'Ayesha Khan' }, actorRole: 'CUSTOMER' })
    expect(describeActor(entry)).toBe('Ayesha Khan (Customer)')
  })

  test('a person known only by id shows just the role', () => {
    expect(describeActor(log('PAYMENT_CREATED', {}, { actor: { id: '1' }, actorRole: 'ADMIN' }))).toBe('Admin')
  })
})
