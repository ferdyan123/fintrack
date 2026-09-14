import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store, SyncStatus, PendingSync, Product, ExpenseCategory } from '@/types'

interface AppState {
  // Store info
  currentStore: Store | null
  setCurrentStore: (store: Store | null) => void

  // Products cache (offline)
  products: Product[]
  setProducts: (products: Product[]) => void

  // Expense categories cache
  expenseCategories: ExpenseCategory[]
  setExpenseCategories: (cats: ExpenseCategory[]) => void

  // Sync status
  syncStatus: SyncStatus
  setSyncStatus: (status: SyncStatus) => void
  pendingSync: PendingSync[]
  addPendingSync: (item: Omit<PendingSync, 'id' | 'created_at'>) => void
  clearPendingSync: () => void

  // Theme
  theme: 'merah' | 'drako'
  setTheme: (theme: 'merah' | 'drako') => void

  // Onboarding
  onboardingDone: boolean
  setOnboardingDone: (done: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentStore: null,
      setCurrentStore: (store) => set({ currentStore: store }),

      products: [],
      setProducts: (products) => set({ products }),

      expenseCategories: [],
      setExpenseCategories: (cats) => set({ expenseCategories: cats }),

      syncStatus: 'offline',
      setSyncStatus: (status) => set({ syncStatus: status }),
      pendingSync: [],
      addPendingSync: (item) =>
        set((state) => ({
          pendingSync: [
            ...state.pendingSync,
            {
              ...item,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
            },
          ],
        })),
      clearPendingSync: () => set({ pendingSync: [] }),

      theme: 'merah',
      setTheme: (theme) => set({ theme }),

      onboardingDone: false,
      setOnboardingDone: (done) => set({ onboardingDone: done }),
    }),
    {
      name: 'fintrack-app-store',
      // Hanya persist data yang perlu offline
      partialize: (state) => ({
        currentStore: state.currentStore,
        products: state.products,
        expenseCategories: state.expenseCategories,
        pendingSync: state.pendingSync,
        theme: state.theme,
        onboardingDone: state.onboardingDone,
      }),
    }
  )
)
