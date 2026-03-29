import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ContestantCard from '../components/ContestantCard'
import type { Contestant } from '../types'

const contestant: Contestant = {
  id: '1',
  name: 'Abigail',
  age: 33,
  photoUrl: '/abigail.jpg',
}

describe('ContestantCard', () => {
  it('renders contestant name and age', () => {
    render(<ContestantCard contestant={contestant} />)
    expect(screen.getByText('Abigail')).toBeInTheDocument()
    expect(screen.getByText('33 jaar')).toBeInTheDocument()
  })

  it('renders contestant photo with alt text', () => {
    render(<ContestantCard contestant={contestant} />)
    const img = screen.getByAltText('Abigail') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('/abigail.jpg')
  })

  it('shows rank number when provided', () => {
    render(<ContestantCard contestant={contestant} rank={3} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('does not show rank when not provided', () => {
    render(<ContestantCard contestant={contestant} />)
    expect(screen.queryByText(/#\d/)).not.toBeInTheDocument()
  })

  it('applies eliminated class when eliminated', () => {
    const { container } = render(<ContestantCard contestant={contestant} eliminated />)
    expect(container.querySelector('.eliminated')).toBeInTheDocument()
  })

  it('does not apply eliminated class by default', () => {
    const { container } = render(<ContestantCard contestant={contestant} />)
    expect(container.querySelector('.eliminated')).not.toBeInTheDocument()
  })

  it('falls back to dicebear avatar when image fails to load', () => {
    render(<ContestantCard contestant={contestant} />)
    const img = screen.getByAltText('Abigail') as HTMLImageElement
    fireEvent.error(img)
    expect(img.src).toContain('dicebear')
  })
})
