import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { motion, AnimatePresence as FMAnimatePresence } from "framer-motion";

/**
 * AnimatePresence wrapper that automatically keys <Step k="..."> children so
 * enter/exit transitions between tool states work without manual keys.
 */
export function AnimatePresence({ children, mode = "wait" }: { children: ReactNode; mode?: "wait" | "sync" | "popLayout" }) {
  const keyed = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const k = (child.props as { k?: string }).k;
      return k && child.key?.toString().startsWith(".") ? cloneElement(child, { key: k }) : child;
    });
  return (
    <FMAnimatePresence mode={mode} initial={false}>
      {keyed}
    </FMAnimatePresence>
  );
}
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "@/lib/router";
import type { ToolDef } from "@/data/tools";

export function ToolLayout({ tool, children, aside }: { tool: ToolDef; children: ReactNode; aside?: ReactNode }) {
  const Icon = tool.icon;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <Link to="/tools" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All tools
      </Link>

      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} text-white shadow-lift`}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">{tool.description}</p>
        </div>
      </motion.header>

      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-4 w-4" /> Processed locally in your browser · files are never uploaded
      </div>

      <div className={aside ? "mt-8 grid gap-6 lg:grid-cols-[1fr_320px]" : "mt-8"}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="min-w-0 space-y-6">
          {children}
        </motion.div>
        {aside && <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">{aside}</aside>}
      </div>
    </div>
  );
}

/** Wrapper that fades/slides tool states in and out. */
export function Step({ children, k }: { children: ReactNode; k: string }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-6">
      {children}
    </motion.div>
  );
}
