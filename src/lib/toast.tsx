import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { uid } from "./utils";

type Kind = "success" | "error" | "info" | "warning";
interface Toast {
  id: string;
  kind: Kind;
  title: string;
  description?: string;
}
interface ToastApi {
  toast: (t: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const Ctx = createContext<ToastApi>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
});

const styles: Record<Kind, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: "border-emerald-200/70 dark:border-emerald-500/20", iconColor: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: AlertCircle, ring: "border-rose-200/70 dark:border-rose-500/20", iconColor: "text-rose-600 dark:text-rose-400" },
  warning: { icon: AlertTriangle, ring: "border-amber-200/70 dark:border-amber-500/20", iconColor: "text-amber-600 dark:text-amber-400" },
  info: { icon: Info, ring: "border-brand-200/70 dark:border-brand-500/20", iconColor: "text-brand-600 dark:text-brand-300" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid();
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => remove(id), t.kind === "error" ? 6500 : 4000);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ kind: "success", title, description }),
      error: (title, description) => toast({ kind: "error", title, description }),
      info: (title, description) => toast({ kind: "info", title, description }),
      warning: (title, description) => toast({ kind: "warning", title, description }),
    }),
    [toast]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:px-6 sm:pb-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const s = styles[t.kind];
            const Icon = s.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                role="status"
                className={`glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-lift ${s.ring}`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.iconColor}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t.description}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 rounded-lg p-1 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
