'use client'

import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, ImagePlus } from 'lucide-react'
import { useAppStore } from '@/lib/store/appStore'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, calcMargin } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import type { Product } from '@/types'

const EMOJI_OPTIONS = ['🍽️','🍜','🍚','🍗','🐟','🥚','🥩','🍢','🥘','🍖',
  '🧆','🥙','🌮','🥗','🍱','☕','🧋','🥤','🍵','🧃','🫙','🍰','🧁','🍩','🎂']

const SATUAN_OPTIONS = ['porsi', 'kg', 'ekor', 'pcs', 'pack', 'gelas', 'liter']

type FormData = Omit<Product, 'id'|'store_id'|'created_at'>

const EMPTY_FORM: FormData = {
  name: '', icon: '🍽️', price: 0, hpp: 0, unit: 'porsi',
  is_active: true, stock_qty: undefined, photo_url: undefined,
}

function formatNumber(val: number) { return val > 0 ? val.toLocaleString('id-ID') : '' }
function parseNumber(val: string) { return Number(val.replace(/\./g, '').replace(/,/g, '')) || 0 }

// Compress gambar ke max 300x300 JPEG 70%
function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 300
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
  })
}

export default function PengaturanPage() {
  const products = useAppStore((s) => s.products)
  const setProducts = useAppStore((s) => s.setProducts)
  const currentStore = useAppStore((s) => s.currentStore)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const { toast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [priceDisplay, setPriceDisplay] = useState('')
  const [hppDisplay, setHppDisplay] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [photoMode, setPhotoMode] = useState<'emoji'|'photo'>('emoji')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const margin = form.price > 0 ? calcMargin(form.price, form.hpp) : 0
  const profit = form.price - form.hpp
  const canSave = form.name.trim().length > 0

  function openAdd() {
    setForm(EMPTY_FORM); setPriceDisplay(''); setHppDisplay('')
    setPhotoPreview(null); setPhotoMode('emoji'); setEditId(null); setShowForm(true)
  }

  function openEdit(p: Product) {
    setForm({ name: p.name, icon: p.icon, price: p.price, hpp: p.hpp,
      unit: p.unit, is_active: p.is_active, stock_qty: p.stock_qty, photo_url: p.photo_url })
    setPriceDisplay(formatNumber(p.price)); setHppDisplay(formatNumber(p.hpp))
    setPhotoPreview(p.photo_url ?? null)
    setPhotoMode(p.photo_url ? 'photo' : 'emoji')
    setEditId(p.id); setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_FORM)
    setPriceDisplay(''); setHppDisplay(''); setPhotoPreview(null); setPhotoMode('emoji')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhotoPreview(compressed)
    setForm((f) => ({ ...f, photo_url: compressed }))
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)

    const isDummy = !currentStore ||
      currentStore.id === 'dummy-store-001' ||
      !navigator.onLine

    const newId = crypto.randomUUID()

    if (isDummy) {
      if (editId) {
        setProducts(products.map((p) => p.id === editId ? { ...p, ...form } : p))
      } else {
        const newProduct: Product = {
          ...form,
          id: newId,
          store_id: currentStore?.id ?? 'dummy-store-001',
          created_at: new Date().toISOString(),
        }
        setProducts([...products, newProduct])
      }
      toast(editId ? 'Produk berhasil diupdate' : 'Produk berhasil ditambah', 'success')
      setSaving(false)
      closeForm()
      return
    }

    // Mode online Supabase
    const supabase = createClient()
    // Jangan kirim photo_url base64 ke Supabase (terlalu besar), simpan lokal saja
    const { photo_url, ...supabasePayload } = form
    const payload = { ...supabasePayload, store_id: currentStore.id }

    if (editId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editId)
      if (!error) {
        setProducts(products.map((p) => p.id === editId ? { ...p, ...form } : p))
        toast('Produk berhasil diupdate', 'success')
      } else toast('Gagal: ' + error.message, 'error')
    } else {
      const { data, error } = await supabase.from('products')
        .insert(payload).select().single()
      if (!error && data) {
        // Merge photo_url lokal ke data Supabase
        setProducts([...products, { ...(data as Product), photo_url }])
        toast('Produk berhasil ditambah', 'success')
      } else toast('Gagal: ' + (error?.message ?? ''), 'error')
    }
    setSaving(false)
    closeForm()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm('Hapus produk "' + name + '"?')) return
    const isDummy = !currentStore || currentStore.id === 'dummy-store-001' || !navigator.onLine
    if (isDummy) {
      setProducts(products.filter((p) => p.id !== id))
      toast('Produk dihapus', 'info')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) {
      setProducts(products.filter((p) => p.id !== id))
      toast('Produk dihapus', 'info')
    } else toast('Gagal hapus: ' + error.message, 'error')
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
                borderRadius: 6, fontFamily: 'DM Mono, monospace',
                color: 'var(--accent)', fontWeight: 600 }}>{currentStore.store_code}</code>
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
          <div style={{ ...S.card, maxHeight: 448, overflowY: 'auto' }}>
            {products.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < products.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} style={{
                    width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0,
                  }} />
                ) : (
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{p.icon}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14,
                    color: 'var(--text-primary)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
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

      {/* MODAL FORM */}
      {showForm && (
        <>
          <div onClick={closeForm} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)', zIndex: 40,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-surface)', borderRadius: 20, zIndex: 50,
            width: '92%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto',
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px 16px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--bg-surface)',
              borderRadius: '20px 20px 0 0', zIndex: 1,
            }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {editId ? '✏️ Edit Produk' : '➕ Tambah Produk'}
              </span>
              <button onClick={closeForm} style={iconBtnStyle('var(--bg-elevated)', 'var(--text-secondary)')}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Nama */}
              <div>
                <label style={labelStyle}>Nama Produk *</label>
                <input style={inputStyle} value={form.name}
                  placeholder="cth: Lele Goreng 1 Porsi"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Toggle emoji vs foto */}
              <div>
                <label style={labelStyle}>Tampilan di Kasir</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['emoji', 'photo'] as const).map((mode) => (
                    <button key={mode} onClick={() => setPhotoMode(mode)} style={{
                      flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      border: photoMode === mode ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                      background: photoMode === mode ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                      color: photoMode === mode ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>
                      {mode === 'emoji' ? '😊 Pakai Emoji' : '📷 Pakai Foto'}
                    </button>
                  ))}
                </div>

                {photoMode === 'emoji' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {EMOJI_OPTIONS.map((e) => (
                      <button key={e} onClick={() => setForm((f) => ({ ...f, icon: e, photo_url: undefined }))} style={{
                        width: 40, height: 40, borderRadius: 10, fontSize: 20,
                        border: form.icon === e && !form.photo_url
                          ? '2px solid var(--accent)' : '2px solid var(--border)',
                        background: form.icon === e && !form.photo_url
                          ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{e}</button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*"
                      onChange={handleFileChange} style={{ display: 'none' }} />
                    <div onClick={() => fileInputRef.current?.click()} style={{
                      width: '100%', aspectRatio: '2',
                      border: '2px dashed var(--border)', borderRadius: 14,
                      cursor: 'pointer', background: 'var(--bg-elevated)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', position: 'relative',
                    }}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="preview" style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                        }} />
                      ) : (
                        <>
                          <ImagePlus size={28} color="var(--text-muted)" />
                          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                            Tap untuk upload foto
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                            Otomatis dikompres ke 300×300px
                          </p>
                        </>
                      )}
                    </div>
                    {photoPreview && (
                      <button onClick={() => {
                        setPhotoPreview(null)
                        setForm((f) => ({ ...f, photo_url: undefined }))
                      }} style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)',
                        background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        × Hapus foto
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Harga & HPP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Harga Jual (Rp)', val: priceDisplay, set: (v: string) => {
                    const n = parseNumber(v); setForm((f) => ({ ...f, price: n }))
                    setPriceDisplay(n > 0 ? formatNumber(n) : '')
                  }},
                  { label: 'HPP / Modal (Rp)', val: hppDisplay, set: (v: string) => {
                    const n = parseNumber(v); setForm((f) => ({ ...f, hpp: n }))
                    setHppDisplay(n > 0 ? formatNumber(n) : '')
                  }},
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={labelStyle}>{label}</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)',
                        fontWeight: 600, pointerEvents: 'none' }}>Rp</span>
                      <input style={{ ...inputStyle, paddingLeft: 34 }}
                        inputMode="numeric" value={val}
                        placeholder="0"
                        onChange={(e) => set(e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Margin preview */}
              <div style={{
                background: form.price > 0
                  ? margin >= 30 ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)'
                  : 'var(--bg-elevated)',
                border: `1px solid ${form.price > 0
                  ? margin >= 30 ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.35)'
                  : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)',
              }}>
                {form.price > 0
                  ? <>Keuntungan/porsi: <strong style={{ color: margin >= 30 ? 'var(--success)' : '#f59e0b' }}>
                      {formatRupiah(profit)} · {margin}% margin
                    </strong></>
                  : 'Keuntungan/porsi: —'
                }
              </div>

              {/* Satuan */}
              <div>
                <label style={labelStyle}>Satuan</label>
                <select value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  style={{ ...inputStyle, appearance: 'auto' }}>
                  {SATUAN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Tombol */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={closeForm} style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>Batal</button>
                <button onClick={handleSave} disabled={saving || !canSave} style={{
                  flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                  background: !canSave ? 'var(--border)' : 'var(--accent)',
                  color: 'white', fontSize: 14, fontWeight: 700,
                  cursor: saving ? 'wait' : !canSave ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: !canSave ? 0.5 : 1,
                  boxShadow: canSave ? '0 4px 16px rgba(217,43,43,0.3)' : 'none',
                }}>
                  {saving ? 'Menyimpan...' : <><Check size={16} /> {editId ? 'Simpan' : 'Tambah Produk'}</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}
function iconBtnStyle(bg: string, color: string): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, background: bg, color, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
}