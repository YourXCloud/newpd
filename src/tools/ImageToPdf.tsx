import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { Images, RotateCw, X, ArrowLeft, ArrowRight } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { Panel, ProcessingPanel, ErrorPanel, ResultPanel } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Segmented, Slider, Select, Label } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { loadPdfLib } from "@/lib/pdf";
import { ACCEPT_IMAGES, canvasToBlob, downloadBlob, formatBytes, loadImage, nextFrame, uid } from "@/lib/utils";
import { findTool } from "@/data/tools";

interface Img {
  id: string;
  file: File;
  url: string;
  rotation: 0 | 90 | 180 | 270;
  w?: number;
  h?: number;
}

const PAGE_SIZES: Record<string, [number, number] | null> = {
  fit: null,
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a5: [419.53, 595.28],
  a3: [841.89, 1190.55],
};
const SIZE_LABEL: Record<string, string> = { fit: "Fit to image", a4: "A4", letter: "US Letter", legal: "US Legal", a5: "A5", a3: "A3" };

export default function ImageToPdf() {
  const tool = findTool("image-to-pdf")!;
  const toast = useToast();
  const [imgs, setImgs] = useState<Img[]>([]);
  const [size, setSize] = useState("a4");
  const [orient, setOrient] = useState<"auto" | "portrait" | "landscape">("auto");
  const [margin, setMargin] = useState(24);
  const [fit, setFit] = useState<"contain" | "cover" | "stretch">("contain");
  const [quality, setQuality] = useState(90);
  const proc = useProcessor<{ blob: Blob; pages: number }>();

  const add = (files: File[]) => {
    const fresh: Img[] = files.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file), rotation: 0 }));
    setImgs((p) => [...p, ...fresh]);
    toast.success(`${files.length} image${files.length > 1 ? "s" : ""} added`);
    fresh.forEach(async (im) => {
      try {
        const el = await loadImage(im.url);
        setImgs((p) => p.map((x) => (x.id === im.id ? { ...x, w: el.naturalWidth, h: el.naturalHeight } : x)));
      } catch {
        toast.error("Could not decode image", im.file.name);
        setImgs((p) => p.filter((x) => x.id !== im.id));
      }
    });
  };

  useEffect(() => () => imgs.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (id: string) => {
    const it = imgs.find((i) => i.id === id);
    if (it) URL.revokeObjectURL(it.url);
    setImgs(imgs.filter((i) => i.id !== id));
  };
  const rotate = (id: string) => setImgs(imgs.map((i) => (i.id === id ? { ...i, rotation: ((i.rotation + 90) % 360) as Img["rotation"] } : i)));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= imgs.length) return;
    const n = [...imgs];
    [n[idx], n[j]] = [n[j], n[idx]];
    setImgs(n);
  };

  const generate = () => {
    proc.run(async (report) => {
      if (imgs.length === 0) throw new Error("Add at least one image.");
      const { PDFDocument } = await loadPdfLib();
      const pdf = await PDFDocument.create();
      pdf.setProducer("YourX Studio");
      for (let i = 0; i < imgs.length; i++) {
        const im = imgs[i];
        report((i / imgs.length) * 92, "Placing images", `${im.file.name} (${i + 1} of ${imgs.length})`);
        const el = await loadImage(im.url);
        // Draw rotated (and re-encode non-JPEG/PNG types such as WEBP)
        const rot = im.rotation;
        const sw = el.naturalWidth, sh = el.naturalHeight;
        const cw = rot % 180 ? sh : sw, ch = rot % 180 ? sw : sh;
        const max = 4000;
        const s = Math.min(1, max / Math.max(cw, ch));
        const c = document.createElement("canvas");
        c.width = Math.round(cw * s);
        c.height = Math.round(ch * s);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(el, (-sw * s) / 2, (-sh * s) / 2, sw * s, sh * s);
        const isPng = im.file.type === "image/png";
        const blob = await canvasToBlob(c, isPng ? "image/png" : "image/jpeg", isPng ? undefined : quality / 100);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        c.width = 0;

        const iw = embedded.width, ih = embedded.height;
        let pw: number, ph: number;
        const preset = PAGE_SIZES[size];
        if (!preset) {
          pw = iw + margin * 2;
          ph = ih + margin * 2;
        } else {
          const landscape = orient === "landscape" || (orient === "auto" && iw > ih);
          [pw, ph] = landscape ? [preset[1], preset[0]] : preset;
        }
        const page = pdf.addPage([pw, ph]);
        const bw = pw - margin * 2, bh = ph - margin * 2;
        let dw = bw, dh = bh;
        if (fit !== "stretch") {
          const r = fit === "contain" ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
          dw = iw * r;
          dh = ih * r;
        }
        const x = margin + (bw - dw) / 2, y = margin + (bh - dh) / 2;
        if (fit === "cover") {
          // Clip to the content box when covering
          const { pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = await loadPdfLib();
          page.pushOperators(pushGraphicsState(), rectangle(margin, margin, bw, bh), clip(), endPath());
          page.drawImage(embedded, { x, y, width: dw, height: dh });
          page.pushOperators(popGraphicsState());
        } else {
          page.drawImage(embedded, { x, y, width: dw, height: dh });
        }
        await nextFrame();
      }
      report(96, "Finalizing document");
      const bytes = await pdf.save({ useObjectStreams: true });
      report(100, "Done");
      return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), pages: imgs.length };
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("PDF created successfully", `${proc.result?.pages} page(s)`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.reset();
    imgs.forEach((i) => URL.revokeObjectURL(i.url));
    setImgs([]);
  };

  return (
    <ToolLayout
      tool={tool}
      aside={
        imgs.length > 0 &&
        proc.status === "idle" && (
          <Panel title="Page setup">
            <div className="space-y-5">
              <div>
                <Label htmlFor="size">Page size</Label>
                <Select id="size" value={size} onChange={(e) => setSize(e.target.value)}>
                  {Object.keys(PAGE_SIZES).map((k) => (
                    <option key={k} value={k}>
                      {SIZE_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </div>
              {size !== "fit" && <Segmented label="Orientation" value={orient} onChange={setOrient} options={[{ value: "auto", label: "Auto" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />}
              <Slider label="Margins" min={0} max={72} step={4} value={margin} onChange={setMargin} format={(v) => `${v} pt`} />
              {size !== "fit" && <Segmented label="Image fit" value={fit} onChange={setFit} options={[{ value: "contain", label: "Fit" }, { value: "cover", label: "Fill" }, { value: "stretch", label: "Stretch" }]} />}
              <Slider label="JPEG quality" min={50} max={100} value={quality} onChange={setQuality} format={(v) => `${v}%`} />
              <Button className="w-full" size="lg" onClick={generate} icon={<Images className="h-5 w-5" />}>
                Generate PDF
              </Button>
            </div>
          </Panel>
        )
      }
    >
      <AnimatePresence mode="wait">
        {proc.status === "idle" && (
          <Step k="edit">
            {imgs.length === 0 ? (
              <Dropzone accept={ACCEPT_IMAGES} multiple maxSize={50 * 1024 * 1024} onFiles={add} title="Drag & drop your images here" />
            ) : (
              <Panel title={`${imgs.length} image${imgs.length !== 1 ? "s" : ""}`} description="Drag thumbnails to reorder. Use the buttons to rotate or remove.">
                <Reorder.Group axis="y" values={imgs} onReorder={setImgs} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" as="ul">
                  {imgs.map((im, idx) => (
                    <Reorder.Item key={im.id} value={im} whileDrag={{ scale: 1.05, zIndex: 10, boxShadow: "0 20px 40px -12px rgba(79,70,229,0.35)" }} className="group relative cursor-grab rounded-xl border border-slate-200 bg-white p-2 active:cursor-grabbing dark:border-white/10 dark:bg-[#161a27]">
                      <div className="checker flex aspect-square items-center justify-center overflow-hidden rounded-lg">
                        <img src={im.url} alt={im.file.name} draggable={false} className="max-h-full max-w-full object-contain transition-transform duration-300" style={{ transform: `rotate(${im.rotation}deg)` }} />
                      </div>
                      <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-[11px] font-bold text-white">{idx + 1}</span>
                      <p className="mt-2 truncate text-xs font-medium" title={im.file.name}>
                        {im.file.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {im.w ? `${im.w}×${im.h} · ` : ""}
                        {formatBytes(im.file.size)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <div className="flex gap-1">
                          <IconBtn label="Move left" onClick={() => move(idx, -1)} disabled={idx === 0}>
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn label="Move right" onClick={() => move(idx, 1)} disabled={idx === imgs.length - 1}>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn label="Rotate 90°" onClick={() => rotate(im.id)}>
                            <RotateCw className="h-3.5 w-3.5" />
                          </IconBtn>
                        </div>
                        <IconBtn label="Remove" onClick={() => remove(im.id)} danger>
                          <X className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
                <div className="mt-4">
                  <Dropzone accept={ACCEPT_IMAGES} multiple maxSize={50 * 1024 * 1024} onFiles={add} compact title="Add more images" />
                </div>
              </Panel>
            )}
          </Step>
        )}
        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Building PDF" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Could not create PDF" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
            <Button variant="outline" onClick={() => proc.reset()}>Back to images</Button>
          </Step>
        )}
        {proc.status === "done" && proc.result && (
          <Step k="done">
            <ResultPanel
              title="Your PDF is ready!"
              subtitle={`${proc.result.pages} page${proc.result.pages !== 1 ? "s" : ""} · ${SIZE_LABEL[size]} · ${formatBytes(proc.result.blob.size)}`}
              onDownload={() => (downloadBlob(proc.result!.blob, "images.pdf"), toast.success("File downloaded successfully"))}
              downloadLabel="Download PDF"
              onReset={reset}
            >
              <div className="flex flex-wrap gap-2">
                {imgs.slice(0, 12).map((im) => (
                  <img key={im.id} src={im.url} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover dark:border-white/10" style={{ transform: `rotate(${im.rotation}deg)` }} />
                ))}
              </div>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-30 ${danger ? "border-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" : "border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-white/10 dark:text-slate-300"}`}
    >
      {children}
    </button>
  );
}
