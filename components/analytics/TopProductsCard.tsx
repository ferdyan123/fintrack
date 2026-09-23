'use client'

import type { TopProduct } from '@/hooks/useAnalytics'
import { formatRupiah } from '@/lib/utils'
import { SparklineChart } from './SparklineChart'

interface Props {
  products: TopProduct[]
  loading: boolean
  compact?: boolean // mode ringkas untuk CompareView
}

const RANK_COLORS = ['#D92B2B', '#F87171', '#FBBF24', '#A3A3A3', '#BFDBFE']

function SkeletonRow({ compact }: { compact?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: compact ? 8 : 12,
      padding: compact ? '10px 12px' : '14px 16px',
      borderBottom: '1px solid var(--border)',
    }}
      className="animate-pulse">
      <div style={{ width: 20, height: 16, borderRadius: 4, background: 'var(--border)', flexShrink: 0 }} />
      <div style={{ width: compact ? 28 : 40, height: compact ? 28 : 40, borderRadius: compact ? 8 : 10, background: 'var(--border)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ width: '55%', height: 12, borderRadius: 4, background: 'var(--border)' }} />
        <div style={{ width: '40%', height: 10, borderRadius: 4, background: 'var(--border)' }} />
      </div>
      {!compact && <div style={{ width: 100, height: 36, borderRadius: 6, background: 'var(--border)', flexShrink: 0 }} />}
    </div>
  )
}

export function TopProductsCard({ products, loading, compact = false }: Props) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: compact ? '12px 14px 10px' : '16px 20px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          🏅 Top 5 Produk {compact ? '' : 'Bulan Ini'}
        </div>
        {!compact && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Berdasarkan total omzet di periode terpilih
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <>
          <SkeletonRow compact={compact} />
          <SkeletonRow compact={compact} />
          <SkeletonRow compact={compact} />
        </>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && (
        <div style={{ padding: compact ? '24px 16px' : '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: compact ? 28 : 40, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Belum cukup data.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Catat transaksi di Kasir untuk melihat produk terlaris.
          </div>
        </div>
      )}

      {/* Product rows */}
      {!loading && products.map((p, i) => (
        <div
          key={p.product_name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 8 : 12,
            padding: compact ? '10px 12px' : '14px 16px',
            borderBottom: i < products.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          {/* Rank */}
          <div style={{
            width: compact ? 18 : 24,
            fontSize: compact ? 11 : 13,
            fontWeight: 700,
            color: RANK_COLORS[i] ?? 'var(--text-muted)',
            flexShrink: 0,
            textAlign: 'center',
          }}>
            #{p.rank}
          </div>

          {/* Thumbnail */}
          <div style={{
            width: compact ? 28 : 40,
            height: compact ? 28 : 40,
            borderRadius: compact ? 8 : 10,
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: p.photo_url ? undefined : compact ? 14 : 20,
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {p.photo_url ? (
              <img
                src={p.photo_url}
                alt={p.product_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              p.icon ?? '🍽️'
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: compact ? 12 : 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 2,
            }}>
              {p.product_name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {p.total_qty} terjual
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {formatRupiah(p.total_omzet, true)}
              </span>
              {!compact && (
                <>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: p.margin_pct >= 30 ? '#16A34A' : p.margin_pct >= 15 ? '#D97706' : '#DC2626',
                  }}>
                    Margin {p.margin_pct.toFixed(1)}%
                  </span>
                </>
              )}
            </div>

            {/* Badges */}
            {p.badges.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                {p.badges.map((badge) => (
                  <span
                    key={badge}
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '2px 6px', borderRadius: 5,
                      background: badge === '🔥 Hot'
                        ? '#FEF3C7' : badge === '📉 Turun'
                        ? '#FEE2E2' : '#DCFCE7',
                      color: badge === '🔥 Hot'
                        ? '#92400E' : badge === '📉 Turun'
                        ? '#7F1D1D' : '#14532D',
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sparkline — hanya di mode normal */}
          {!compact && <SparklineChart data={p.sparkline} />}
        </div>
      ))}
    </div>
  )
}