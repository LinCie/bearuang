import { useReducer, useCallback } from 'react'
import type { VariantWithProduct } from 'backend/src/modules/variants/variants.route'

export interface CartItem {
  variant: VariantWithProduct
  quantity: number
}

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: VariantWithProduct }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { variantId: string; quantity: number } }
  | { type: 'CLEAR_CART' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        (i) => i.variant.id === action.payload.id,
      )
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variant.id === action.payload.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        }
      }
      return {
        items: [...state.items, { variant: action.payload, quantity: 1 }],
      }
    }
    case 'REMOVE_ITEM':
      return {
        items: state.items.filter((i) => i.variant.id !== action.payload),
      }
    case 'UPDATE_QTY': {
      if (action.payload.quantity <= 0) {
        return {
          items: state.items.filter(
            (i) => i.variant.id !== action.payload.variantId,
          ),
        }
      }
      return {
        items: state.items.map((i) =>
          i.variant.id === action.payload.variantId
            ? { ...i, quantity: action.payload.quantity }
            : i,
        ),
      }
    }
    case 'CLEAR_CART':
      return { items: [] }
    default:
      return state
  }
}

export function usePosCart() {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })

  const addItem = useCallback((variant: VariantWithProduct) => {
    dispatch({ type: 'ADD_ITEM', payload: variant })
  }, [])

  const removeItem = useCallback((variantId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: variantId })
  }, [])

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QTY', payload: { variantId, quantity } })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' })
  }, [])

  const subtotal = state.items.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0,
  )

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    items: state.items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    itemCount,
  }
}
