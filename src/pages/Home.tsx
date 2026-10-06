import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, WifiOff, Sparkles, FileText, Images, Search } from "lucide-react";
import { Link, useRouter } from "@/lib/router";
import { Button } from "@/components/ui/Button";
import { ToolCard } from "@/components/ToolCard";
import { TOOLS, CATEGORIES } from "@/data/tools";
import { useState } from "react";
import { CommandPalette } from "@/components/Navbar";

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

export function Home() {
  const { navigate } = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="grid-bg absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 animate-float rounded-full bg-gradient-to-br from-brand-400/30 via-violet-400/20 to-accent-400/25 blur-3xl dark:from-brand-600/25 dark:via-violet-600/15 dark:to-accent-500/15" />
          <div className="absolute right-[-10%] top-40 h-72 w-72 animate-float-slow rounded-full bg-gradient-to-br from-pink-400/20 to-amber-300/20 blur-3xl dark:from-pink-500/10 dark:to-amber-400/10" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
          <motion.div variants={fade} initial="hidden" animate="show" custom={0} className="mx-auto flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 py-1.5 pl-1.5 pr-4 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <span className="rounded-full bg-gradient-to-r from-brand-600 to-violet-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">New</span>
            10 tools · 100% in-browser · No sign-up
          </motion.div>

          <motion.h1 variants={fade} initial="hidden" animate="show" custom={1} className="mx-auto mt-6 max-w-4xl text-center text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Powerful PDF & Image Tools.
            <br />
            <span className="text-gradient">Right in Your Browser.</span>
          </motion.h1>

          <motion.p variants={fade} initial="hidden" animate="show" custom={2} className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
            Compress, convert, secure, edit and resize your files in seconds. Everything happens locally on your device — fast, private, and free.
          </motion.p>

          <motion.div variants={fade} initial="hidden" animate="show" custom={3} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/tools")} icon={<Sparkles className="h-5 w-5" />} className="w-full sm:w-auto">
              Explore Tools
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/tool/pdf-compressor")} className="w-full sm:w-auto">
              Try a Tool <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>

          <motion.button
            variants={fade}
            initial="hidden"
            animate="show"
            custom={4}
            onClick={() => setSearchOpen(true)}
            className="group mx-auto mt-6 flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-left text-sm text-slate-500 shadow-soft backdrop-blur transition hover:border-brand-300 hover:shadow-lift dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
          >
            <Search className="h-4 w-4 text-slate-400 transition group-hover:text-brand-500" />
            <span className="flex-1">Search tools — “compress”, “merge”, “resize”…</span>
            <kbd className="rounded-md border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-semibold dark:border-white/15">⌘K</kbd>
          </motion.button>

          <motion.ul variants={fade} initial="hidden" animate="show" custom={5} className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Private by design", text: "Files never leave your device." },
              { icon: Zap, title: "Instant results", text: "No queues, no uploads, no waiting." },
              { icon: WifiOff, title: "Works offline", text: "Once loaded, tools keep working." },
            ].map((f) => (
              <li key={f.title} className="glass flex items-center gap-3 rounded-2xl p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <f.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* TOOLS */}
      <section id="tools" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-24 sm:px-6 lg:px-8">
        {CATEGORIES.map((cat) => {
          const list = TOOLS.filter((t) => t.category === cat.id);
          const CatIcon = cat.id === "pdf" ? FileText : Images;
          return (
            <div key={cat.id} className="mb-16">
              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    <CatIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{cat.label}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{cat.blurb}</p>
                  </div>
                </div>
                <Link to={`/tools/${cat.id}`} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
                  View all {cat.label.toLowerCase()} →
                </Link>
              </motion.div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((t, i) => (
                  <ToolCard key={t.slug} tool={t} index={i} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* PRIVACY BAND */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-14 text-center text-white shadow-lift sm:px-12 dark:bg-[#12151f] dark:ring-1 dark:ring-white/10"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(800px circle at 20% 0%, rgba(99,102,241,0.35), transparent 50%), radial-gradient(600px circle at 90% 100%, rgba(6,182,212,0.25), transparent 50%)" }} />
          <div className="relative">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Privacy isn't a feature. It's the architecture.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Your files are processed locally whenever possible. YourX Studio does not permanently store your files. Temporary data lives only in your browser's memory and is released when you're done.
            </p>
            <p className="mt-8 text-sm font-semibold tracking-wide text-slate-400">Your files. Your tools. YourX Studio.</p>
          </div>
        </motion.div>
      </section>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
