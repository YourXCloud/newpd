import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileUp, AlertCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/lib/utils";

export interface DropzoneProps {
  accept: Record<string, string[]>; // mime -> extensions
  multiple?: boolean;
  maxSize?: number; // bytes
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

export function validateFiles(files: File[], accept: Record<string, string[]>, maxSize?: number) {
  const okMimes = Object.keys(accept);
  const okExts = Object.values(accept).flat();
  const valid: File[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    const typeOk = okMimes.includes(f.type) || okExts.includes(ext);
    if (!typeOk) {
      errors.push(`“${f.name}” is not a supported format. Accepted: ${okExts.join(", ")}.`);
      continue;
    }
    if (maxSize && f.size > maxSize) {
      errors.push(`“${f.name}” is ${formatBytes(f.size)}, above the ${formatBytes(maxSize)} limit for smooth in-browser processing.`);
      continue;
    }
    if (f.size === 0) {
      errors.push(`“${f.name}” is empty.`);
      continue;
    }
    valid.push(f);
  }
  return { valid, errors };
}

export function Dropzone({ accept, multiple, maxSize, onFiles, title, hint, compact, className, disabled }: DropzoneProps) {
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const extList = Object.values(accept).flat().map((e) => e.replace(".", "").toUpperCase());
  const uniqueExt = Array.from(new Set(extList));

  const handle = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      let files = Array.from(list);
      if (!multiple) files = files.slice(0, 1);
      const { valid, errors } = validateFiles(files, accept, maxSize);
      setErrors(errors);
      if (valid.length) onFiles(valid);
    },
    [accept, maxSize, multiple, onFiles]
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    handle(e.dataTransfer.files);
  };

  return (
    <div className={className}>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={title ?? "Upload files"}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        animate={drag ? { scale: 1.01 } : { scale: 1 }}
        className={cn(
          "group relative w-full cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-colors duration-300",
          drag
            ? "border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10"
            : "border-slate-300/80 bg-white/60 hover:border-brand-400/70 hover:bg-brand-50/40 dark:border-white/15 dark:bg-white/[0.02] dark:hover:border-brand-400/50 dark:hover:bg-brand-500/5",
          disabled && "cursor-not-allowed opacity-60",
          compact ? "px-5 py-6" : "px-6 py-12 sm:py-16"
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(600px circle at 50% 0%, rgba(99,102,241,0.08), transparent 60%)" }}
        />
        <div className="relative flex flex-col items-center text-center">
          <motion.div
            animate={drag ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
              "mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-lift",
              compact ? "h-11 w-11" : "h-16 w-16"
            )}
          >
            {drag ? <FileUp className={compact ? "h-5 w-5" : "h-7 w-7"} /> : <UploadCloud className={compact ? "h-5 w-5" : "h-7 w-7"} />}
          </motion.div>
          <p className={cn("font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-lg")}>
            {drag ? "Drop to upload" : title ?? (multiple ? "Drag & drop files here" : "Drag & drop your file here")}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            or{" "}
            <span className="font-semibold text-brand-600 underline-offset-2 group-hover:underline dark:text-brand-300">browse files</span>
          </p>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            {hint ?? `${uniqueExt.join(", ")}${maxSize ? ` · up to ${formatBytes(maxSize, 0)}` : ""}${multiple ? " · multiple files" : ""}`}
          </p>
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          accept={[...Object.keys(accept), ...Object.values(accept).flat()].join(",")}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
          tabIndex={-1}
        />
      </motion.div>
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="mt-3 space-y-2 overflow-hidden"
          >
            {errors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
