import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RankingBoard from '../components/RankingBoard'
import type { Contestant } from '../types'
import type { DragEndEvent } from '@dnd-kit/core'

// Expose the onDragEnd handler so tests can fire drag events directly
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: React.ReactNode
      onDragEnd: (event: DragEndEvent) => void
    }) => {
      capturedOnDragEnd = onDragEnd
      return <>{children}</>
    },
  }
})

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

  it('calls onChange with new order when items are dragged to a different position', () => {
    const onChange = vi.fn()
    render(<RankingBoard contestants={contestants} onChange={onChange} />)
    act(() => {
      capturedOnDragEnd!({ active: { id: '1' }, over: { id: '3' } } as DragEndEvent)
    })
    expect(onChange).toHaveBeenCalledWith(['2', '3', '1'])
  })

  it('does not call onChange when item is dropped on itself', () => {
    const onChange = vi.fn()
    render(<RankingBoard contestants={contestants} onChange={onChange} />)
    act(() => {
      capturedOnDragEnd!({ active: { id: '1' }, over: { id: '1' } } as DragEndEvent)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when dropped outside any item', () => {
    const onChange = vi.fn()
    render(<RankingBoard contestants={contestants} onChange={onChange} />)
    act(() => {
      capturedOnDragEnd!({ active: { id: '1' }, over: null } as DragEndEvent)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders with disabled prop without crashing', () => {
    render(<RankingBoard contestants={contestants} onChange={() => {}} disabled />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('skips items whose id is not in the contestants list', () => {
    render(
      <RankingBoard
        contestants={contestants}
        initialOrder={['1', 'ghost-id', '2']}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByText('ghost-id')).not.toBeInTheDocument()
  })

  it('excludes eliminated contestants from onChange when initialOrder contains stale IDs', () => {
    // initialOrder has 3 IDs but contestants only has 2 — '2' (Bob) was eliminated
    const activeContestants = contestants.filter((c) => c.id !== '2')
    const onChange = vi.fn()
    render(
      <RankingBoard
        contestants={activeContestants}
        initialOrder={['1', '2', '3']}
        onChange={onChange}
      />,
    )
    act(() => {
      capturedOnDragEnd!({ active: { id: '1' }, over: { id: '3' } } as DragEndEvent)
    })
    // Submitted IDs must not include the eliminated contestant '2'
    expect(onChange).toHaveBeenCalledWith(['3', '1'])
  })

  it('appends contestants missing from initialOrder to the end', () => {
    // initialOrder only has '1' and '2' — '3' (Charlie) was added after the ranking was saved
    const onChange = vi.fn()
    render(<RankingBoard contestants={contestants} initialOrder={['2', '1']} onChange={onChange} />)
    act(() => {
      capturedOnDragEnd!({ active: { id: '2' }, over: { id: '1' } } as DragEndEvent)
    })
    // '3' should be appended; drag moved '2' after '1'
    expect(onChange).toHaveBeenCalledWith(['1', '2', '3'])
  })
})
