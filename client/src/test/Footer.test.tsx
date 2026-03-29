import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import Footer from '../components/Footer'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Footer', () => {
  it('renders nothing when no env vars are set', () => {
    vi.stubEnv('VITE_BUILD_DATE', '')
    vi.stubEnv('VITE_COMMIT_SHA', '')
    const { container } = render(<Footer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the short commit SHA when only VITE_COMMIT_SHA is set', () => {
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    vi.stubEnv('VITE_BUILD_DATE', '')
    render(<Footer />)
    expect(screen.getByText('abc1234')).toBeInTheDocument()
  })

  it('renders only 7 characters of the commit SHA', () => {
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    vi.stubEnv('VITE_BUILD_DATE', '')
    render(<Footer />)
    expect(screen.queryByText('abc1234567890')).not.toBeInTheDocument()
    expect(screen.getByText('abc1234')).toBeInTheDocument()
  })

  it('renders formatted date when only VITE_BUILD_DATE is set', () => {
    vi.stubEnv('VITE_BUILD_DATE', '2026-03-29T14:00:00Z')
    vi.stubEnv('VITE_COMMIT_SHA', '')
    render(<Footer />)
    // Date should appear somewhere in the footer
    const footer = screen.getByRole('contentinfo')
    expect(footer.textContent).toMatch(/2026/)
  })

  it('renders both date and SHA with separator when both are set', () => {
    vi.stubEnv('VITE_BUILD_DATE', '2026-03-29T14:00:00Z')
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    render(<Footer />)
    expect(screen.getByText('·')).toBeInTheDocument()
    expect(screen.getByText('abc1234')).toBeInTheDocument()
  })
})
