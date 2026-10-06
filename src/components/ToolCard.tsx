import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/lib/router";
import type { ToolDef } from "@/data/tools";

export function ToolCard({ tool, index = 0 }: { tool: ToolDef; index?: number }) {
  const Icon = tool.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3), ease: "easeOut" }}
      className="h-full"
    >
      <Link
        to={`/tool/${tool.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift dark:border-white/[0.07] dark:bg-[#12151f] dark:hover:border-brand-500/30"
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tool.gradient} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30`}
        />
        <div className="flex items-start justify-between">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-all duration-300 group-hover:border-brand-400 group-hover:bg-brand-500 group-hover:text-white dark:border-white/10">
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
        <h3 className="mt-5 text-base font-semibold tracking-tight text-slate-900 dark:text-white">{tool.name}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tool.short}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300">
          Open tool
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </Link>
    </motion.div>
  );
}
