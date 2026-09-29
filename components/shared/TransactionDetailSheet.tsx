'use client'

import { useState, useEffect } from 'react'
import {
  Trash2, TrendingUp, Wallet, Hash, Clock, Tag,
  FileText, CreditCard, ShoppingBag, Package, Calendar,
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import type { GroupedTransaction } from '@/types'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// ── Detail sheet — support 2 mode:
//    1. Group berisi 1 item      → tampilan lama (rows key-value biasa)
//    2. Group berisi >1 item     → tampilan baru: ringkasan + list rincian per produk
export default function TransactionDetailSheet({
  group,
  onClose,
  onDelete,
}: {
  group: GroupedTransaction | null
  onClose: () => void
  onDelete?: (group: GroupedTransaction) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!group) { setConfirming(false); setDeleting(false) }
  }, [group])

  if (!group) return null

  const isIncome = group.type === 'income'
  const isMulti = group.items.length > 1

  async function handleDelete() {
    if (!onDelete) return
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    await onDelete(group!)
    setDeleting(false)
    onClose()
  }

  // Baris detail untuk transaksi single-item (perilaku lama, dipertahankan)
  const single = group.items[0]
  const singleRows: { icon: React.ReactNode; label: string; value: string | undefined }[] = [
    { icon: <Tag size={13} />, label: 'Kategori', value: single.category },
    { icon: <Package size={13} />, label: 'Produk', value: single.product_name },
    { icon: <Hash size={13} />, label: 'Qty', value: single.qty ? `${single.qty}` : undefined },
    { icon: <Wallet size={13} />, label: 'Amount', value: formatRupiah(single.amount) },
    { icon: <TrendingUp size={13} />, label: 'Laba', value: single.profit !== undefined ? formatRupiah(single.profit) : undefined },
    { icon: <CreditCard size={13} />, label: 'Bayar', value: isIncome && single.payment_method ? (single.payment_method === 'cash' ? '💵 Cash' : '📱 QRIS') : undefined },
    { icon: <ShoppingBag size={13} />, label: 'Sumber', value: single.source === 'kasir' ? 'Kasir' : single.source === 'catering' ? '🍱 Catering' : 'Manual' },
    { icon: <Calendar size={13} />, label: 'Tanggal', value: formatDate(single.date + ' 00:00:00', 'long') },
    { icon: <Clock size={13} />, label: 'Jam', value: formatTime(single.created_at) },
    { icon: <FileText size={13} />, label: 'Catatan', value: single.note || undefined },
  ]

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40,
        backdropFilter: 'blur(2px)', animation: 'fadeIn .2s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0',
        maxHeight: '82vh', overflowY: 'auto',
        animation: 'slideUp .3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '4px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
              {isMulti ? `Detail Transaksi · ${group.items.length} item` : 'Detail Transaksi'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: isIncome ? 'var(--success)' : 'var(--danger)', fontFamily: 'Nunito, sans-serif' }}>
              {isIncome ? '+' : '−'}{formatRupiah(group.amount)}
            </div>
            {isMulti && group.customerName && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>👤 {group.customerName}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            Tutup
          </button>
        </div>

        {isMulti ? (
          <>
            {/* Ringkasan transaksi gabungan */}
            <div style={{ padding: '10px 0' }}>
              {[
                { icon: <CreditCard size={13} />, label: 'Bayar', value: group.payment_method ? (group.payment_method === 'cash' ? '💵 Cash' : '📱 QRIS') : undefined },
                { icon: <ShoppingBag size={13} />, label: 'Sumber', value: group.source === 'kasir' ? 'Kasir' : group.source === 'catering' ? '🍱 Catering' : 'Manual' },
                { icon: <Calendar size={13} />, label: 'Tanggal', value: formatDate(group.date + ' 00:00:00', 'long') },
                { icon: <Clock size={13} />, label: 'Jam', value: formatTime(group.created_at) },
              ].filter((r) => r.value !== undefined).map((r, i, arr) => (
                <div key={i} style={{ padding: '9px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 72, flexShrink: 0 }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Rincian per produk */}
            <div style={{ padding: '4px 20px 4px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '8px 0' }}>
                Rincian Produk
              </p>
            </div>
            <div style={{ background: 'var(--bg-elevated)', margin: '0 20px 16px', borderRadius: 12, overflow: 'hidden' }}>
              {group.items.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.product_name ?? item.category}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.qty ?? 1}× {formatRupiah(item.amount / (item.qty ?? 1))}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, fontFamily: 'Nunito, sans-serif' }}>
                    {formatRupiah(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ padding: '6px 0' }}>
            {singleRows.filter((r) => r.value !== undefined).map((r, i, arr) => (
              <div key={i} style={{ padding: '9px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }}>{r.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 72, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}

        {onDelete && (
          <div style={{ padding: '12px 20px 32px' }}>
            <button onClick={handleDelete} disabled={deleting} style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: confirming ? 'var(--danger)' : 'var(--danger-bg)',
              color: confirming ? '#fff' : 'var(--danger)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: deleting ? 0.6 : 1, transition: 'background .15s',
            }}>
              <Trash2 size={14} />
              {deleting ? 'Menghapus...' : confirming ? 'Konfirmasi Hapus?' : isMulti ? `Hapus Transaksi (${group.items.length} item)` : 'Hapus Transaksi'}
            </button>
            {confirming && !deleting && (
              <button onClick={() => setConfirming(false)} style={{
                width: '100%', marginTop: 6, padding: '9px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
              }}>
                Batal
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}