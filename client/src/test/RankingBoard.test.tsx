import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RankingBoard from '../components/RankingBoard'
import type { Contestant } from '../types'

const contestants: Contestant[] = [
  { id: '1', name: 'Alice', age: 30, photoUrl: '/alice.jpg' },
  { id: '2', name: 'Bob', age: 25, photoUrl: '/bob.jpg' },
  { id: '3', name: 'Charlie', age: 35, photoUrl: '/charlie.jpg' },
]

describe('RankingBoard', () => {
  it('renders all contestants', () => {
    render(<RankingBoard contestants={contestants} onChange={() => {}} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('shows rank numbers', () => {
    render(<RankingBoard contestants={contestants} onChange={() => {}} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('does not call onChange on initial render', () => {
    const onChange = vi.fn()
    render(<RankingBoard contestants={contestants} onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('uses initialOrder when provided', () => {
    render(
      <RankingBoard contestants={contestants} initialOrder={['3', '1', '2']} onChange={() => {}} />,
    )
    const items = screen.getAllByText(/^#\d$/)
    // Charlie should be #1, Alice #2, Bob #3
    const rows = screen.getAllByRole('img').map((img) => (img as HTMLImageElement).alt)
    expect(rows).toEqual(['Charlie', 'Alice', 'Bob'])
  })

  it('does not show submit button', () => {
    render(<RankingBoard contestants={contestants} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /indienen|bijwerken/i })).not.toBeInTheDocument()
  })

  it('triggers onError fallback for broken image', () => {
    render(<RankingBoard contestants={contestants} onChange={() => {}} />)
    const imgs = screen.getAllByRole('img')
    const img = imgs[0] as HTMLImageElement
    Object.defineProperty(img, 'src', { writable: true, value: '' })
    fireEvent.error(img)
    expect(img.src).toContain('dicebear')
  })
})
