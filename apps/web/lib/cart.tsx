"use client";

/**
 * The basket.
 *
 * Line pricing mirrors `components/pos/PosApp.tsx` exactly:
 *   unitPrice = basePrice + mealUpcharge + sum(option prices)
 *   lineTotal = unitPrice * quantity
 * If that ever drifts, the receipt the till prints stops matching what the
 * customer was charged, so the arithmetic lives in one place (`unitPrice`) and
 * both the UI and the Convex payload read from it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MEAL_COMBO_LABEL, MEAL_UPCHARGE_PENCE, type MenuItem } from "./menu";

export type CartOption = { name: string; price: number };

export type CartLine = {
  /** Identity of a line: same item + same meal choice + same extras = same line. */
  key: string;
  itemName: string;
  category: string;
  image?: string;
  basePrice: number;
  isMeal: boolean;
  mealUpcharge: number;
  options: CartOption[];
  note: string;
  quantity: number;
};

export function unitPrice(line: CartLine): number {
  return line.basePrice + line.mealUpcharge + line.options.reduce((sum, o) => sum + o.price, 0);
}

export function lineTotal(line: CartLine): number {
  return unitPrice(line) * line.quantity;
}

function makeKey(itemName: string, isMeal: boolean, options: CartOption[], note: string): string {
  const extras = options
    .map((o) => o.name)
    .sort()
    .join(",");
  return [itemName, isMeal ? "meal" : "single", extras, note.trim()].join("|");
}

type State = { lines: CartLine[] };

type Action =
  | { type: "add"; line: Omit<CartLine, "key">; }
  | { type: "setQuantity"; key: string; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "hydrate"; lines: CartLine[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { lines: action.lines };

    case "add": {
      const key = makeKey(action.line.itemName, action.line.isMeal, action.line.options, action.line.note);
      const index = state.lines.findIndex((l) => l.key === key);
      if (index === -1) return { lines: [...state.lines, { ...action.line, key }] };
      const lines = [...state.lines];
      lines[index] = { ...lines[index], quantity: lines[index].quantity + action.line.quantity };
      return { lines };
    }

    case "setQuantity": {
      if (action.quantity <= 0) return { lines: state.lines.filter((l) => l.key !== action.key) };
      return {
        lines: state.lines.map((l) =>
          l.key === action.key ? { ...l, quantity: Math.min(action.quantity, 99) } : l,
        ),
      };
    }

    case "remove":
      return { lines: state.lines.filter((l) => l.key !== action.key) };

    case "clear":
      return { lines: [] };
  }
}

const STORAGE_KEY = "tryo.cart.v1";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (input: {
    item: MenuItem;
    category: string;
    isMeal?: boolean;
    options?: CartOption[];
    note?: string;
    quantity?: number;
  }) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Increments whenever something is added, so the header badge can animate. */
  bumpToken: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [] });
  // A ref, not state: this only gates the persist effect below and nothing
  // renders from it, so flipping it must not cause a re-render.
  const hydrated = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [bumpToken, setBumpToken] = useState(0);

  // Restore on mount only. Reading during render would break hydration.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) dispatch({ type: "hydrate", lines: parsed as CartLine[] });
      }
    } catch {
      // A corrupt or unavailable store just means an empty basket.
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    // Skip the first pass, which runs before the stored basket is read; writing
    // then would clobber it with an empty array.
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines));
    } catch {
      // Private mode / quota — the basket still works for this session.
    }
  }, [state.lines]);

  // The drawer is a modal on every breakpoint; freeze the page behind it.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const addItem = useCallback<CartContextValue["addItem"]>(
    ({ item, category, isMeal = false, options = [], note = "", quantity = 1 }) => {
      dispatch({
        type: "add",
        line: {
          itemName: item.name,
          category,
          image: item.image,
          basePrice: item.basePrice,
          isMeal,
          mealUpcharge: isMeal ? MEAL_UPCHARGE_PENCE : 0,
          options,
          note,
          quantity,
        },
      });
      setBumpToken((n) => n + 1);
    },
    [],
  );

  const value = useMemo<CartContextValue>(() => {
    const count = state.lines.reduce((sum, l) => sum + l.quantity, 0);
    const subtotal = state.lines.reduce((sum, l) => sum + lineTotal(l), 0);
    return {
      lines: state.lines,
      count,
      subtotal,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      setQuantity: (key, quantity) => dispatch({ type: "setQuantity", key, quantity }),
      remove: (key) => dispatch({ type: "remove", key }),
      clear: () => dispatch({ type: "clear" }),
      bumpToken,
    };
  }, [state.lines, isOpen, addItem, bumpToken]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/** Human-readable modifier summary for a line, e.g. "Fries + Drink · Cheese". */
export function describeLine(line: CartLine): string {
  const parts: string[] = [];
  if (line.isMeal) parts.push(MEAL_COMBO_LABEL);
  for (const o of line.options) parts.push(o.name);
  if (line.note) parts.push(`“${line.note}”`);
  return parts.join(" · ");
}
