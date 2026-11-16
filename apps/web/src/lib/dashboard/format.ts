import type { Price } from './types'

const rm = (n: number) => `RM${Math.round(n).toLocaleString('en-MY')}`

/** RM150, or RM120–RM180 when there's a range. */
export function formatPrice(price: Price | null): string {
  if (!price) return '—'
  return price.max !== undefined && price.max !== price.min ? `${rm(price.min)}–${rm(price.max)}` : rm(price.min)
}

const relative = new Intl.RelativeTimeFormat('en-MY', { numeric: 'auto', style: 'short' })

/** "5 min ago", "yesterday", "3 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day')
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Full date/time for tooltips and screen readers. */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
}

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/** How long something has been waiting: "6 min", "2 hr", "3 days". */
export function waitingFor(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'under a min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
