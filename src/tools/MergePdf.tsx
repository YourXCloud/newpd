import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Combine, GripVertical, X, FileText } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { Panel, ProcessingPanel, ErrorPanel, ResultPanel } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { openPdf, readFile, renderThumbnail, loadPdfLib, PdfPasswordError } from "@/lib/pdf";
import { ACCEPT_PDF, downloadBlob, formatBytes, uid } from "@/lib/utils";
import { findTool } from "@/data/tools";

interface Item {
  id: string;
  file: File;
  thumb?: string;
  pages?: number;
  error?: string;
}

export default function MergePdf() {
  const tool = findTool("merge-pdf")!;
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const proc = useProcessor<{ blob: Blob; pages: number }>();

  const add = (files: File[]) => {
    const fresh = files.map((file) => ({ id: uid(), file }));
    setItems((prev) => [...prev, ...fresh]);
    toast.success(`${files.length} PDF${files.length > 1 ? "s" : ""} added`);
    fresh.forEach(async (it) => {
      try {
        const doc = await openPdf(await readFile(it.file));
        const thumb = await renderThumbnail(doc, 1, 160);
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, thumb, pages: doc.numPages } : p)));
        doc.destroy();
      } catch (e) {
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, error: e instanceof PdfPasswordError ? "Password protected — unlock first" : "Could not read this PDF" } : p)));
      }
    });
  };

  const merge = () => {
    const list = items.filter((i) => !i.error);
    proc.run(async (report) => {
      if (list.length < 2) throw new Error("Add at least two readable PDFs to merge.");
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      out.setProducer("YourX Studio");
      let total = 0;
      for (let i = 0; i < list.length; i++) {
        report((i / list.length) * 90, "Merging documents", `${list[i].file.name} (${i + 1} of ${list.length})`);
        const src = await PDFDocument.load(await readFile(list[i].file), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
        total += pages.length;
      }
      report(95, "Finalizing document");
      const bytes = await out.save({ useObjectStreams: true });
      report(100, "Done");
      return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), pages: total };
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("PDF merged successfully", `${proc.result?.pages} pages combined`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.reset();
    setItems([]);
  };
  const ready = items.filter((i) => !i.error).length >= 2;
  const totalSize = items.reduce((s, i) => s + i.file.size, 0);

  return (
    <ToolLayout tool={tool}>
      <AnimatePresence mode="wait">
        {proc.status === "idle" && (
          <Step k="edit">
            {items.length === 0 ? (
              <Dropzone accept={ACCEPT_PDF} multiple maxSize={200 * 1024 * 1024} onFiles={add} title="Drag & drop your PDFs here" />
            ) : (
              <>
                <Panel title={`${items.length} file${items.length !== 1 ? "s" : ""} · ${formatBytes(totalSize)}`} description="Drag the handle to reorder. Files are merged top to bottom.">
                  <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
                    {items.map((it, idx) => (
                      <Row key={it.id} item={it} index={idx} onRemove={() => setItems(items.filter((x) => x.id !== it.id))} />
                    ))}
                  </Reorder.Group>
                  <div className="mt-3">
                    <Dropzone accept={ACCEPT_PDF} multiple maxSize={200 * 1024 * 1024} onFiles={add} compact title="Add more PDFs" />
                  </div>
                </Panel>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  <Button variant="ghost" onClick={reset} icon={<X className="h-4 w-4" />}>
                    Clear all
                  </Button>
                  <Button size="lg" onClick={merge} disabled={!ready} icon={<Combine className="h-5 w-5" />}>
                    Merge {items.length} PDFs
                  </Button>
                  {!ready && <p className="text-xs text-slate-500">Add at least two PDFs to merge.</p>}
                </div>
              </>
            )}
          </Step>
        )}
        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Merging PDFs" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Merge failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
            <Button variant="outline" onClick={() => proc.reset()}>Back to files</Button>
          </Step>
        )}
        {proc.status === "done" && proc.result && (
          <Step k="done">
            <ResultPanel
              title="Your merged PDF is ready!"
              subtitle={`${items.length} files · ${proc.result.pages} pages · ${formatBytes(proc.result.blob.size)}`}
              onDownload={() => (downloadBlob(proc.result!.blob, "merged.pdf"), toast.success("File downloaded successfully"))}
              downloadLabel="Download merged PDF"
              onReset={reset}
            >
              <ol className="flex flex-wrap gap-2">
                {items.map((it, i) => (
                  <li key={it.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-white/10">
                    <span className="font-bold text-brand-600">{i + 1}</span>
                    <span className="max-w-[160px] truncate">{it.file.name}</span>
                  </li>
                ))}
              </ol>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}

function Row({ item, index, onRemove }: { item: Item; index: number; onRemove: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: "0 20px 40px -12px rgba(79,70,229,0.3)" }}
      className={`relative flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-[#161a27] ${item.error ? "border-rose-300 dark:border-rose-500/30" : "border-slate-200 dark:border-white/10"}`}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag to reorder ${item.file.name}`}
        className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-white/10"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{index + 1}</span>
      <div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
        {item.thumb ? <img src={item.thumb} alt="" className="h-full w-full object-cover object-top" /> : item.error ? <FileText className="h-5 w-5 text-rose-400" /> : <div className="skeleton h-full w-full" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.file.name}</p>
        <p className={`text-xs ${item.error ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}`}>{item.error ?? `${formatBytes(item.file.size)}${item.pages ? ` · ${item.pages} page${item.pages > 1 ? "s" : ""}` : ""}`}</p>
      </div>
      <button onClick={onRemove} aria-label={`Remove ${item.file.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
        <X className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}

