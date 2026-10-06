import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Images, LayoutGrid, Lock, Cpu, Trash2, ShieldCheck } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { CATEGORIES, searchTools, type ToolCategory } from "@/data/tools";
import { Segmented } from "@/components/ui/Field";
import { Link } from "@/lib/router";

export function ToolsPage({ category }: { category?: ToolCategory }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | ToolCategory>(category ?? "all");
  const results = searchTools(q).filter((t) => cat === "all" || t.category === cat);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {cat === "all" ? "All tools" : CATEGORIES.find((c) => c.id === cat)?.label}
        </h1>
        <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-400">
          {cat === "all" ? "Everything you need to work with PDFs and images — private, fast, and free." : CATEGORIES.find((c) => c.id === cat)?.blurb}
        </p>
      </motion.div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tools…"
            aria-label="Search tools"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-soft outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/[0.04]"
          />
        </div>
        <Segmented
          className="sm:w-80"
          value={cat}
          onChange={setCat}
          options={[
            { value: "all", label: "All", icon: <LayoutGrid className="h-4 w-4" /> },
            { value: "pdf", label: "PDF", icon: <FileText className="h-4 w-4" /> },
            { value: "image", label: "Image", icon: <Images className="h-4 w-4" /> },
          ]}
        />
      </div>

      <motion.div layout className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {results.map((t, i) => (
            <motion.div key={t.slug} layout exit={{ opacity: 0, scale: 0.95 }}>
              <ToolCard tool={t} index={i} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {results.length === 0 && (
        <div className="card mt-8 p-10 text-center">
          <p className="font-semibold">No tools match “{q}”.</p>
          <p className="mt-1 text-sm text-slate-500">Try “compress”, “merge”, “password” or “resize”.</p>
        </div>
      )}
    </div>
  );
}

export function AboutPage() {
  const points = [
    { icon: Cpu, title: "Local processing", text: "PDF parsing, rendering, image encoding and encryption all run in your browser using WebAssembly and Canvas APIs. There is no upload step." },
    { icon: Lock, title: "Passwords stay on your device", text: "Encryption and decryption happen in memory. Passwords are never logged, stored, or transmitted." },
    { icon: Trash2, title: "Nothing is kept", text: "Processed files live only in memory and temporary object URLs, which are released when you leave a tool or start over." },
    { icon: ShieldCheck, title: "Honest limitations", text: "If something can't be done reliably in a browser, we tell you — we don't fake features. Extremely large files may be limited by your device's memory." },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About YourX Studio</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          YourX Studio is a privacy-first toolkit for everyday PDF and image tasks. It was built on a simple idea: modern browsers are powerful enough to handle your documents without sending them to a server.
        </p>
      </motion.div>

      <h2 id="privacy" className="mt-14 scroll-mt-24 text-2xl font-bold tracking-tight">
        Privacy-first architecture
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {points.map((p, i) => (
          <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <p.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{p.text}</p>
          </motion.div>
        ))}
      </div>

      <div className="card mt-10 p-6">
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <strong>Statement:</strong> Your files are processed locally whenever possible. YourX Studio does not permanently store your files. The only network requests made are for loading the application itself and web fonts.
        </p>
      </div>

      <div className="mt-14 text-center">
        <p className="text-sm font-semibold tracking-wide text-slate-500">Your files. Your tools. YourX Studio.</p>
        <Link to="/tools" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
          Browse all tools →
        </Link>
      </div>
    </div>
  );
}
