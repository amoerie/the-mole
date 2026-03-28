import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RankingBoard from '../components/RankingBoard';
import type { Contestant } from '../types';

const contestants: Contestant[] = [
  { id: '1', name: 'Alice', age: 30, photoUrl: '/alice.jpg' },
  { id: '2', name: 'Bob', age: 25, photoUrl: '/bob.jpg' },
  { id: '3', name: 'Charlie', age: 35, photoUrl: '/charlie.jpg' },
];

describe('RankingBoard', () => {
  it('renders all contestants', () => {
    render(<RankingBoard contestants={contestants} onSubmit={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows rank numbers', () => {
    render(<RankingBoard contestants={contestants} onSubmit={() => {}} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('calls onSubmit with ordered IDs when submit button clicked', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<RankingBoard contestants={contestants} onSubmit={onSubmit} />);

    await user.click(screen.getByText('Rangschikking indienen'));
    expect(onSubmit).toHaveBeenCalledWith(['1', '2', '3']);
  });

  it('uses initialOrder when provided', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <RankingBoard contestants={contestants} initialOrder={['3', '1', '2']} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByText('Rangschikking indienen'));
    expect(onSubmit).toHaveBeenCalledWith(['3', '1', '2']);
  });

  it('disabled state prevents submission', () => {
    render(<RankingBoard contestants={contestants} onSubmit={() => {}} disabled />);
    const button = screen.getByText('Deadline verstreken');
    expect(button).toBeDisabled();
  });
});
