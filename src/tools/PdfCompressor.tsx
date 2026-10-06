import { useEffect, useState } from "react";
import { Gauge, FileText, Target, Sparkles } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel, InfoNote } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Input, Label, Segmented, Select } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { openPdf, readFile, renderPage, renderThumbnail, loadPdfLib } from "@/lib/pdf";
import { ACCEPT_PDF, canvasToBlob, downloadBlob, formatBytes, nextFrame, parseSize, stripExt } from "@/lib/utils";
import { findTool } from "@/data/tools";
import { cn } from "@/utils/cn";

type Level = "light" | "balanced" | "strong" | "extreme" | "custom";
type Mode = "raster" | "lossless";

const PRESETS: Record<Exclude<Level, "custom">, { scale: number; quality: number; label: string; blurb: string }> = {
  light: { scale: 1.6, quality: 0.85, label: "Light", blurb: "Best quality, modest savings" },
  balanced: { scale: 1.3, quality: 0.72, label: "Balanced", blurb: "Great quality, good savings" },
  strong: { scale: 1.0, quality: 0.55, label: "Strong", blurb: "Smaller files, readable text" },
  extreme: { scale: 0.75, quality: 0.4, label: "Extreme", blurb: "Smallest size, lower fidelity" },
};

// Quality ladder used when hunting for a custom target size (best → smallest)
const LADDER: { scale: number; quality: number }[] = [
  { scale: 2.0, quality: 0.9 },
  { scale: 1.6, quality: 0.85 },
  { scale: 1.4, quality: 0.78 },
  { scale: 1.3, quality: 0.72 },
  { scale: 1.15, quality: 0.65 },
  { scale: 1.0, quality: 0.58 },
  { scale: 0.9, quality: 0.5 },
  { scale: 0.8, quality: 0.45 },
  { scale: 0.7, quality: 0.4 },
  { scale: 0.6, quality: 0.35 },
  { scale: 0.5, quality: 0.3 },
];

interface Result {
  blob: Blob;
  originalSize: number;
  preview: string;
  pages: number;
  mode: Mode;
  settings?: { scale: number; quality: number };
}

