import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, FileImage, CheckSquare, Square, Archive } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel, PageSkeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Input, Label, Segmented, Slider } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { openPdf, readFile, renderPage, loadJSZip } from "@/lib/pdf";
import { ACCEPT_PDF, canvasToBlob, downloadBlob, formatBytes, nextFrame, stripExt } from "@/lib/utils";
import { findTool } from "@/data/tools";
import { cn } from "@/utils/cn";

type Fmt = "jpeg" | "png" | "webp";
const FMT_LABEL: Record<Fmt, string> = { jpeg: "JPG", png: "PNG", webp: "WEBP" };
const EXT: Record<Fmt, string> = { jpeg: "jpg", png: "png", webp: "webp" };

interface Out {
  page: number;
  blob: Blob;
  url: string;
  w: number;
  h: number;
}

function parseRange(input: string, max: number): number[] {
  const set = new Set<number>();
  for (const part of input.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, +m[1]), b = Math.min(max, +m[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = +p;
      if (n >= 1 && n <= max) set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export default function PdfToImage() {
  const tool = findTool("pdf-to-image")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pages, setPages] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [range, setRange] = useState("");
  const [fmt, setFmt] = useState<Fmt>("jpeg");
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(2);
  const proc = useProcessor<Out[]>();

  useEffect(() => {
    if (!file) return;
    let alive = true;
    (async () => {
      try {
        const doc = await openPdf(await readFile(file));
        if (!alive) return;
        setPages(doc.numPages);
        setSelected(new Set(Array.from({ length: doc.numPages }, (_, i) => i + 1)));
        const t: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const r = await renderPage(doc, i, 0.3, 320);
          t.push(r.canvas.toDataURL("image/jpeg", 0.7));
          if (!alive) break;
          if (i % 4 === 0 || i === doc.numPages) setThumbs([...t]);
          if (i % 2 === 0) await nextFrame();
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

  const toggle = (n: number) => {
    const s = new Set(selected);
    s.has(n) ? s.delete(n) : s.add(n);
    setSelected(s);
    setRange("");
  };
  const applyRange = (v: string) => {
    setRange(v);
    if (v.trim()) setSelected(new Set(parseRange(v, pages)));
  };
  const all = selected.size === pages;

  const convert = () => {
    if (!file) return;
    const list = Array.from(selected).sort((a, b) => a - b);
    proc.run(async (report) => {
      if (list.length === 0) throw new Error("No pages selected. Pick at least one page to convert.");
      report(1, "Opening PDF");
      const doc = await openPdf(await readFile(file));
      const out: Out[] = [];
      for (let i = 0; i < list.length; i++) {
        report(3 + (i / list.length) * 95, "Rendering pages", `Page ${list[i]} (${i + 1} of ${list.length})`);
        const r = await renderPage(doc, list[i], scale, 5000);
        const blob = await canvasToBlob(r.canvas, `image/${fmt}`, fmt === "png" ? undefined : quality / 100);
        out.push({ page: list[i], blob, url: URL.createObjectURL(blob), w: r.width, h: r.height });
        r.canvas.width = 0;
        await nextFrame();
      }
      doc.destroy();
      report(100, "Done");
      return out;
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("Conversion completed", `${proc.result?.length} image(s) generated`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.result?.forEach((o) => URL.revokeObjectURL(o.url));
    proc.reset();
    setFile(null);
    setThumbs([]);
    setPages(0);
    setRange("");
  };

  const downloadZip = async () => {
    if (!proc.result || !file) return;
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const base = stripExt(file.name);
    proc.result.forEach((o) => zip.file(`${base}-page-${String(o.page).padStart(3, "0")}.${EXT[fmt]}`, o.blob));
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    downloadBlob(blob, `${base}-images.zip`);
    toast.success("ZIP downloaded successfully");
  };

  return (
    <ToolLayout tool={tool}>
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_PDF} maxSize={150 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("PDF uploaded successfully", f[0].name))} />
          </Step>
        )}

        {file && proc.status === "idle" && (
          <Step k="configure">
            <FileCard name={file.name} size={file.size} meta={pages ? `${pages} pages` : "Reading…"} onRemove={reset} />

            <Panel title="Select pages" description="Click pages to toggle, or type a range like 1-3, 5, 8.">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Input value={range} onChange={(e) => applyRange(e.target.value)} placeholder="e.g. 1-3, 5, 8" aria-label="Page range" />
                </div>
                <Button variant="outline" size="md" onClick={() => (setSelected(all ? new Set() : new Set(Array.from({ length: pages }, (_, i) => i + 1))), setRange(""))} icon={all ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}>
                  {all ? "Deselect all" : "Select all"}
                </Button>
              </div>
              {thumbs.length === 0 ? (
                <PageSkeleton count={8} />
              ) : (
                <div className="grid max-h-[420px] grid-cols-3 gap-3 overflow-auto p-1 sm:grid-cols-4 md:grid-cols-6">
                  {thumbs.map((t, i) => {
                    const n = i + 1;
                    const on = selected.has(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggle(n)}
                        aria-pressed={on}
                        aria-label={`Page ${n}${on ? ", selected" : ""}`}
                        className={cn("group relative overflow-hidden rounded-lg border-2 transition-all", on ? "border-brand-500 ring-4 ring-brand-500/15" : "border-slate-200 opacity-60 hover:opacity-100 dark:border-white/10")}
                      >
                        <img src={t} alt="" className="aspect-[3/4] w-full object-cover object-top" />
                        <span className={cn("absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-white", on ? "bg-brand-500" : "bg-slate-400/70")}>{on && <CheckSquare className="h-3.5 w-3.5" />}</span>
                        <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent py-1 text-center text-[10px] font-semibold text-white">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">{selected.size} of {pages} pages selected</p>
            </Panel>

            <Panel title="Output">
              <div className="grid gap-5 sm:grid-cols-2">
                <Segmented<Fmt> label="Format" value={fmt} onChange={setFmt} options={(["jpeg", "png", "webp"] as Fmt[]).map((f) => ({ value: f, label: FMT_LABEL[f] }))} />
                <div>
                  <Label hint={`${Math.round(72 * scale)} DPI`}>Resolution</Label>
                  <Segmented value={String(scale)} onChange={(v) => setScale(Number(v))} options={[{ value: "1", label: "Low" }, { value: "2", label: "Medium" }, { value: "3", label: "High" }, { value: "4", label: "Ultra" }]} />
                </div>
              </div>
              {fmt !== "png" && (
                <div className="mt-5">
                  <Slider label="Image quality" min={30} max={100} value={quality} onChange={setQuality} format={(v) => `${v}%`} />
                </div>
              )}
            </Panel>

            <Button size="lg" className="w-full sm:w-auto" onClick={convert} disabled={selected.size === 0 || thumbs.length === 0} icon={<FileImage className="h-5 w-5" />}>
              Convert {selected.size} page{selected.size !== 1 && "s"}
            </Button>
          </Step>
        )}

        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Converting pages" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Conversion failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
            <Button variant="outline" onClick={() => proc.reset()}>Change settings</Button>
          </Step>
        )}

        {proc.status === "done" && proc.result && file && (
          <Step k="done">
            <ResultPanel
              title="Your images are ready!"
              subtitle={`${proc.result.length} ${FMT_LABEL[fmt]} image${proc.result.length !== 1 ? "s" : ""} · ${formatBytes(proc.result.reduce((s, o) => s + o.blob.size, 0))} total`}
              onDownload={downloadZip}
              downloadLabel="Download all as ZIP"
              onReset={reset}
              extraActions={
                proc.result.length === 1 ? (
                  <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => (downloadBlob(proc.result![0].blob, `${stripExt(file.name)}-page-${proc.result![0].page}.${EXT[fmt]}`), toast.success("File downloaded successfully"))}>
                    Download image
                  </Button>
                ) : undefined
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {proc.result.map((o, i) => (
                  <motion.figure key={o.page} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="checker">
                      <img src={o.url} alt={`Page ${o.page}`} className="aspect-[3/4] w-full object-contain" />
                    </div>
                    <figcaption className="flex items-center justify-between px-2.5 py-2 text-xs">
                      <span className="font-medium">Page {o.page}</span>
                      <span className="text-slate-500">{formatBytes(o.blob.size)}</span>
                    </figcaption>
                    <button
                      onClick={() => (downloadBlob(o.blob, `${stripExt(file.name)}-page-${o.page}.${EXT[fmt]}`), toast.success("File downloaded successfully"))}
                      aria-label={`Download page ${o.page}`}
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-800 shadow-md backdrop-blur transition hover:bg-brand-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </motion.figure>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <Archive className="h-3.5 w-3.5" /> Hover an image to download it individually.
              </div>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
