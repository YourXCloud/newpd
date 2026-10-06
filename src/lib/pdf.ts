/**
 * Lazy loaders for heavy processing libraries.
 * Nothing in here is imported on the initial page load — each tool pulls what it needs on demand.
 */

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, { default: PdfWorker }] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?worker&inline"),
      ]);
      try {
        pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
      } catch {
        // Fallback: pdf.js will run on the main thread ("fake worker") if a real worker cannot be created.
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export function loadPdfLib() {
  return import("@cantoo/pdf-lib");
}

export function loadJSZip() {
  return import("jszip").then((m) => m.default);
}

export class PdfPasswordError extends Error {
  constructor(message = "This PDF is password protected.") {
    super(message);
    this.name = "PdfPasswordError";
  }
}

/** Opens a PDF with pdf.js, converting pdf.js errors into friendly messages. */
export async function openPdf(data: ArrayBuffer, password?: string) {
  const pdfjs = await loadPdfJs();
  try {
    const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password, isEvalSupported: false });
    return await task.promise;
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") {
      throw new PdfPasswordError(
        password ? "Incorrect password. Please check it and try again." : "This PDF is password protected. Unlock it first with the Remove Password tool."
      );
    }
    if (name === "InvalidPDFException") {
      throw new Error("This file doesn't look like a valid PDF. It may be corrupted or not a PDF at all.");
    }
    throw new Error("The PDF could not be opened. It may be damaged or use unsupported features.");
  }
}

export interface RenderedPage {
  index: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export async function renderPage(
  doc: Awaited<ReturnType<typeof openPdf>>,
  pageNumber: number,
  scale: number,
  maxDim = 4096
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  let viewport = page.getViewport({ scale });
  const largest = Math.max(viewport.width, viewport.height);
  if (largest > maxDim) viewport = page.getViewport({ scale: scale * (maxDim / largest) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  page.cleanup();
  return { index: pageNumber - 1, canvas, width: canvas.width, height: canvas.height };
}

/** Renders small thumbnails for previews. */
export async function renderThumbnail(doc: Awaited<ReturnType<typeof openPdf>>, pageNumber: number, targetWidth = 220) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const r = await renderPage(doc, pageNumber, scale);
  return r.canvas.toDataURL("image/jpeg", 0.8);
}

export function readFile(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer().catch(() => {
    throw new Error("The file could not be read. Try selecting it again.");
  });
}
