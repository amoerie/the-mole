export const NOTEBOOK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  red: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-900' },
  orange: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-900' },
  green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
  teal: { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-900' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900' },
  pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
}

export const DEFAULT_COLOR_PALETTE = Object.keys(NOTEBOOK_COLORS)
