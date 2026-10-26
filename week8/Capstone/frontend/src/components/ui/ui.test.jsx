import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './ConfirmDialog'
import Modal from './Modal'
import QuantityStepper from './QuantityStepper'
import Pagination from '../marketplace/Pagination'

describe('Modal', () => {
  test('renders into document.body as an accessible dialog and locks page scroll while open', () => {
    const { unmount, container } = render(<Modal title="Edit product" onClose={() => {}}>body</Modal>)
    expect(screen.getByRole('dialog', { name: 'Edit product' })).toBeInTheDocument()
    expect(container).not.toContainElement(screen.getByRole('dialog'))
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  test('closes with Escape, the X button and the backdrop', async () => {
    const onClose = vi.fn()
    render(<Modal title="T" onClose={onClose}>x</Modal>)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    for (const button of screen.getAllByRole('button', { name: 'Close dialog' })) await userEvent.click(button)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

describe('ConfirmDialog', () => {
  const setup = (props = {}) => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()
    render(<ConfirmDialog title="Delete it?" message="This cannot be undone." confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} {...props} />)
    return { onConfirm, onCancel }
  }

  test('shows the question and does nothing until the user decides', () => {
    const { onConfirm, onCancel } = setup()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  test('Cancel calls onCancel only', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('the confirm button runs the action', async () => {
    const { onConfirm } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  test('a failing action keeps the dialog open, shows the error and allows a retry', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('Order already shipped')).mockResolvedValue(undefined)
    setup({ onConfirm })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Order already shipped')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  test('while the action runs, Cancel and Escape are blocked so it cannot be dismissed half way', async () => {
    let finish
    const onConfirm = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    const { onCancel } = setup({ onConfirm })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    finish()
  })
})

describe('QuantityStepper', () => {
  test('plus and minus step by one and respect min and max', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<QuantityStepper value={2} onChange={onChange} min={1} max={3} />)
    await userEvent.click(screen.getByLabelText('Increase quantity'))
    expect(onChange).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByLabelText('Decrease quantity'))
    expect(onChange).toHaveBeenLastCalledWith(1)

    rerender(<QuantityStepper value={3} onChange={onChange} min={1} max={3} />)
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled()
    rerender(<QuantityStepper value={1} onChange={onChange} min={1} max={3} />)
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled()
  })

  test('typing a number above the max is clamped to the max', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={1} onChange={onChange} max={5} />)
    const input = screen.getByLabelText('Quantity')
    await userEvent.clear(input)
    await userEvent.type(input, '9')
    expect(onChange).toHaveBeenLastCalledWith(5)
  })
})

describe('Pagination', () => {
  test('is hidden when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('shows the position and moves one page at a time', async () => {
    const onChange = vi.fn()
    render(<Pagination page={2} totalPages={4} onChange={onChange} />)
    expect(screen.getByText(/of 4/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onChange).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByRole('button', { name: /previous/i }))
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  test('Previous is disabled on the first page and Next on the last', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    rerender(<Pagination page={3} totalPages={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })
})
