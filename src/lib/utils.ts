export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : decimals))} ${sizes[i]}`;
}

export function parseSize(value: number, unit: "KB" | "MB"): number {
  return Math.round(value * (unit === "KB" ? 1024 : 1024 * 1024));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function stripExt(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Yields to the browser so UI can repaint during heavy loops. */
export function nextFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

export function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:";
  } catch {
    return false;
  }
}

/** Adds https:// when the user types a bare domain such as "example.com". */
export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (/^[^\s/@]+\.[^\s/]{2,}(\/\S*)?$/.test(v)) return `https://${v}`;
  return v;
}

/** Parses "1, 3-5" style page lists. Blank or "all" means every page. */
export function parsePageSpec(input: string, max: number): { pages: number[] | "all"; error?: string } {
  const v = input.trim().toLowerCase();
  if (!v || v === "all") return { pages: "all" };
  const bad = { pages: "all" as const, error: `Use page numbers between 1 and ${max}, like “1, 3-5”.` };
  const set = new Set<number>();
  for (const part of v.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1];
      let b = +m[2];
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) return bad;
      for (let i = a; i <= b; i++) set.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = +p;
      if (n < 1 || n > max) return bad;
      set.add(n);
    } else return bad;
  }
  if (!set.size) return bad;
  return { pages: Array.from(set).sort((a, b) => a - b) };
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Your browser could not encode this image format."))),
      type,
      quality
    );
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded. It may be corrupted or in an unsupported format."));
    img.src = src;
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "An unexpected error occurred.";
}

export const ACCEPT_PDF = { "application/pdf": [".pdf"] };
export const ACCEPT_IMAGES = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };
