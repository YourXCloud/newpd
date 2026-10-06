import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { FileText, X, AlertCircle, RotateCcw, Download, CheckCircle2, ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/lib/utils";
import { Button } from "./Button";

/* ---------- File card ---------- */
export function FileCard({
  name,
  size,
  meta,
  onRemove,
  thumbnail,
  kind = "pdf",
  className,
  children,
}: {
  name: string;
  size: number;
  meta?: ReactNode;
  onRemove?: () => void;
  thumbnail?: string | null;
  kind?: "pdf" | "image";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn("card flex items-center gap-4 p-3.5", className)}
    >
      <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        ) : kind === "pdf" ? (
          <FileText className="h-6 w-6 text-rose-500" />
        ) : (
          <ImageIcon className="h-6 w-6 text-sky-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={name}>
          {name}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {formatBytes(size)}
          {meta && <span> · {meta}</span>}
        </p>
        {children}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

/* ---------- Processing ---------- */
export interface Progress {
  percent: number; // 0-100, -1 for indeterminate
  stage: string;
  detail?: string;
}

export function ProcessingPanel({ progress, title = "Processing" }: { progress: Progress; title?: string }) {
  const indeterminate = progress.percent < 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      role="status"
      aria-live="polite"
      className="card relative overflow-hidden p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(700px circle at 0% 0%, rgba(99,102,241,0.08), transparent 55%)" }}
      />
      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-5 h-20 w-20">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-white/10" />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={cn("stroke-brand-500", indeterminate && "animate-spin-slow origin-center")}
              strokeDasharray={2 * Math.PI * 34}
              animate={{ strokeDashoffset: indeterminate ? 2 * Math.PI * 34 * 0.72 : 2 * Math.PI * 34 * (1 - progress.percent / 100) }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {indeterminate ? (
              <Sparkles className="h-6 w-6 animate-pulse text-brand-500" />
            ) : (
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{Math.round(progress.percent)}%</span>
            )}
          </div>
        </div>
        <h3 className="text-lg font-semibold">{title}…</h3>
        <motion.p key={progress.stage} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {progress.stage}
        </motion.p>
        {progress.detail && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{progress.detail}</p>}
        <div className="mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          {indeterminate ? (
            <div className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-brand-400 via-violet-500 to-brand-400 bg-[length:200%_100%]" />
          ) : (
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" animate={{ width: `${progress.percent}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Error ---------- */
export function ErrorPanel({ title = "Something went wrong", message, onRetry, onReset, retryLabel = "Try again" }: { title?: string; message: string; onRetry?: () => void; onReset?: () => void; retryLabel?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-500/20 dark:bg-rose-500/10"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-rose-900 dark:text-rose-200">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-rose-800/90 dark:text-rose-300/90">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {onReset && (
              <Button size="sm" variant="ghost" onClick={onReset}>
                Start over
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Success / Result ---------- */
export function SuccessBadge() {
  return (
    <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-emerald-400/30"
        initial={{ scale: 0.6, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      <div className="animate-pop flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lift">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 13l4 4L19 7" strokeDasharray="60" className="animate-draw" />
        </svg>
      </div>
    </div>
  );
}

export function ResultPanel({
  title = "Your file is ready!",
  subtitle,
  stats,
  onDownload,
  downloadLabel = "Download",
  onReset,
  children,
  extraActions,
}: {
  title?: string;
  subtitle?: ReactNode;
  stats?: { label: string; value: ReactNode; highlight?: boolean }[];
  onDownload?: () => void;
  downloadLabel?: string;
  onReset?: () => void;
  children?: ReactNode;
  extraActions?: ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card relative overflow-hidden p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(600px circle at 50% -20%, rgba(16,185,129,0.12), transparent 60%)" }}
      />
      <div className="relative text-center">
        <SuccessBadge />
        <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
        {subtitle && <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{subtitle}</div>}
        {stats && (
          <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className={cn(
                  "rounded-xl border px-2 py-3 sm:px-3",
                  s.highlight
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                    : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]"
                )}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</p>
                <p className={cn("mt-1 truncate text-sm font-bold tabular-nums sm:text-base", s.highlight ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white")}>{s.value}</p>
              </div>
            ))}
          </div>
        )}
        {children && <div className="mt-6 text-left">{children}</div>}
        <div className="mt-7 flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {onReset && (
            <Button variant="outline" onClick={onReset} icon={<RotateCcw className="h-4 w-4" />}>
              Process another
            </Button>
          )}
          {extraActions}
          {onDownload && (
            <Button size="lg" onClick={onDownload} icon={<Download className="h-5 w-5" />}>
              {downloadLabel}
            </Button>
          )}
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5" /> Processed locally — nothing was uploaded.
        </p>
      </div>
    </motion.div>
  );
}

/* ---------- Skeleton ---------- */
export function PageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton aspect-[3/4]" />
      ))}
    </div>
  );
}

/* ---------- Section card for controls ---------- */
export function Panel({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card p-5 sm:p-6", className)}>
      {(title || description) && (
        <header className="mb-4">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function InfoNote({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "info"
          ? "border-brand-200/70 bg-brand-50/70 text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-100"
          : "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
      )}
    >
      {children}
    </div>
  );
}
