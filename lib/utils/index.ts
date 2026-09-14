import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format Rupiah
export function formatRupiah(amount: number, short = false): string {
  if (short) {
    if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`
    if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`
    if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}rb`
    return `Rp ${amount}`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Format tanggal ke Indonesia
export function formatDate(date: string | Date, format: 'short' | 'long' | 'time' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const options: Intl.DateTimeFormatOptions =
    format === 'long'
      ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      : format === 'time'
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('id-ID', options).format(d)
}

// Format ke YYYY-MM-DD untuk Supabase
export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

// Format ke YYYY-MM untuk bulan
export function toMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Hitung margin %
export function calcMargin(price: number, hpp: number): number {
  if (price === 0) return 0
  return Math.round(((price - hpp) / price) * 100)
}

// Generate kode toko (6 karakter)
export function generateStoreCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Berapa hari dari sekarang
export function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
