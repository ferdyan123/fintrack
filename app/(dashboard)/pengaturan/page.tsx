'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useAppStore } from '@/lib/store/appStore'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, calcMargin } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import type { Product } from '@/types'

const EMOJI_OPTIONS = ['🍽️','🍜','🍚','🍗','🐟','🥚','🥩','🍢','🥘','🍖',
  '🧆','🥙','🌮','🥗','🍱','☕','🧋','🥤','🍵','🧃','🫙','🍰','🧁','🍩','🎂']

type FormData = Omit<Product, 'id'|'store_id'|'created_at'|'photo_url'>

const EMPTY_FORM: FormData = {
  name: '', icon: '🍽️', price: 0, hpp: 0, unit: 'porsi', is_active: true, stock_qty: undefined
}

export default function PengaturanPage() {
  const { products, setProducts, currentStore, theme, setTheme } = useAppStore((s) => ({
    products: s.products, setProducts: s.setProducts,
    currentStore: s.currentStore, theme: s.theme, setTheme: s.setTheme,
  }))
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const margin = form.price > 0 ? calcMargin(form.price, form.hpp) : 0

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setShowForm(true) }
  function openEdit(p: Product) {
    setForm({ name: p.name, icon: p.icon, price: p.price, hpp: p.hpp,
      unit: p.unit, is_active: p.is_active, stock_qty: p.stock_qty })
    setEditId(p.id); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }

  async function handleSave() {
    if (!form.name.trim() || !currentStore) return
    setSaving(true)
    const supabase = createClient()

    if (editId) {
      const { error } = await supabase.from('products').update(form).eq('id', editId)
      if (!error) {
        setProducts(products.map((p) => p.id === editId ? { ...p, ...form } : p))
        toast('Produk berhasil diupdate', 'success')
      } else toast('Gagal update produk', 'error')
    } else {
      const { data, error } = await supabase.from('products')
        .insert({ ...form, store_id: currentStore.id }).select().single()
      if (!error && data) {
        setProducts([...products, data as Product])
        toast('Produk berhasil ditambah', 'success')
      } else toast('Gagal tambah produk', 'error')
    }
    setSaving(false)
    closeForm()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm('Hapus produk "' + name + '"?')) return
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) {
      setProducts(products.filter((p) => p.id !== id))
      toast('Produk dihapus', 'info')
    } else toast('Gagal hapus produk', 'error')
  }

  const S = {
    page: { maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' } as React.CSSProperties,
    section: { marginBottom: 28 } as React.CSSProperties,
    sectionTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
      letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 },
    card: { background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden' } as React.CSSProperties,
  }

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>
        Pengaturan
      </h1>

      {/* Tema */}
      <div style={S.section}>
        <p style={S.sectionTitle}>Tema Tampilan</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['merah', 'drako'] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} style={{
              padding: '10px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer',
              border: theme === t ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: theme === t ? 'var(--accent-subtle)' : 'var(--bg-surface)',
              color: theme === t ? 'var(--accent)' : 'var(--text-secondary)',
            }}>
              {t === 'merah' ? '☀️ Merah' : '🌙 Drako'}
            </button>
          ))}
        </div>
      </div>

      {/* Info Toko */}
      {currentStore && (
        <div style={S.section}>
          <p style={S.sectionTitle}>Info Toko</p>
          <div style={{ ...S.card, padding: 16 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentStore.name}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Kode Toko: <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px',
                borderRadius: 6, fontFamily: 'DM Mono, monospace', color: 'var(--accent)',
                fontWeight: 600 }}>{currentStore.store_code}</code>
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Bagikan kode ini ke kasir untuk akses toko
            </p>
          </div>
        </div>
      )}

      {/* Produk */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ ...S.sectionTitle, marginBottom: 0 }}>Produk & Menu</p>
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 10, background: 'var(--accent)', color: 'white',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={14} /> Tambah
          </button>
        </div>

        {products.length === 0 ? (
          <div style={{ ...S.card, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              Belum ada produk. Tap Tambah untuk mulai.
            </p>
          </div>
        ) : (
          <div style={S.card}>
            {products.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderBottom: i < products.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{p.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14,
                    color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Jual: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatRupiah(p.price)}</span>
                    {' · '}HPP: {formatRupiah(p.hpp)}
                    {' · '}Margin: <span style={{ color: 'var(--success)' }}>{calcMargin(p.price, p.hpp)}%</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(p)} style={iconBtnStyle('#EFF6FF', '#2563EB')}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(p.id, p.name)} style={iconBtnStyle('var(--danger-bg)', 'var(--danger)')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <>
          <div onClick={closeForm} style={{ position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
          <div className="animate-slide-up" style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
            zIndex: 50, padding: '0 0 32px', maxHeight: '92dvh', overflowY: 'auto',
          }}>
            <div style={{ width: 40, height: 4, background: 'var(--border-strong)',
              borderRadius: 99, margin: '12px auto 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 12px' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editId ? 'Edit Produk' : 'Tambah Produk'}
              </h2>
              <button onClick={closeForm} style={iconBtnStyle('var(--bg-elevated)', 'var(--text-secondary)')}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Emoji picker */}
              <div>
                <label style={labelStyle}>Icon Produk</label>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{
                  fontSize: 36, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '8px 16px', cursor: 'pointer',
                }}>
                  {form.icon}
                </button>
                {showEmojiPicker && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EMOJI_OPTIONS.map((e) => (
                      <button key={e} onClick={() => { setForm((f) => ({...f, icon: e})); setShowEmojiPicker(false) }}
                        style={{ fontSize: 24, background: form.icon === e ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                          border: form.icon === e ? '2px solid var(--accent)' : '2px solid transparent',
                          borderRadius: 10, padding: '6px 8px', cursor: 'pointer' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Nama Produk *</label>
                <input className="input" value={form.name} placeholder="Lele Goreng"
                  onChange={(e) => setForm((f) => ({...f, name: e.target.value}))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Harga Jual (Rp) *</label>
                  <input className="input" type="number" value={form.price || ''}
                    placeholder="25000"
                    onChange={(e) => setForm((f) => ({...f, price: Number(e.target.value)}))} />
                </div>
                <div>
                  <label style={labelStyle}>HPP / Modal (Rp)</label>
                  <input className="input" type="number" value={form.hpp || ''}
                    placeholder="15000"
                    onChange={(e) => setForm((f) => ({...f, hpp: Number(e.target.value)}))} />
                </div>
              </div>

              {/* Margin preview */}
              {form.price > 0 && (
                <div style={{ background: margin >= 30 ? 'var(--success-bg)' : 'var(--warning-bg)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Laba per unit: </span>
                  <strong style={{ color: margin >= 30 ? 'var(--success)' : 'var(--warning)' }}>
                    {formatRupiah(form.price - form.hpp)} ({margin}% margin)
                  </strong>
                </div>
              )}

              <div>
                <label style={labelStyle}>Satuan</label>
                <input className="input" value={form.unit}
                  onChange={(e) => setForm((f) => ({...f, unit: e.target.value}))} placeholder="porsi" />
              </div>

              <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: 'var(--accent)', color: 'white', fontSize: 15, fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {saving ? 'Menyimpan...' : <><Check size={18} /> {editId ? 'Simpan Perubahan' : 'Tambah Produk'}</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6,
}

function iconBtnStyle(bg: string, color: string): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, background: bg, color, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
}
