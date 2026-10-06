import { useEffect, useMemo, useState } from "react";
import { Scaling, Lock, Unlock, ArrowRight } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Input, Label, Segmented, Slider } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { ACCEPT_IMAGES, canvasToBlob, downloadBlob, formatBytes, loadImage, stripExt } from "@/lib/utils";
import { findTool } from "@/data/tools";

type Fmt = "jpeg" | "png" | "webp";
const FMT_LABEL: Record<Fmt, string> = { jpeg: "JPG", png: "PNG", webp: "WEBP" };
const EXT: Record<Fmt, string> = { jpeg: "jpg", png: "png", webp: "webp" };

interface Result {
  blob: Blob;
  url: string;
  w: number;
  h: number;
}

export default function ImageResizer() {
  const tool = findTool("image-resizer")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [orig, setOrig] = useState<{ w: number; h: number } | null>(null);
  const [unit, setUnit] = useState<"px" | "%">("px");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [pct, setPct] = useState("50");
  const [lock, setLock] = useState(true);
  const [fmt, setFmt] = useState<Fmt>("jpeg");
  const [quality, setQuality] = useState(90);
  const proc = useProcessor<Result>();

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    loadImage(u)
      .then((img) => {
        setOrig({ w: img.naturalWidth, h: img.naturalHeight });
        setW(String(img.naturalWidth));
        setH(String(img.naturalHeight));
        const t = file.type.split("/")[1] as Fmt;
        if (["jpeg", "png", "webp"].includes(t)) setFmt(t);
      })
      .catch((e) => {
        toast.error("Could not load image", e.message);
        setFile(null);
      });
    return () => URL.revokeObjectURL(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const ratio = orig ? orig.w / orig.h : 1;
  const target = useMemo(() => {
    if (!orig) return { w: 0, h: 0 };
    if (unit === "%") {
      const p = Math.max(1, Number(pct) || 0) / 100;
      return { w: Math.max(1, Math.round(orig.w * p)), h: Math.max(1, Math.round(orig.h * p)) };
    }
    return { w: Math.max(1, Math.round(Number(w) || 0)), h: Math.max(1, Math.round(Number(h) || 0)) };
  }, [orig, unit, pct, w, h]);

  const tooBig = target.w * target.h > 50_000_000;
  const invalid = !target.w || !target.h || target.w > 16384 || target.h > 16384 || tooBig;

  const onW = (v: string) => {
    setW(v);
    if (lock && orig && Number(v) > 0) setH(String(Math.round(Number(v) / ratio)));
  };
  const onH = (v: string) => {
    setH(v);
    if (lock && orig && Number(v) > 0) setW(String(Math.round(Number(v) * ratio)));
  };

  const resize = () => {
    if (!file || !url) return;
    proc.run(async (report) => {
      report(10, "Decoding image");
      const img = await loadImage(url);
      report(40, "Resampling", `${target.w} × ${target.h}`);
      // Step-down for better quality on large reductions
      let cur: HTMLCanvasElement | HTMLImageElement = img;
      let cw = img.naturalWidth, ch = img.naturalHeight;
      while (cw / 2 > target.w && ch / 2 > target.h) {
        const c = document.createElement("canvas");
        cw = Math.round(cw / 2);
        ch = Math.round(ch / 2);
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cur, 0, 0, cw, ch);
        cur = c;
      }
      const c = document.createElement("canvas");
      c.width = target.w;
      c.height = target.h;
      const ctx = c.getContext("2d")!;
      if (fmt === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(cur, 0, 0, target.w, target.h);
      report(80, "Encoding", FMT_LABEL[fmt]);
      const blob = await canvasToBlob(c, `image/${fmt}`, fmt === "png" ? undefined : quality / 100);
      report(100, "Done");
      return { blob, url: URL.createObjectURL(blob), w: target.w, h: target.h };
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done" && proc.result) toast.success("Image resized", `${proc.result.w} × ${proc.result.h} · ${formatBytes(proc.result.blob.size)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    if (proc.result) URL.revokeObjectURL(proc.result.url);
    proc.reset();
    setFile(null);
    setOrig(null);
    setUrl(null);
  };

  const r = proc.result;

  return (
    <ToolLayout
      tool={tool}
      aside={
        file &&
        url &&
        proc.status === "idle" && (
          <Panel title="Preview">
            <div className="checker flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
              <img src={url} alt="Original" className="max-h-72 w-full object-contain" />
            </div>
            {orig && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Original</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {orig.w} × {orig.h}
                  </dd>
                  <dd className="text-xs text-slate-500">{formatBytes(file.size)}</dd>
                </div>
                <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">New</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-brand-900 dark:text-brand-100">
                    {target.w} × {target.h}
                  </dd>
                  <dd className="text-xs text-brand-700/80 dark:text-brand-300/80">{orig ? `${Math.round((target.w / orig.w) * 100)}% of original` : ""}</dd>
                </div>
              </dl>
            )}
          </Panel>
        )
      }
    >
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_IMAGES} maxSize={60 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("Image uploaded successfully", f[0].name))} title="Drag & drop your image here" />
          </Step>
        )}
        {file && proc.status === "idle" && (
          <Step k="configure">
            <FileCard name={file.name} size={file.size} kind="image" thumbnail={url} meta={orig ? `${orig.w} × ${orig.h}px` : "Reading…"} onRemove={reset} />
            <Panel title="Dimensions">
              <Segmented value={unit} onChange={setUnit} options={[{ value: "px", label: "Pixels" }, { value: "%", label: "Percentage" }]} />
              {unit === "px" ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="w">Width</Label>
                    <Input id="w" type="number" inputMode="numeric" min={1} value={w} onChange={(e) => onW(e.target.value)} suffix="px" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLock(!lock)}
                    aria-pressed={lock}
                    aria-label={lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    title={lock ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl border transition ${lock ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "border-slate-200 text-slate-500 dark:border-white/10"}`}
                  >
                    {lock ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </button>
                  <div className="flex-1">
                    <Label htmlFor="h">Height</Label>
                    <Input id="h" type="number" inputMode="numeric" min={1} value={h} onChange={(e) => onH(e.target.value)} suffix="px" />
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Label htmlFor="pct">Scale</Label>
                  <Input id="pct" type="number" inputMode="numeric" min={1} max={400} value={pct} onChange={(e) => setPct(e.target.value)} suffix="%" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[25, 50, 75, 150, 200].map((p) => (
                      <button key={p} onClick={() => setPct(String(p))} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10">
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {orig && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[1920, 1280, 1080, 800, 512].map((p) => (
                    <button key={p} onClick={() => (setUnit("px"), setLock(true), setW(String(p)), setH(String(Math.round(p / ratio))))} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium transition hover:border-brand-400 hover:text-brand-600 dark:border-white/10">
                      {p}w
                    </button>
                  ))}
                </div>
              )}
              {invalid && orig && (
                <p role="alert" className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">
                  {tooBig ? "That output is too large (over 50 megapixels) to process reliably in a browser." : "Enter a width and height between 1 and 16384 pixels."}
                </p>
              )}
            </Panel>
            <Panel title="Output">
              <Segmented<Fmt> label="Format" value={fmt} onChange={setFmt} options={(["jpeg", "png", "webp"] as Fmt[]).map((f) => ({ value: f, label: FMT_LABEL[f] }))} />
              {fmt !== "png" && (
                <div className="mt-5">
                  <Slider label="Quality" min={30} max={100} value={quality} onChange={setQuality} format={(v) => `${v}%`} />
                </div>
              )}
              {fmt === "png" && <p className="mt-3 text-xs text-slate-500">PNG is lossless — quality is always 100%. Transparency is preserved.</p>}
              {fmt === "jpeg" && <p className="mt-3 text-xs text-slate-500">JPG doesn't support transparency; transparent areas become white.</p>}
            </Panel>
            <Button size="lg" className="w-full sm:w-auto" onClick={resize} disabled={!orig || invalid} icon={<Scaling className="h-5 w-5" />}>
              Resize image
            </Button>
          </Step>
        )}
        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Resizing image" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Resize failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
            <Button variant="outline" onClick={() => proc.reset()}>Change settings</Button>
          </Step>
        )}
        {proc.status === "done" && r && file && orig && (
          <Step k="done">
            <ResultPanel
              title="Your image is ready!"
              subtitle={
                <span className="inline-flex items-center gap-2 tabular-nums">
                  {orig.w} × {orig.h} <ArrowRight className="h-3.5 w-3.5" /> {r.w} × {r.h}
                </span>
              }
              stats={[
                { label: "Original size", value: formatBytes(file.size) },
                { label: "New size", value: formatBytes(r.blob.size), highlight: r.blob.size < file.size },
                { label: "Format", value: FMT_LABEL[fmt] },
              ]}
              onDownload={() => (downloadBlob(r.blob, `${stripExt(file.name)}-${r.w}x${r.h}.${EXT[fmt]}`), toast.success("File downloaded successfully"))}
              downloadLabel="Download image"
              onReset={reset}
            >
              <div className="checker flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <img src={r.url} alt="Resized result" className="max-h-80 w-full object-contain" />
              </div>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
