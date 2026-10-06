import {
  FileArchive,
  MoonStar,
  Images,
  FileImage,
  Link2,
  Unlink,
  LockKeyhole,
  LockKeyholeOpen,
  Combine,
  Scaling,
  type LucideIcon,
} from "lucide-react";

export type ToolCategory = "pdf" | "image";

export interface ToolDef {
  slug: string;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
  category: ToolCategory;
  gradient: string;
  keywords: string[];
}

export const TOOLS: ToolDef[] = [
  {
    slug: "pdf-compressor",
    name: "PDF Compressor",
    short: "Shrink PDFs to a target size without losing quality.",
    description: "Reduce PDF file size with smart presets or a custom target size. Everything runs locally in your browser.",
    icon: FileArchive,
    category: "pdf",
    gradient: "from-indigo-500 to-violet-500",
    keywords: ["compress", "shrink", "reduce", "size", "optimize", "smaller"],
  },
  {
    slug: "dark-mode-pdf",
    name: "Dark Mode PDF",
    short: "Turn bright documents into easy-on-the-eyes dark PDFs.",
    description: "Invert and tune your PDF pages for comfortable night reading. Adjust darkness, contrast and warmth.",
    icon: MoonStar,
    category: "pdf",
    gradient: "from-slate-700 to-indigo-600",
    keywords: ["dark", "night", "invert", "theme", "black"],
  },
  {
    slug: "pdf-to-image",
    name: "PDF to Image",
    short: "Export PDF pages as JPG, PNG or WEBP images.",
    description: "Convert selected pages or the whole document into high-quality images and download them individually or as a ZIP.",
    icon: FileImage,
    category: "pdf",
    gradient: "from-sky-500 to-cyan-400",
    keywords: ["convert", "jpg", "png", "webp", "export", "pages", "picture"],
  },
  {
    slug: "add-url",
    name: "Add URL",
    short: "Add clickable links with visible text to your PDF pages.",
    description: "Enter a link address and optional text, choose pages, then place it at the bottom of the page, across the whole page, or draw a custom area.",
    icon: Link2,
    category: "pdf",
    gradient: "from-emerald-500 to-teal-400",
    keywords: ["link", "hyperlink", "url", "clickable", "annotation", "add"],
  },
  {
    slug: "remove-url",
    name: "Remove URL",
    short: "Detect and strip hyperlink annotations from a PDF.",
    description: "See every link annotation in your document and remove some or all of them in one click.",
    icon: Unlink,
    category: "pdf",
    gradient: "from-rose-500 to-orange-400",
    keywords: ["remove", "link", "hyperlink", "url", "strip", "clean", "delete"],
  },
  {
    slug: "set-password",
    name: "Set PDF Password",
    short: "Encrypt your PDF with AES-256 password protection.",
    description: "Protect documents with an open password and optional permission restrictions. Your password never leaves your device.",
    icon: LockKeyhole,
    category: "pdf",
    gradient: "from-amber-500 to-yellow-400",
    keywords: ["password", "protect", "encrypt", "lock", "secure", "security"],
  },
  {
    slug: "remove-password",
    name: "Remove PDF Password",
    short: "Unlock a protected PDF you have the password for.",
    description: "Enter the existing password to produce an unencrypted copy that opens without prompts.",
    icon: LockKeyholeOpen,
    category: "pdf",
    gradient: "from-lime-500 to-emerald-400",
    keywords: ["password", "unlock", "decrypt", "remove", "open", "protected"],
  },
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    short: "Combine multiple PDFs into one, in any order.",
    description: "Drag to reorder files, preview their first pages and merge everything into a single document.",
    icon: Combine,
    category: "pdf",
    gradient: "from-fuchsia-500 to-pink-400",
    keywords: ["merge", "combine", "join", "concatenate", "multiple"],
  },
  {
    slug: "image-to-pdf",
    name: "Image to PDF",
    short: "Turn JPG, PNG and WEBP images into a tidy PDF.",
    description: "Reorder, rotate and lay out your images with custom page sizes, margins and fit modes.",
    icon: Images,
    category: "image",
    gradient: "from-violet-500 to-purple-400",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf", "photo", "convert", "picture"],
  },
  {
    slug: "image-resizer",
    name: "Image Resizer",
    short: "Resize and convert images with precise control.",
    description: "Set exact pixel or percentage dimensions, lock the aspect ratio, and export as JPG, PNG or WEBP.",
    icon: Scaling,
    category: "image",
    gradient: "from-cyan-500 to-blue-500",
    keywords: ["resize", "scale", "dimensions", "width", "height", "convert", "image"],
  },
];

export const CATEGORIES: { id: ToolCategory; label: string; blurb: string }[] = [
  { id: "pdf", label: "PDF Tools", blurb: "Compress, convert, secure and edit PDF documents." },
  { id: "image", label: "Image Tools", blurb: "Resize, convert and assemble images." },
];

export function findTool(slug: string) {
  return TOOLS.find((t) => t.slug === slug);
}

export function searchTools(query: string): ToolDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return TOOLS;
  const terms = q.split(/\s+/);
  return TOOLS.map((t) => {
    const hay = `${t.name} ${t.short} ${t.keywords.join(" ")}`.toLowerCase();
    let score = 0;
    if (t.name.toLowerCase().includes(q)) score += 10;
    for (const term of terms) {
      if (t.name.toLowerCase().includes(term)) score += 4;
      if (t.keywords.some((k) => k.includes(term))) score += 3;
      if (hay.includes(term)) score += 1;
    }
    return { t, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
