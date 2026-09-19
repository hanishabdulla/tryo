"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { NumberPad, applyNumberKey, type NumberPadKey } from "./NumberPad";
import { TextKeyboard } from "./TextKeyboard";

export type TouchKeyboardLayout = "text" | "decimal" | "integer";

type FieldConfig = {
  layout: TouchKeyboardLayout;
  label: string;
  value: string;
  maxLength?: number;
  onValueChange: (next: string) => void;
  onDone?: () => void;
};

type TouchKeyboardContextValue = {
  /**
   * True when this machine has no physical keyboard, so the app must supply
   * one. The Windows touch keyboard is suppressed in this mode because it
   * floats over the dialog the cashier is trying to fill in.
   */
  touchMode: boolean;
  activeId: string | null;
  open: (id: string, config: FieldConfig) => void;
  sync: (id: string, config: FieldConfig) => void;
  close: (id?: string) => void;
};

const TouchKeyboardContext = createContext<TouchKeyboardContextValue | null>(null);

export function useTouchKeyboard(): TouchKeyboardContextValue {
  const context = useContext(TouchKeyboardContext);
  if (!context) {
    throw new Error("useTouchKeyboard must be used inside <TouchKeyboardProvider>");
  }
  return context;
}

/** No physical keyboard: the packaged till, or any coarse-pointer panel. */
function detectTouchMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.tryoElectron) return true;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

