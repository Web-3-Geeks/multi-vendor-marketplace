import { describe, expect, test } from 'vitest'
import { LOW_STOCK_THRESHOLD, formatDate, formatDateTime, formatPrice, stockInfo } from './format'
import { ORDER_STATUS_SEQUENCE, nextOrderStatus, orderPaymentLabel, readableStatus } from '../constants/status'

describe('formatPrice', () => {
  test('uses dollars with two decimals and thousands separators', () => {
    expect(formatPrice(0)).toBe('$0.00')
    expect(formatPrice(49.9)).toBe('$49.90')
    expect(formatPrice(1234567.5)).toBe('$1,234,567.50')
  })
})

describe('dates', () => {
  test('formatDate gives a short readable date', () => {
    expect(formatDate('2026-10-08T12:00:00Z')).toBe('Oct 8, 2026')
  })

  test('formatDateTime adds the time', () => {
    expect(formatDateTime('2026-10-08T12:00:00Z')).toMatch(/Oct 8, 2026/)
    expect(formatDateTime('2026-10-08T12:00:00Z')).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('stockInfo', () => {
  test('out of stock, low stock and in stock', () => {
    expect(stockInfo(0)).toEqual({ label: 'Out of stock', tone: 'rose' })
    expect(stockInfo(-1).label).toBe('Out of stock')
    expect(stockInfo(LOW_STOCK_THRESHOLD)).toEqual({ label: `Only ${LOW_STOCK_THRESHOLD} left`, tone: 'amber' })
    expect(stockInfo(LOW_STOCK_THRESHOLD + 1)).toEqual({ label: 'In stock', tone: 'emerald' })
  })
})

describe('status helpers', () => {
  test('readableStatus turns constants into words', () => {
    expect(readableStatus('OUT_OF_STOCK')).toBe('Out Of Stock')
    expect(readableStatus('PENDING')).toBe('Pending')
  })

  test('an order that is PENDING is shown as Unpaid, other payment states keep their name', () => {
    expect(orderPaymentLabel('PENDING')).toBe('Unpaid')
    expect(orderPaymentLabel('PAID')).toBe('Paid')
    expect(orderPaymentLabel('REFUNDED')).toBe('Refunded')
  })

  test('nextOrderStatus walks the fulfilment sequence one step and stops at the end', () => {
    expect(nextOrderStatus('CONFIRMED')).toBe('PROCESSING')
    expect(nextOrderStatus('PROCESSING')).toBe('SHIPPED')
    expect(nextOrderStatus('SHIPPED')).toBe('DELIVERED')
    expect(nextOrderStatus('DELIVERED')).toBeNull()
    expect(nextOrderStatus('CANCELLED')).toBeNull()
    expect(ORDER_STATUS_SEQUENCE[0]).toBe('PENDING')
  })
})
