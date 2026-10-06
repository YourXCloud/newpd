import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Moon, Sun, Search, Code2 as Github, ArrowRight, CornerDownLeft } from "lucide-react";
import { Link, useRouter } from "@/lib/router";
import { useTheme } from "@/lib/theme";
import { searchTools, TOOLS } from "@/data/tools";
import { cn } from "@/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 via-violet-500 to-accent-500 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.7)]">
        <svg viewBox="0 0 64 64" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 16l14 16-14 16M32 32h16" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">
        YourX <span className="text-gradient">Studio</span>
      </span>
    </span>
  );
}

const NAV = [
  { label: "Tools", to: "/tools" },
  { label: "PDF Tools", to: "/tools/pdf" },
  { label: "Image Tools", to: "/tools/image" },
  { label: "About", to: "/about" },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const { path } = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <header className={cn("sticky top-0 z-50 transition-all duration-300", scrolled ? "glass shadow-soft" : "bg-transparent")}>
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
          <Link to="/" aria-label="YourX Studio home" className="shrink-0">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = path === n.to || (n.to !== "/tools" && path.startsWith(n.to));
              return (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    className={cn(
                      "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                      active ? "text-slate-900 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    )}
                  >
                    {n.label}
                    {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-slate-900/[0.05] dark:bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search tools"
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Search className="h-[18px] w-[18px]" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden rounded-md border border-slate-300/70 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 lg:inline dark:border-white/15">⌘K</kbd>
            </button>
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.25 }}
                  className="flex"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </motion.span>
              </AnimatePresence>
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Source on GitHub"
              className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-900/5 sm:flex dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Github className="h-5 w-5" />
            </a>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-900/5 md:hidden dark:text-slate-200 dark:hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] md:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-white p-5 shadow-lift dark:bg-[#0f121b]"
              role="dialog"
              aria-label="Navigation menu"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-900/5 dark:hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ul className="mt-8 space-y-1">
                {NAV.map((n, i) => (
                  <motion.li key={n.to} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                    <Link to={n.to} className="flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium hover:bg-slate-900/5 dark:hover:bg-white/10">
                      {n.label} <ArrowRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Quick access</p>
                <div className="grid grid-cols-2 gap-2">
                  {TOOLS.slice(0, 6).map((t) => (
                    <Link key={t.slug} to={`/tool/${t.slug}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium dark:border-white/10">
                      <t.icon className="h-4 w-4 text-brand-500" /> <span className="truncate">{t.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { navigate } = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchTools(q);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  const go = (slug: string) => {
    onClose();
    navigate(`/tool/${slug}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label="Search tools"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift dark:border-white/10 dark:bg-[#12151f]"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active].slug);
              } else if (e.key === "Escape") onClose();
            }}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/[0.06]">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tools… try “compress”, “merge”, “resize”"
                aria-label="Search tools"
                aria-activedescendant={results[active] ? `cmd-${results[active].slug}` : undefined}
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              />
              <kbd className="hidden rounded-md border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline dark:border-white/15">ESC</kbd>
            </div>
            <ul role="listbox" className="max-h-[50vh] overflow-auto p-2">
              {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No tools match “{q}”.</li>}
              {results.map((t, i) => (
                <li
                  key={t.slug}
                  id={`cmd-${t.slug}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(t.slug)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors", i === active && "bg-brand-50 dark:bg-brand-500/15")}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${t.gradient} text-white`}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t.short}</span>
                  </span>
                  {i === active && <CornerDownLeft className="h-4 w-4 text-slate-400" />}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
