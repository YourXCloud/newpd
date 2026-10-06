import { useEffect, useMemo, useRef, useState } from "react";
import { MoonStar } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel, InfoNote, PageSkeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Slider, Toggle } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { openPdf, readFile, renderPage, loadPdfLib } from "@/lib/pdf";
import { ACCEPT_PDF, canvasToBlob, downloadBlob, formatBytes, nextFrame, stripExt } from "@/lib/utils";
import { findTool } from "@/data/tools";

interface Settings {
  darkness: number; // 0-100 → how dark the background becomes
  contrast: number; // 80-150
  preserveColors: boolean;
  warmth: number; // 0-40
}

/** Apply dark-mode transform to canvas pixels (in place). */
export function applyDark(canvas: HTMLCanvasElement, s: Settings) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const contrast = s.contrast / 100;
  const bgLift = (100 - s.darkness) / 100; // 0 = pure black background
  const warm = s.warmth / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (s.preserveColors) {
      // Invert lightness only (HSL) so colors keep their hue
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (max === min) {
        r = g = b = 255 - l;
      } else {
        const dl = max - min;
        const sat = l > 127.5 ? dl / (510 - max - min) : dl / (max + min);
        let h = 0;
        if (max === r) h = (g - b) / dl + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / dl + 2;
        else h = (r - g) / dl + 4;
        h /= 6;
        const nl = (255 - l) / 255;
        const q = nl < 0.5 ? nl * (1 + sat) : nl + sat - nl * sat;
        const p = 2 * nl - q;
        const hue = (t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        r = hue(h + 1 / 3) * 255;
        g = hue(h) * 255;
        b = hue(h - 1 / 3) * 255;
      }
    } else {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    // lift darkest values toward a softer background and apply contrast
    r = (r - 128) * contrast + 128 + bgLift * 40;
    g = (g - 128) * contrast + 128 + bgLift * 40;
    b = (b - 128) * contrast + 128 + bgLift * 40;
    if (warm > 0) {
      r += warm * 30;
      b -= warm * 30;
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);
}

interface Result {
  blob: Blob;
  previews: string[];
  pages: number;
}

export default function DarkModePdf() {
  const tool = findTool("dark-mode-pdf")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number>(0);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null); // first page master
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>({ darkness: 85, contrast: 105, preserveColors: true, warmth: 0 });
  const previewRef = useRef<HTMLCanvasElement>(null);
  const proc = useProcessor<Result>();

  // Load first page and thumbnails
  useEffect(() => {
    if (!file) return;
    let alive = true;
    (async () => {
      try {
        const doc = await openPdf(await readFile(file));
        if (!alive) return;
        setPages(doc.numPages);
        const r = await renderPage(doc, 1, 1.0, 900);
        if (alive) setSource(r.canvas);
        const t: string[] = [];
        for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
          const p = await renderPage(doc, i, 0.25, 300);
          t.push(p.canvas.toDataURL("image/jpeg", 0.75));
          if (alive) setThumbs([...t]);
        }
        doc.destroy();
      } catch (e) {
        toast.error("Could not read PDF", e instanceof Error ? e.message : undefined);
        setFile(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Live preview (debounced)
  const settingsKey = useMemo(() => JSON.stringify(settings), [settings]);
  useEffect(() => {
    if (!source || !previewRef.current) return;
    const id = setTimeout(() => {
      const c = previewRef.current!;
      const scale = Math.min(1, 420 / source.width);
      c.width = Math.round(source.width * scale);
      c.height = Math.round(source.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(source, 0, 0, c.width, c.height);
      applyDark(c, settings);
    }, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, settingsKey, proc.status]);

  const convert = () => {
    if (!file) return;
    proc.run(async (report) => {
      report(2, "Opening PDF");
      const data = await readFile(file);
      const doc = await openPdf(data);
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      out.setProducer("YourX Studio");
      const n = doc.numPages;
      const previews: string[] = [];
      for (let i = 1; i <= n; i++) {
        report(5 + ((i - 1) / n) * 90, "Converting pages", `Page ${i} of ${n}`);
        const page = await doc.getPage(i);
        const { width, height } = page.getViewport({ scale: 1 });
        const r = await renderPage(doc, i, 1.8, 2600);
        await nextFrame();
        applyDark(r.canvas, settings);
        const blob = await canvasToBlob(r.canvas, "image/jpeg", 0.85);
        if (previews.length < 3) previews.push(URL.createObjectURL(blob));
        const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const p = out.addPage([width, height]);
        p.drawImage(img, { x: 0, y: 0, width, height });
        r.canvas.width = 0; // release
      }
      doc.destroy();
      report(97, "Finalizing document");
      const bytes = await out.save({ useObjectStreams: true });
      report(100, "Done");
      return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), previews, pages: n };
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("Dark mode conversion completed", `${proc.result?.pages} pages converted`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.result?.previews.forEach((u) => URL.revokeObjectURL(u));
    proc.reset();
    setFile(null);
    setSource(null);
    setThumbs([]);
    setPages(0);
  };

  return (
    <ToolLayout
      tool={tool}
      aside={
        file &&
        proc.status === "idle" && (
          <Panel title="Live preview" description="First page with your current settings.">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 dark:border-white/10">
              {source ? <canvas ref={previewRef} className="block w-full" aria-label="Dark mode preview of page 1" /> : <div className="skeleton aspect-[3/4]" />}
            </div>
          </Panel>
        )
      }
    >
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_PDF} maxSize={150 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("PDF uploaded successfully", f[0].name))} />
            <InfoNote>The conversion is performed entirely in your browser: pages are rendered, inverted with your settings and re-assembled into a new PDF. Text in the output becomes an image and is no longer selectable.</InfoNote>
          </Step>
        )}

        {file && proc.status === "idle" && (
          <Step k="configure">
            <FileCard name={file.name} size={file.size} meta={pages ? `${pages} pages` : "Reading…"} onRemove={reset} />

            <Panel title="Pages">
              {thumbs.length === 0 ? (
                <PageSkeleton count={4} />
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {thumbs.map((t, i) => (
                    <figure key={i} className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                      <img src={t} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover object-top" />
                      <figcaption className="py-1 text-center text-[10px] text-slate-500">{i + 1}</figcaption>
                    </figure>
                  ))}
                  {pages > 8 && <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 dark:border-white/15">+{pages - 8} more</div>}
                </div>
              )}
            </Panel>

            <Panel title="Appearance">
              <div className="space-y-5">
                <Slider label="Darkness" min={40} max={100} value={settings.darkness} onChange={(v) => setSettings({ ...settings, darkness: v })} format={(v) => `${v}%`} />
                <Slider label="Contrast" min={80} max={150} value={settings.contrast} onChange={(v) => setSettings({ ...settings, contrast: v })} format={(v) => `${v}%`} />
                <Slider label="Warmth" min={0} max={40} value={settings.warmth} onChange={(v) => setSettings({ ...settings, warmth: v })} format={(v) => (v === 0 ? "Off" : `${v}`)} />
                <Toggle checked={settings.preserveColors} onChange={(v) => setSettings({ ...settings, preserveColors: v })} label="Preserve colors" description="Invert brightness only, so images and highlights keep their original hue." />
              </div>
            </Panel>

            <Button size="lg" className="w-full sm:w-auto" onClick={convert} disabled={!source} icon={<MoonStar className="h-5 w-5" />}>
              Convert to Dark Mode
            </Button>
          </Step>
        )}

        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Converting PDF" />
          </Step>
        )}

        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Conversion failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
          </Step>
        )}

        {proc.status === "done" && proc.result && file && (
          <Step k="done">
            <ResultPanel
              title="Your dark PDF is ready!"
              subtitle={`${proc.result.pages} pages · ${formatBytes(proc.result.blob.size)}`}
              onDownload={() => (downloadBlob(proc.result!.blob, `${stripExt(file.name)}-dark.pdf`), toast.success("File downloaded successfully"))}
              downloadLabel="Download dark PDF"
              onReset={reset}
            >
              <div className="grid grid-cols-3 gap-3">
                {proc.result.previews.map((p, i) => (
                  <img key={i} src={p} alt={`Converted page ${i + 1}`} className="w-full rounded-lg border border-slate-200 dark:border-white/10" />
                ))}
              </div>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
