import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SuspicionLevelPicker from '../components/notebook/SuspicionLevelPicker'

function renderPicker(level?: number, disabled = false) {
  const onChange = vi.fn()
  render(<SuspicionLevelPicker level={level} disabled={disabled} onChange={onChange} />)
  return { onChange }
}

describe('SuspicionLevelPicker', () => {
  it('renders 5 star buttons', () => {
    renderPicker()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('marks the active star as checked', () => {
    renderPicker(3)
    expect(screen.getByRole('radio', { name: '3 ster' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '1 ster' })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange with the clicked level', () => {
    const { onChange } = renderPicker()
    fireEvent.click(screen.getByRole('radio', { name: '4 ster' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('calls onChange with undefined when clicking the active star (deselect)', () => {
    const { onChange } = renderPicker(2)
    fireEvent.click(screen.getByRole('radio', { name: '2 ster' }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('does not call onChange when disabled', () => {
    const { onChange } = renderPicker(undefined, true)
    fireEvent.click(screen.getByRole('radio', { name: '3 ster' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ArrowRight moves focus to next star and calls onChange', () => {
    const { onChange } = renderPicker(2)
    fireEvent.keyDown(screen.getByRole('radio', { name: '2 ster' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('ArrowRight wraps from 5 to 1', () => {
    const { onChange } = renderPicker(5)
    fireEvent.keyDown(screen.getByRole('radio', { name: '5 ster' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('ArrowLeft moves focus to previous star', () => {
    const { onChange } = renderPicker(3)
    fireEvent.keyDown(screen.getByRole('radio', { name: '3 ster' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('ArrowLeft wraps from 1 to 5', () => {
    const { onChange } = renderPicker(1)
    fireEvent.keyDown(screen.getByRole('radio', { name: '1 ster' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('ArrowDown behaves like ArrowRight', () => {
    const { onChange } = renderPicker(2)
    fireEvent.keyDown(screen.getByRole('radio', { name: '2 ster' }), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('ArrowUp behaves like ArrowLeft', () => {
    const { onChange } = renderPicker(3)
    fireEvent.keyDown(screen.getByRole('radio', { name: '3 ster' }), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('Home key jumps to first star', () => {
    const { onChange } = renderPicker(4)
    fireEvent.keyDown(screen.getByRole('radio', { name: '4 ster' }), { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('End key jumps to last star', () => {
    const { onChange } = renderPicker(2)
    fireEvent.keyDown(screen.getByRole('radio', { name: '2 ster' }), { key: 'End' })
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('ignores unrelated key presses', () => {
    const { onChange } = renderPicker(2)
    fireEvent.keyDown(screen.getByRole('radio', { name: '2 ster' }), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange on keyboard when disabled', () => {
    const { onChange } = renderPicker(2, true)
    fireEvent.keyDown(screen.getByRole('radio', { name: '2 ster' }), { key: 'ArrowRight' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('gives tabIndex 0 to the first star when no level is set', () => {
    renderPicker()
    expect(screen.getByRole('radio', { name: '1 ster' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: '2 ster' })).toHaveAttribute('tabindex', '-1')
  })

  it('gives tabIndex 0 to the active star when a level is set', () => {
    renderPicker(3)
    expect(screen.getByRole('radio', { name: '3 ster' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: '1 ster' })).toHaveAttribute('tabindex', '-1')
  })
})
