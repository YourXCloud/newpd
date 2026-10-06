import { lazy, Suspense, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { RouterProvider, useRouter, Link } from "@/lib/router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Home } from "@/pages/Home";
import { ToolsPage, AboutPage } from "@/pages/Tools";
import { Button } from "@/components/ui/Button";

// Heavy tools (and their PDF/image libraries) are only loaded when opened.
const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<ComponentType>> = {
  "pdf-compressor": lazy(() => import("@/tools/PdfCompressor")),
  "dark-mode-pdf": lazy(() => import("@/tools/DarkModePdf")),
  "pdf-to-image": lazy(() => import("@/tools/PdfToImage")),
  "add-url": lazy(() => import("@/tools/AddUrl")),
  "remove-url": lazy(() => import("@/tools/RemoveUrl")),
  "set-password": lazy(() => import("@/tools/Password").then((m) => ({ default: m.SetPassword }))),
  "remove-password": lazy(() => import("@/tools/Password").then((m) => ({ default: m.RemovePassword }))),
  "merge-pdf": lazy(() => import("@/tools/MergePdf")),
  "image-to-pdf": lazy(() => import("@/tools/ImageToPdf")),
  "image-resizer": lazy(() => import("@/tools/ImageResizer")),
};

function ToolSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8" aria-busy aria-label="Loading tool">
      <div className="skeleton h-4 w-20" />
      <div className="mt-6 flex items-center gap-5">
        <div className="skeleton h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-4 w-full max-w-lg" />
        </div>
      </div>
      <div className="skeleton mt-10 h-64 w-full rounded-3xl" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-7xl font-black text-gradient">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}

function Routes() {
  const { path } = useRouter();
  let page: React.ReactNode;
  let key = path;

  if (path === "/" || path === "") page = <Home />;
  else if (path === "/tools") page = <ToolsPage key="all" />;
  else if (path === "/tools/pdf") page = <ToolsPage key="pdf" category="pdf" />;
  else if (path === "/tools/image") page = <ToolsPage key="image" category="image" />;
  else if (path.startsWith("/about")) {
    page = <AboutPage />;
    key = "/about";
  } else if (path.startsWith("/tool/")) {
    const slug = path.slice("/tool/".length);
    const Cmp = TOOL_COMPONENTS[slug];
    page = Cmp ? (
      <Suspense fallback={<ToolSkeleton />}>
        <Cmp />
      </Suspense>
    ) : (
      <NotFound />
    );
  } else page = <NotFound />;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main key={key} id="main" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: "easeOut" }} className="flex-1">
        {page}
      </motion.main>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white">
            Skip to content
          </a>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <Routes />
            <Footer />
          </div>
        </RouterProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
