import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SaleChannel, SaleUnit } from "../domain/types";

export interface CartLine {
  productId: string;
  saleUnit: SaleUnit;
  qty: number;
}

interface CartState {
  channel: SaleChannel;
  customerId?: string;
  lines: CartLine[];
  discountCents: number;
}

interface CartContextValue extends CartState {
  setChannel: (channel: SaleChannel) => void;
  setCustomerId: (customerId: string | undefined) => void;
  addLine: (productId: string, saleUnit: SaleUnit) => void;
  updateQty: (productId: string, saleUnit: SaleUnit, qty: number) => void;
  removeLine: (productId: string, saleUnit: SaleUnit) => void;
  setDiscountCents: (discountCents: number) => void;
  clear: () => void;
}

const STORAGE_KEY = "stirps.posBasketDraft";
const CartContext = createContext<CartContextValue | null>(null);

function readDraft(): CartState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { discountCents: 0, ...(JSON.parse(raw) as Partial<CartState>) } as CartState;
  } catch {
    // ignore
  }
  return { channel: "retail", lines: [], discountCents: 0 };
}

export function PosCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(() => readDraft());

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore - draft convenience only
    }
  }, [state]);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      setChannel: (channel) => setState((s) => ({ ...s, channel, customerId: channel === "retail" ? undefined : s.customerId })),
      setCustomerId: (customerId) => setState((s) => ({ ...s, customerId })),
      addLine: (productId, saleUnit) =>
        setState((s) => {
          const existing = s.lines.find((l) => l.productId === productId && l.saleUnit === saleUnit);
          if (existing) {
            return { ...s, lines: s.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) };
          }
          return { ...s, lines: [...s.lines, { productId, saleUnit, qty: 1 }] };
        }),
      updateQty: (productId, saleUnit, qty) =>
        setState((s) => ({
          ...s,
          lines: qty <= 0 ? s.lines.filter((l) => !(l.productId === productId && l.saleUnit === saleUnit)) : s.lines.map((l) => (l.productId === productId && l.saleUnit === saleUnit ? { ...l, qty } : l)),
        })),
      removeLine: (productId, saleUnit) => setState((s) => ({ ...s, lines: s.lines.filter((l) => !(l.productId === productId && l.saleUnit === saleUnit)) })),
      setDiscountCents: (discountCents) => setState((s) => ({ ...s, discountCents: Math.max(0, discountCents) })),
      clear: () => setState({ channel: "retail", lines: [], discountCents: 0 }),
    }),
    [state],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function usePosCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("usePosCart must be used within PosCartProvider");
  return ctx;
}
