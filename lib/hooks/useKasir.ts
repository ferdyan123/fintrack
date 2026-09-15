'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { createClient } from '@/lib/supabase/client'
import type { CartItem, Product, Transaction } from '@/types'

function dateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function useKasir() {
  const currentStore = useAppStore((s) => s.currentStore)
  const addPendingSync = useAppStore((s) => s.addPendingSync)
  const syncStatus = useAppStore((s) => s.syncStatus)

  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(dateString())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * product.price }
            : item
        )
      }
      return [...prev, { product, qty: 1, subtotal: product.price }]
    })
  }, [])

  const updateQty = useCallback((productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId
            ? { ...item, qty: newQty, subtotal: newQty * item.product.price }
            : item
        )
      )
    }
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const totalProfit = cart.reduce(
    (sum, item) => sum + (item.product.price - item.product.hpp) * item.qty, 0
  )
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)

  const submitCart = useCallback(async (): Promise<boolean> => {
    if (cart.length === 0 || !currentStore) return false
    setIsSubmitting(true)

    const supabase = createClient()
    const now = new Date().toISOString()

    const records: Omit<Transaction, 'id'>[] = cart.map((item) => ({
      store_id: currentStore.id,
      type: 'income' as const,
      product_id: item.product.id,
      product_name: item.product.name,
      category: 'Penjualan',
      qty: item.qty,
      amount: item.subtotal,
      profit: (item.product.price - item.product.hpp) * item.qty,
      note: undefined,
      date: selectedDate,
      source: 'kasir' as const,
      created_at: now,
    }))

    try {
      if (!navigator.onLine) {
        records.forEach((record) => {
          addPendingSync({ table: 'transactions', action: 'insert', payload: { ...record, id: crypto.randomUUID() } })
        })
      } else {
        const { error } = await supabase.from('transactions').insert(records)
        if (error) throw error
      }
      clearCart()
      setIsSubmitting(false)
      return true
    } catch {
      records.forEach((record) => {
        addPendingSync({ table: 'transactions', action: 'insert', payload: { ...record, id: crypto.randomUUID() } })
      })
      clearCart()
      setIsSubmitting(false)
      return true
    }
  }, [cart, currentStore, selectedDate, addPendingSync, clearCart])

  return {
    cart, selectedDate, setSelectedDate, isSubmitting,
    totalAmount, totalProfit, totalItems,
    addToCart, updateQty, removeFromCart, clearCart, submitCart,
  }
}
