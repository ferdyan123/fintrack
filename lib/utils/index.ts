import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Transaction, GroupedTransaction } from '@/types'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format Rupiah — SELALU format penuh: Rp 1.000.000
 * Parameter `short` dihapus karena tidak dipakai lagi.
 * Semua pemanggil formatRupiah(x, true) otomatis dapat format penuh.
 */
export function formatRupiah(amount: number, _short = false): string {
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

// ✅ BARU — Kelompokkan transaksi kasir yang di-checkout dalam 1x klik "Selesai & Catat"
// (transaction_group_id sama) jadi 1 baris tampilan. Expense/manual/catering tidak
// ikut dikelompokkan (tetap 1:1), karena bukan hasil checkout multi-produk dari 1 keranjang.
export function groupTransactions(transactions: Transaction[]): GroupedTransaction[] {
  const map = new Map<string, Transaction[]>()

  for (const t of transactions) {
    const key = t.type === 'income' && t.source === 'kasir' && t.transaction_group_id
      ? t.transaction_group_id
      : t.id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }

  return Array.from(map.entries())
    .map(([key, items]) => {
      const first = items[0]

      // note format dari kasir: "NamaCustomer · Tunai" atau cuma "Tunai" kalau nama kosong
      const customerName = (() => {
        if (!first.note) return undefined
        const parts = first.note.split(' · ')
        if (parts.length === 2 && (parts[1] === 'Tunai' || parts[1] === 'QRIS')) return parts[0]
        return undefined
      })()

      return {
        id: key,
        type: first.type,
        category: items.length > 1 ? 'Penjualan' : first.category,
        customerName,
        amount: items.reduce((s, t) => s + t.amount, 0),
        profit: items.every((t) => t.profit !== undefined)
          ? items.reduce((s, t) => s + (t.profit ?? 0), 0)
          : undefined,
        qty: items.reduce((s, t) => s + (t.qty ?? 0), 0),
        payment_method: first.payment_method,
        source: first.source,
        date: first.date,
        created_at: items.reduce((min, t) => (t.created_at < min ? t.created_at : min), first.created_at),
        note: first.note,
        items,
      } satisfies GroupedTransaction
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}