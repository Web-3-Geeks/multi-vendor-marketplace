import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { apiRequest } from './api'

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  test('sends JSON bodies with a content type and the bearer token', async () => {
    fetch.mockResolvedValue(respond(200, { ok: true }))
    const data = await apiRequest('/checkout', { method: 'POST', token: 'abc', body: { a: 1 } })
    expect(data).toEqual({ ok: true })

    const [url, init] = fetch.mock.calls[0]
    expect(url).toMatch(/\/checkout$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer abc' })
  })

  test('a plain GET sends neither a body nor an Authorization header', async () => {
    fetch.mockResolvedValue(respond(200, {}))
    await apiRequest('/products')
    const [, init] = fetch.mock.calls[0]
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.headers).toEqual({})
  })

  test('an error response becomes an Error with the status and the field errors', async () => {
    fetch.mockResolvedValue(respond(400, { message: 'Validation Failed', errors: [{ field: 'email', message: 'Invalid email' }] }))
    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'Validation Failed',
      status: 400,
      errors: [{ field: 'email', message: 'Invalid email' }],
    })
  })

  test('an error without a message or errors gets safe defaults', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json') } })
    await expect(apiRequest('/x')).rejects.toMatchObject({ message: 'Something went wrong', status: 500, errors: [] })
  })

  test('a network failure becomes a friendly message', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiRequest('/x')).rejects.toThrow('Cannot reach the server. Please try again.')
  })
})