function subscribeToPointerType(onChange: () => void): () => void {
  const query = window.matchMedia?.("(pointer: coarse)");
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/**
 * Resolved on the client only: the server has no idea what kind of pointer the
 * machine has, and rendering the two differently would break hydration.
 */
function useTouchMode(): boolean {
  return useSyncExternalStore(
    subscribeToPointerType,
    detectTouchMode,
    () => false,
  );
}

export function TouchKeyboardProvider({ children }: { children: React.ReactNode }) {
  const touchMode = useTouchMode();
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [activeLabel, setActiveLabel] = useState("");
  const [activeLayout, setActiveLayout] = useState<TouchKeyboardLayout>("text");
  const configRef = useRef<FieldConfig | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = useCallback((id: string, config: FieldConfig) => {
    configRef.current = config;
    activeIdRef.current = id;
    setActiveLabel(config.label);
    setActiveLayout(config.layout);
    setActiveId(id);
  }, []);

  // Fields re-register on every render so the pad always edits the current
  // value rather than the one captured when the field was first tapped. This
  // only touches refs, so re-registering never costs a render.
  const sync = useCallback((id: string, config: FieldConfig) => {
    if (activeIdRef.current === id) configRef.current = config;
  }, []);

  const close = useCallback((id?: string) => {
    if (id !== undefined && activeIdRef.current !== id) return;
    activeIdRef.current = null;
    configRef.current = null;
    setActiveId(null);
  }, []);

  // Publish the keyboard's height so dialogs can reserve room for it and keep
  // the field being typed into on screen.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const panel = panelRef.current;
    if (!activeId || !panel) {
      root.style.setProperty("--osk-inset", "0px");
      return;
    }
    const apply = () =>
      root.style.setProperty("--osk-inset", `${panel.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      root.style.setProperty("--osk-inset", "0px");
    };
  }, [activeId, activeLayout]);

  const handleNumberKey = useCallback((key: NumberPadKey) => {
    const config = configRef.current;
    if (!config) return;
    config.onValueChange(
      applyNumberKey(config.value, key, {
        decimal: config.layout === "decimal",
      }),
    );
  }, []);

  const handleCharacter = useCallback((character: string) => {
    const config = configRef.current;
    if (!config) return;
    const next = `${config.value}${character}`;
    config.onValueChange(
      config.maxLength ? next.slice(0, config.maxLength) : next,
    );
  }, []);

  const handleBackspace = useCallback(() => {
    const config = configRef.current;
    if (!config) return;
    config.onValueChange(config.value.slice(0, -1));
  }, []);

  const handleDone = useCallback(() => {
    const config = configRef.current;
    config?.onDone?.();
    close();
  }, [close]);

  const value = useMemo(
    () => ({ touchMode, activeId, open, sync, close }),
    [touchMode, activeId, open, sync, close],
  );

  return (
    <TouchKeyboardContext.Provider value={value}>
      {children}
      {activeId ? (
        <div
          ref={panelRef}
          role="group"
          aria-label="On-screen keyboard"
          className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#161619]/98 px-3 pb-3 pt-2 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur"
        >
          <div className="mx-auto mb-2 flex max-w-4xl items-center justify-between gap-3">
            <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {activeLabel}
            </span>
            <button
              type="button"
              onClick={handleDone}
              className="rounded-lg px-3 py-1 text-xs font-bold text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            >
              Hide keyboard
            </button>
          </div>
          {activeLayout === "text" ? (
            <TextKeyboard
              onKey={handleCharacter}
              onBackspace={handleBackspace}
              onDone={handleDone}
            />
          ) : (
            <div className="mx-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_minmax(0,9rem)] items-end gap-3">
              <NumberPad
                onKey={handleNumberKey}
                decimal={activeLayout === "decimal"}
                size="compact"
              />
              <button
                type="button"
                onClick={handleDone}
                className="h-12 rounded-2xl bg-[#00955e] text-sm font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c]"
              >
                Done
              </button>
            </div>
          )}
        </div>
      ) : null}
    </TouchKeyboardContext.Provider>
  );
}

type TouchInputProps = {
  value: string;
  onValueChange: (next: string) => void;
  /** Which keyboard to raise. `text` is QWERTY, the others are the money pad. */
  keyboard: TouchKeyboardLayout;
  /** Shown above the on-screen keyboard so the cashier knows what they're filling in. */
  label: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  autoComplete?: string;
  "aria-label"?: string;
};

/**
 * Text or money field that raises the in-app keyboard on a touch till and
 * behaves like a plain input everywhere else.
 */
export function TouchInput({
  value,
  onValueChange,
  keyboard,
  label,
  multiline = false,
  rows = 2,
  maxLength,
  placeholder,
  className = "",
  autoFocus,
  disabled,
  id,
  ...rest
}: TouchInputProps) {
  const { touchMode, activeId, open, sync, close } = useTouchKeyboard();
  const fieldId = useId();
  const active = activeId === fieldId;
  const elementRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const config: FieldConfig = {
    layout: keyboard,
    label,
    value,
    maxLength,
    onValueChange,
  };

  useEffect(() => {
    if (active) sync(fieldId, config);
  });

  // Leaving the dialog open with a keyboard for a field that no longer exists
  // would strand the panel on screen.
  useEffect(() => () => close(fieldId), [close, fieldId]);

  const raise = () => {
    if (!touchMode || disabled) return;
    open(fieldId, config);
    // The dialog reserves room for the keyboard, so the field only needs to be
    // nudged into that remaining space.
    window.setTimeout(
      () => elementRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }),
      60,
    );
  };

  const shared = {
    ref: elementRef as never,
    id,
    value,
    placeholder,
    maxLength,
    disabled,
    autoFocus,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onValueChange(event.target.value),
    onFocus: raise,
    onPointerDown: raise,
    // `readOnly` is what actually keeps the Windows touch keyboard from
    // appearing over the dialog; the in-app pad supplies the characters.
    readOnly: touchMode,
    inputMode: (touchMode
      ? "none"
      : keyboard === "text"
        ? "text"
        : "decimal") as "none" | "text" | "decimal",
    className: [
      className,
      active ? "border-[#00955e] ring-2 ring-[#00955e]/30" : "",
      touchMode ? "cursor-pointer caret-transparent" : "",
    ]
      .filter(Boolean)
      .join(" "),
    ...rest,
  };

  return multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />;
}
