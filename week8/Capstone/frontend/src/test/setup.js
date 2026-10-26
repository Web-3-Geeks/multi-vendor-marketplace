import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom doesn't implement these; the app calls them when it scrolls to a section or page.
window.scrollTo = vi.fn()
Element.prototype.scrollIntoView = vi.fn()
