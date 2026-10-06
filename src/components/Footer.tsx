import { ShieldCheck } from "lucide-react";
import { Link } from "@/lib/router";
import { Logo } from "./Navbar";
import { TOOLS } from "@/data/tools";

export function Footer() {
  const pdf = TOOLS.filter((t) => t.category === "pdf");
  const img = TOOLS.filter((t) => t.category === "image");
  return (
    <footer className="border-t border-slate-200/70 bg-white/50 dark:border-white/[0.06] dark:bg-black/20">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">All-in-one PDF & Image tools, directly in your browser. Fast, private and free.</p>
            <div className="mt-5 inline-flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your files are processed locally whenever possible. YourX Studio does not permanently store your files.</span>
            </div>
          </div>
          <FooterCol title="PDF Tools" items={pdf.map((t) => ({ label: t.name, to: `/tool/${t.slug}` }))} />
          <FooterCol title="Image Tools" items={img.map((t) => ({ label: t.name, to: `/tool/${t.slug}` }))} />
          <FooterCol
            title="Studio"
            items={[
              { label: "All tools", to: "/tools" },
              { label: "About", to: "/about" },
              { label: "Privacy", to: "/about#privacy" },
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-slate-200/70 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center dark:border-white/[0.06] dark:text-slate-500">
          <p>© {new Date().getFullYear()} YourX Studio. Built for the browser.</p>
          <p className="font-medium text-slate-600 dark:text-slate-400">Your files. Your tools. YourX Studio.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="text-sm text-slate-600 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
