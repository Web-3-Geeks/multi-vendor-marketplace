import { describe, expect, test } from 'vitest'
import { EMPTY_ADDRESS, addressErrorsFromApi, toShippingPayload, validateAddress } from './address'

const valid = {
  fullName: 'Ayesha Khan',
  phone: '+92 300 1234567',
  line1: '12 Garden Road',
  line2: '',
  city: 'Lahore',
  state: '',
  postalCode: '54000',
  country: 'Pakistan',
}

describe('validateAddress', () => {
  test('a complete address has no errors (line 2 and state are optional)', () => {
    expect(validateAddress(valid)).toEqual({})
  })

  test('every required field is reported when empty', () => {
    const errors = validateAddress(EMPTY_ADDRESS)
    expect(Object.keys(errors).sort()).toEqual(['city', 'country', 'fullName', 'line1', 'phone', 'postalCode'])
    expect(errors.phone).toBe('Phone number is required')
  })

  test('whitespace-only values count as empty', () => {
    expect(validateAddress({ ...valid, city: '   ' }).city).toBe('City is required')
  })

  test.each([
    ['phone with letters', { phone: 'call me' }, 'phone', 'Enter a valid phone number'],
    ['too short phone', { phone: '12' }, 'phone', 'Enter a valid phone number'],
    ['postal code with symbols', { postalCode: '!!##' }, 'postalCode', 'Enter a valid postal code'],
    ['too short postal code', { postalCode: '1' }, 'postalCode', 'Enter a valid postal code'],
  ])('rejects %s', (_label, patch, field, message) => {
    expect(validateAddress({ ...valid, ...patch })[field]).toBe(message)
  })

  test('accepts the usual phone and postal code formats', () => {
    for (const phone of ['0300-1234567', '(042) 111 222 333', '+1 555 010 9999']) {
      expect(validateAddress({ ...valid, phone }).phone).toBeUndefined()
    }
    for (const postalCode of ['54000', 'SW1A 1AA', '12345-6789']) {
      expect(validateAddress({ ...valid, postalCode }).postalCode).toBeUndefined()
    }
  })

  test('enforces the same length limits as the server', () => {
    expect(validateAddress({ ...valid, fullName: 'x'.repeat(101) }).fullName).toMatch(/at most 100/)
    expect(validateAddress({ ...valid, line1: 'x'.repeat(201) }).line1).toMatch(/at most 200/)
    expect(validateAddress({ ...valid, line2: 'x'.repeat(201) }).line2).toMatch(/at most 200/)
    expect(validateAddress({ ...valid, state: 'x'.repeat(101) }).state).toMatch(/at most 100/)
  })
})

describe('toShippingPayload', () => {
  test('trims values and drops empty optional fields', () => {
    expect(toShippingPayload({ ...valid, fullName: '  Ayesha  ', line2: '   ', state: '' })).toEqual({
      fullName: 'Ayesha',
      phone: '+92 300 1234567',
      line1: '12 Garden Road',
      city: 'Lahore',
      postalCode: '54000',
      country: 'Pakistan',
    })
  })

  test('ignores fields that are not part of an address', () => {
    expect(toShippingPayload({ ...valid, role: 'ADMIN' })).not.toHaveProperty('role')
  })
})

describe('addressErrorsFromApi', () => {
  test('maps server field paths back to form fields, keeping the first message per field', () => {
    const errors = addressErrorsFromApi([
      { field: 'shippingAddress.phone', message: 'Enter a valid phone number' },
      { field: 'shippingAddress.phone', message: 'second' },
      { field: 'shippingAddress.city', message: 'City is required' },
      { field: 'other', message: 'ignored' },
    ])
    expect(errors).toEqual({ phone: 'Enter a valid phone number', city: 'City is required' })
  })

  test('copes with no errors at all', () => {
    expect(addressErrorsFromApi()).toEqual({})
    expect(addressErrorsFromApi([{ message: 'no field' }])).toEqual({})
  })
})
