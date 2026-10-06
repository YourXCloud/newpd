import { useEffect, useState } from "react";
import { Unlink, CheckSquare, Square, Link2, Type } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel, InfoNote } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { openPdf, readFile, renderPage, loadPdfLib } from "@/lib/pdf";
import { ACCEPT_PDF, downloadBlob, formatBytes, stripExt } from "@/lib/utils";
import { findTool } from "@/data/tools";
import { cn } from "@/utils/cn";

interface Detected {
  id: string; // `${page}:${index}`
  page: number;
  index: number; // index in Annots array
  target: string;
  rect: [number, number, number, number]; // fractions (x,y,w,h) top-left origin
}

export default function RemoveUrl() {
  const tool = findTool("remove-url")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [scanning, setScanning] = useState(false);
  const [links, setLinks] = useState<Detected[]>([]);
  const [textUrls, setTextUrls] = useState<{ page: number; text: string }[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState(0);
  const proc = useProcessor<Blob>();

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setScanning(true);
    (async () => {
      try {
        const data = await readFile(file);
        setBuf(data);
        const { PDFDocument, PDFName, PDFArray, PDFDict, PDFString, PDFHexString } = await loadPdfLib();
        const pdf = await PDFDocument.load(data, { ignoreEncryption: true });
        const doc = await openPdf(data);
        setPages(doc.numPages);
        const found: Detected[] = [];
        const texts: { page: number; text: string }[] = [];
        const th: Record<number, string> = {};
        const pdfPages = pdf.getPages();
        for (let p = 0; p < pdfPages.length; p++) {
          const node = pdfPages[p].node;
          const annots = node.lookup(PDFName.of("Annots"));
          const pjs = await doc.getPage(p + 1);
          const vp = pjs.getViewport({ scale: 1 });
          if (annots instanceof PDFArray) {
            for (let i = 0; i < annots.size(); i++) {
              const a = annots.lookup(i);
              if (!(a instanceof PDFDict)) continue;
              const sub = a.get(PDFName.of("Subtype"));
              if (sub?.toString() !== "/Link") continue;
              let target = "Internal link / page destination";
              const action = a.lookup(PDFName.of("A"));
              if (action instanceof PDFDict) {
                const uri = action.lookup(PDFName.of("URI"));
                if (uri instanceof PDFString || uri instanceof PDFHexString) target = uri.decodeText();
                else {
                  const s = action.get(PDFName.of("S"))?.toString();
                  if (s === "/GoTo") target = "Internal link (GoTo)";
                  else if (s) target = `Action ${s}`;
                }
              }
              const rectArr = a.lookup(PDFName.of("Rect"));
              let rect: Detected["rect"] = [0, 0, 0, 0];
              if (rectArr instanceof PDFArray && rectArr.size() === 4) {
                const nums = rectArr.asArray().map((n) => Number((n as { asNumber?: () => number }).asNumber?.() ?? 0));
                const [vx1, vy1, vx2, vy2] = vp.convertToViewportRectangle(nums as [number, number, number, number]);
                rect = [Math.min(vx1, vx2) / vp.width, Math.min(vy1, vy2) / vp.height, Math.abs(vx2 - vx1) / vp.width, Math.abs(vy2 - vy1) / vp.height];
              }
              found.push({ id: `${p + 1}:${i}`, page: p + 1, index: i, target, rect });
            }
          }
          // Visible URL-looking text (informational only)
          try {
            const tc = await pjs.getTextContent();
            const str = tc.items.map((it) => ("str" in it ? it.str : "")).join(" ");
            const matches = str.match(/\b((https?:\/\/|www\.)[^\s)\]]+)/gi);
            matches?.forEach((m) => texts.push({ page: p + 1, text: m }));
          } catch {}
          if (found.some((f) => f.page === p + 1) && !th[p + 1]) {
            const r = await renderPage(doc, p + 1, 0.6, 700);
            th[p + 1] = r.canvas.toDataURL("image/jpeg", 0.75);
          }
        }
        doc.destroy();
        if (!alive) return;
        setLinks(found);
        setTextUrls(texts);
        setThumbs(th);
        setSelected(new Set(found.map((f) => f.id)));
        if (found.length === 0) toast.info("No link annotations found", "This PDF has no clickable hyperlinks to remove.");
        else toast.success(`${found.length} link${found.length > 1 ? "s" : ""} detected`);
      } catch (e) {
        toast.error("Could not scan PDF", e instanceof Error ? e.message : undefined);
        setFile(null);
      } finally {
        if (alive) setScanning(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const remove = () => {
    if (!buf) return;
    proc.run(async (report) => {
      report(10, "Loading PDF");
      const { PDFDocument, PDFName, PDFArray } = await loadPdfLib();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const byPage = new Map<number, Set<number>>();
      links.filter((l) => selected.has(l.id)).forEach((l) => byPage.set(l.page, (byPage.get(l.page) ?? new Set()).add(l.index)));
      const pdfPages = pdf.getPages();
      let k = 0;
      for (const [pageNo, idxs] of byPage) {
        report(20 + (k++ / byPage.size) * 70, "Removing links", `Page ${pageNo}`);
        const node = pdfPages[pageNo - 1].node;
        const annots = node.lookup(PDFName.of("Annots"));
        if (!(annots instanceof PDFArray)) continue;
        const keep = annots.asArray().filter((_, i) => !idxs.has(i));
        if (keep.length) node.set(PDFName.of("Annots"), pdf.context.obj(keep));
        else node.delete(PDFName.of("Annots"));
      }
      report(95, "Saving document");
      const bytes = await pdf.save();
      report(100, "Done");
      return new Blob([bytes as BlobPart], { type: "application/pdf" });
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("Links removed successfully", `${selected.size} link(s) removed`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.reset();
    setFile(null);
    setBuf(null);
    setLinks([]);
    setTextUrls([]);
    setThumbs({});
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const all = selected.size === links.length && links.length > 0;
  const pagesWithLinks = Array.from(new Set(links.map((l) => l.page)));

  return (
    <ToolLayout tool={tool}>
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_PDF} maxSize={150 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("PDF uploaded successfully", f[0].name))} />
            <InfoNote>
              <strong>What this tool removes:</strong> PDF <em>link annotations</em> — the invisible clickable areas. Visible URL text printed on the page is part of the page content and is <strong>not</strong> removed; it just stops being clickable.
            </InfoNote>
          </Step>
        )}

        {file && proc.status === "idle" && (
          <Step k="review">
            <FileCard name={file.name} size={file.size} meta={scanning ? "Scanning for links…" : `${pages} pages · ${links.length} link annotation${links.length !== 1 ? "s" : ""}`} onRemove={reset} />

            {scanning ? (
              <Panel>
                <div className="space-y-3" aria-busy>
                  <div className="skeleton h-12" />
                  <div className="skeleton h-12" />
                  <div className="skeleton h-12 w-2/3" />
                </div>
              </Panel>
            ) : (
              <>
                <Panel title="Hyperlink annotations" description="Select which clickable links to remove.">
                  {links.length === 0 ? (
                    <p className="text-sm text-slate-500">No link annotations were found in this document.</p>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs text-slate-500">{selected.size} of {links.length} selected</p>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(all ? new Set() : new Set(links.map((l) => l.id)))} icon={all ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}>
                          {all ? "Deselect all" : "Select all"}
                        </Button>
                      </div>
                      <ul className="max-h-80 space-y-2 overflow-auto pr-1">
                        {links.map((l) => {
                          const on = selected.has(l.id);
                          return (
                            <li key={l.id}>
                              <button
                                onClick={() => toggle(l.id)}
                                aria-pressed={on}
                                className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", on ? "border-rose-300 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10" : "border-slate-200 dark:border-white/10")}
                              >
                                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300 dark:border-white/20")}>{on && <CheckSquare className="h-3.5 w-3.5" />}</span>
                                <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">{l.target}</span>
                                  <span className="block text-xs text-slate-500">Page {l.page}</span>
                                </span>
                                {on && <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">Remove</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </Panel>

                {pagesWithLinks.length > 0 && (
                  <Panel title="Preview" description="Red areas will be removed; grey ones are kept.">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {pagesWithLinks.slice(0, 8).map((p) => (
                        <div key={p} className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                          <img src={thumbs[p]} alt={`Page ${p}`} className="block w-full" />
                          {links
                            .filter((l) => l.page === p)
                            .map((l) => (
                              <span key={l.id} className={cn("absolute border-2", selected.has(l.id) ? "border-rose-500 bg-rose-500/25" : "border-slate-400 bg-slate-400/20")} style={{ left: `${l.rect[0] * 100}%`, top: `${l.rect[1] * 100}%`, width: `${l.rect[2] * 100}%`, height: `${l.rect[3] * 100}%` }} />
                            ))}
                          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">p.{p}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {textUrls.length > 0 && (
                  <Panel title="Visible URL text (not removable)" description="These URLs appear as printed text. They are page content, not annotations, and will remain visible.">
                    <ul className="max-h-40 space-y-1 overflow-auto text-sm">
                      {textUrls.slice(0, 30).map((t, i) => (
                        <li key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Type className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="rounded bg-slate-100 px-1.5 text-xs dark:bg-white/10">p.{t.page}</span>
                          <span className="truncate">{t.text}</span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}

                <Button size="lg" variant="danger" className="w-full sm:w-auto" onClick={remove} disabled={selected.size === 0} icon={<Unlink className="h-5 w-5" />}>
                  Remove {selected.size} link{selected.size !== 1 && "s"}
                </Button>
              </>
            )}
          </Step>
        )}

        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Removing links" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Could not remove links" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
          </Step>
        )}
        {proc.status === "done" && proc.result && file && (
          <Step k="done">
            <ResultPanel
              title="Links removed!"
              subtitle={`${selected.size} link annotation${selected.size !== 1 ? "s" : ""} removed · ${formatBytes(proc.result.size)}`}
              onDownload={() => (downloadBlob(proc.result!, `${stripExt(file.name)}-nolinks.pdf`), toast.success("File downloaded successfully"))}
              downloadLabel="Download cleaned PDF"
              onReset={reset}
            />
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