export default function PdfCompressor() {
  const tool = findTool("pdf-compressor")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [pages, setPages] = useState<number>(0);
  const [level, setLevel] = useState<Level>("balanced");
  const [mode, setMode] = useState<Mode>("raster");
  const [targetValue, setTargetValue] = useState("1");
  const [targetUnit, setTargetUnit] = useState<"KB" | "MB">("MB");
  const proc = useProcessor<Result>();

  useEffect(() => {
    if (!file) return;
    let alive = true;
    (async () => {
      try {
        const doc = await openPdf(await readFile(file));
        const t = await renderThumbnail(doc, 1, 160);
        if (alive) {
          setThumb(t);
          setPages(doc.numPages);
        }
        doc.destroy();
      } catch {
        /* preview is optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  const targetBytes = level === "custom" ? parseSize(Number(targetValue) || 0, targetUnit) : null;
  const targetInvalid = level === "custom" && (!targetBytes || targetBytes < 10 * 1024 || (file && targetBytes >= file.size));

  const compress = () => {
    if (!file) return;
    proc.run(async (report) => {
      const originalSize = file.size;
      report(2, "Opening PDF", "Parsing document structure");
      const data = await readFile(file);
      const { PDFDocument } = await loadPdfLib();

      // --- Lossless (structural) pass: keeps text selectable
      report(6, "Optimizing structure", "Rewriting objects & streams");
      const src = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
      const losslessBytes = await src.save({ useObjectStreams: true });
      const losslessBlob = new Blob([losslessBytes as BlobPart], { type: "application/pdf" });

      if (mode === "lossless") {
        const doc = await openPdf(data);
        const preview = await renderThumbnail(doc, 1, 480);
        doc.destroy();
        report(100, "Finalizing document");
        return { blob: losslessBlob, originalSize, preview, pages: src.getPageCount(), mode };
      }

      // --- Raster pass: render every page and re-encode as JPEG
      const doc = await openPdf(data);
      const n = doc.numPages;
      const masters: HTMLCanvasElement[] = [];
      for (let i = 1; i <= n; i++) {
        report(8 + (i / n) * 42, "Rendering pages", `Page ${i} of ${n}`);
        const r = await renderPage(doc, i, 2.0, 3000);
        masters.push(r.canvas);
        await nextFrame();
      }
      doc.destroy();

      const encodeAll = async (scale: number, quality: number, onPage?: (i: number) => void) => {
        const blobs: Blob[] = [];
        for (let i = 0; i < masters.length; i++) {
          const m = masters[i];
          const f = scale / 2.0;
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(m.width * f));
          c.height = Math.max(1, Math.round(m.height * f));
          const ctx = c.getContext("2d")!;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(m, 0, 0, c.width, c.height);
          blobs.push(await canvasToBlob(c, "image/jpeg", quality));
          onPage?.(i);
          if (i % 3 === 0) await nextFrame();
        }
        return blobs;
      };

      let chosen: { scale: number; quality: number } | null = null;
      let images: Blob[] = [];

      if (level === "custom" && targetBytes) {
        // Walk the quality ladder from best to smallest until the estimate fits the target.
        const overhead = 1200 + n * 300; // approximate PDF container overhead
        for (let k = 0; k < LADDER.length; k++) {
          const cand = LADDER[k];
          report(50 + (k / LADDER.length) * 35, "Searching for target size", `Trying quality level ${k + 1} of ${LADDER.length}`);
          const blobs = await encodeAll(cand.scale, cand.quality);
          const total = blobs.reduce((s, b) => s + b.size, 0) + overhead;
          if (total <= targetBytes) {
            chosen = cand;
            images = blobs;
            break;
          }
          if (k === LADDER.length - 1) {
            masters.length = 0;
            throw new Error(
              `The smallest result we can produce for this ${n}-page document is about ${formatBytes(total)}, which is above your ${formatBytes(targetBytes)} target. Try a larger target, remove pages first, or accept the “Extreme” preset.`
            );
          }
        }
      } else {
        const p = PRESETS[level as Exclude<Level, "custom">];
        chosen = { scale: p.scale, quality: p.quality };
        images = await encodeAll(p.scale, p.quality, (i) => report(50 + ((i + 1) / n) * 35, "Compressing images", `Page ${i + 1} of ${n}`));
      }

      report(88, "Finalizing document", "Assembling compressed PDF");
      const out = await PDFDocument.create();
      out.setProducer("YourX Studio");
      const srcPages = src.getPages();
      for (let i = 0; i < images.length; i++) {
        const bytes = new Uint8Array(await images[i].arrayBuffer());
        const img = await out.embedJpg(bytes);
        const { width, height } = srcPages[i]?.getSize() ?? { width: img.width, height: img.height };
        const page = out.addPage([width, height]);
        page.drawImage(img, { x: 0, y: 0, width, height });
        if (i % 5 === 0) await nextFrame();
      }
      const bytes = await out.save({ useObjectStreams: true });
      let blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const preview = URL.createObjectURL(images[0]);

      // If the lossless pass is already smaller, prefer it (never make the file bigger).
      let finalMode: Mode = "raster";
      if (losslessBlob.size < blob.size && (!targetBytes || losslessBlob.size <= targetBytes)) {
        blob = losslessBlob;
        finalMode = "lossless";
      }
      masters.length = 0;
      report(100, "Done");
      return { blob, originalSize, preview, pages: n, mode: finalMode, settings: chosen ?? undefined };
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done" && proc.result) {
      const r = proc.result;
      const pct = Math.max(0, Math.round((1 - r.blob.size / r.originalSize) * 100));
      if (r.blob.size >= r.originalSize) toast.info("Already optimized", "This PDF was already compact — the output is about the same size.");
      else toast.success("Compression completed", `${formatBytes(r.originalSize)} → ${formatBytes(r.blob.size)} (${pct}% smaller)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    if (proc.result?.preview.startsWith("blob:")) URL.revokeObjectURL(proc.result.preview);
    proc.reset();
    setFile(null);
    setThumb(null);
    setPages(0);
  };

  const r = proc.result;
  const reduction = r ? Math.round((1 - r.blob.size / r.originalSize) * 100) : 0;

  return (
    <ToolLayout tool={tool}>
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone
              accept={ACCEPT_PDF}
              maxSize={200 * 1024 * 1024}
              onFiles={(f) => {
                setFile(f[0]);
                toast.success("PDF uploaded successfully", f[0].name);
              }}
            />
          </Step>
        )}

        {file && proc.status === "idle" && (
          <Step k="configure">
            <FileCard name={file.name} size={file.size} thumbnail={thumb} meta={pages ? `${pages} page${pages > 1 ? "s" : ""}` : "Reading…"} onRemove={reset} />

            <Panel title="Compression mode">
              <Segmented<Mode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: "raster", label: "Maximum compression", icon: <Gauge className="h-4 w-4" /> },
                  { value: "lossless", label: "Keep text selectable", icon: <FileText className="h-4 w-4" /> },
                ]}
              />
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {mode === "raster"
                  ? "Pages are re-rendered as optimized images for the biggest savings. Text remains readable but is no longer selectable."
                  : "Rewrites the file structure without touching page content. Savings vary — works best on PDFs from office apps or scanners that weren't optimized."}
              </p>
            </Panel>

            {mode === "raster" && (
              <Panel title="Compression level">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(Object.keys(PRESETS) as Exclude<Level, "custom">[]).map((k) => (
                    <LevelButton key={k} active={level === k} onClick={() => setLevel(k)} title={PRESETS[k].label} blurb={PRESETS[k].blurb} />
                  ))}
                  <LevelButton active={level === "custom"} onClick={() => setLevel("custom")} title="Custom" blurb="Target a file size" icon={<Target className="h-4 w-4" />} />
                </div>
                <AnimatePresence>
                  {level === "custom" && (
                    <Step k="custom">
                      <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                        <Label htmlFor="target">Target file size</Label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input id="target" type="number" min={0.01} step="any" inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
                          </div>
                          <div className="w-28">
                            <Select value={targetUnit} onChange={(e) => setTargetUnit(e.target.value as "KB" | "MB")} aria-label="Unit">
                              <option>KB</option>
                              <option>MB</option>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {[
                            ["200", "KB"],
                            ["500", "KB"],
                            ["1", "MB"],
                            ["2", "MB"],
                            ["5", "MB"],
                          ].map(([v, u]) => (
                            <button
                              key={v + u}
                              onClick={() => {
                                setTargetValue(v);
                                setTargetUnit(u as "KB" | "MB");
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10"
                            >
                              {v} {u}
                            </button>
                          ))}
                        </div>
                        {targetInvalid && (
                          <p role="alert" className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">
                            {targetBytes && file && targetBytes >= file.size ? `Target must be smaller than the original (${formatBytes(file.size)}).` : "Enter a target of at least 10 KB."}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">We'll search for the best quality that fits under your target.</p>
                      </div>
                    </Step>
                  )}
                </AnimatePresence>
              </Panel>
            )}

            <Button size="lg" className="w-full sm:w-auto" onClick={compress} disabled={!!targetInvalid} icon={<Sparkles className="h-5 w-5" />}>
              Compress PDF
            </Button>
          </Step>
        )}

        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Compressing PDF" />
          </Step>
        )}

        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Compression failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
            {file && <FileCard name={file.name} size={file.size} thumbnail={thumb} onRemove={reset} />}
            <Button variant="outline" onClick={() => proc.reset()}>
              Change settings
            </Button>
          </Step>
        )}

        {proc.status === "done" && r && file && (
          <Step k="done">
            <ResultPanel
              title="Your PDF is ready!"
              subtitle={
                <>
                  Original: <strong>{formatBytes(r.originalSize)}</strong> → New: <strong>{formatBytes(r.blob.size)}</strong>
                </>
              }
              stats={[
                { label: "Original", value: formatBytes(r.originalSize) },
                { label: "Compressed", value: formatBytes(r.blob.size) },
                { label: "Reduction", value: reduction > 0 ? `${reduction}% smaller` : "No change", highlight: reduction > 0 },
              ]}
              onDownload={() => {
                downloadBlob(r.blob, `${stripExt(file.name)}-compressed.pdf`);
                toast.success("File downloaded successfully");
              }}
              downloadLabel="Download compressed PDF"
              onReset={reset}
            >
              <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
                <div className="checker overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                  <img src={r.preview} alt="Preview of the first compressed page" className="w-full" />
                </div>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    <strong className="text-slate-900 dark:text-white">{r.pages}</strong> page{r.pages !== 1 && "s"} processed using{" "}
                    <strong className="text-slate-900 dark:text-white">{r.mode === "lossless" ? "lossless structural optimization" : "image re-encoding"}</strong>
                    {r.settings && r.mode === "raster" && ` at ${Math.round(r.settings.quality * 100)}% quality`}.
                  </p>
                  {r.mode === "lossless" && mode === "raster" && <InfoNote>The lossless pass produced a smaller file than re-rendering, so we kept your text selectable.</InfoNote>}
                  {targetBytes && r.blob.size <= targetBytes && <InfoNote>Target of {formatBytes(targetBytes)} achieved.</InfoNote>}
                </div>
              </div>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}

function LevelButton({ active, onClick, title, blurb, icon }: { active: boolean; onClick: () => void; title: string; blurb: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border p-3 text-left transition-all",
        active
          ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/10"
          : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{blurb}</span>
    </button>
  );
}
