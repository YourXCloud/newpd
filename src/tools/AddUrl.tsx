import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link2, ChevronLeft, ChevronRight, Trash2, Plus, MousePointerSquareDashed, Eraser } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel, InfoNote } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { openPdf, readFile, renderPage, loadPdfLib } from "@/lib/pdf";
import { ACCEPT_PDF, downloadBlob, formatBytes, isValidUrl, normalizeUrl, parsePageSpec, stripExt, uid } from "@/lib/utils";
import { FONT_SIZE, WHERE_LABEL, formatPages, layoutPage, shortUrl, type LinkRule, type Rect, type Where } from "@/lib/linkLayout";
import { findTool } from "@/data/tools";
import { cn } from "@/utils/cn";

const WHERE_OPTIONS: Where[] = ["bl", "bc", "br", "whole", "custom"];
const WHERE_BTN: Record<Where, string> = { bl: "Bottom left", bc: "Bottom centre", br: "Bottom right", whole: "Whole page", custom: "Draw area" };
// Characters the built-in PDF font (Helvetica / WinAnsi) can safely write.
const LATIN = /^[\x20-\x7E\xA0-\xFF]*$/;

interface Output {
  blob: Blob;
  count: number;
  previews: { page: number; img: string; boxes: Rect[] }[];
}

export default function AddUrl() {
  const tool = findTool("add-url")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageImg, setPageImg] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [rules, setRules] = useState<LinkRule[]>([]);

  // form
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pagesInput, setPagesInput] = useState("");
  const [where, setWhere] = useState<Where>("bl");
  const [customRect, setCustomRect] = useState<Rect | null>(null);
  const [customPage, setCustomPage] = useState(1);
  const [errs, setErrs] = useState<{ url?: string; text?: string; pages?: string; custom?: string }>({});

  // drawing
  const [draft, setDraft] = useState<Rect | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef<ArrayBuffer | null>(null);
  const proc = useProcessor<Output>();

  // Text measurement for the live preview (Arial ≈ Helvetica metrics).
  const measure = useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${FONT_SIZE}px Helvetica, Arial, sans-serif`;
    return (s: string) => ctx.measureText(s).width;
  }, []);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    (async () => {
      try {
        bufRef.current = await readFile(file);
        const doc = await openPdf(bufRef.current);
        if (alive) setPages(doc.numPages);
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

  useEffect(() => {
    if (!bufRef.current || !pages) return;
    let alive = true;
    setPageImg(null);
    (async () => {
      const doc = await openPdf(bufRef.current!);
      const pjs = await doc.getPage(page);
      const vp = pjs.getViewport({ scale: 1 });
      const r = await renderPage(doc, page, 1.5, 1800);
      if (alive) {
        setPageImg(r.canvas.toDataURL("image/jpeg", 0.85));
        setDims({ w: vp.width, h: vp.height });
      }
      doc.destroy();
    })().catch(() => alive && toast.error("Could not render this page"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pages]);

  /* ---------- live "pending" rule shown as a dashed preview ---------- */
  const pendingRule = useMemo<LinkRule | null>(() => {
    if (!file || !pages) return null;
    const u = normalizeUrl(url) || "https://example.com";
    const t = text.trim();
    if (!LATIN.test(t)) return null;
    if (where === "custom") return customRect ? { id: "pending", url: u, text: t, where, pages: [customPage], custom: customRect } : null;
    const spec = parsePageSpec(pagesInput, pages);
    if (spec.error) return null;
    return { id: "pending", url: u, text: t, where, pages: spec.pages };
  }, [file, pages, url, text, where, pagesInput, customRect, customPage]);

  const placed = useMemo(
    () => (dims ? layoutPage(pendingRule ? [...rules, pendingRule] : rules, page, dims.w, dims.h, measure) : []),
    [dims, rules, pendingRule, page, measure]
  );

  /* ---------- drawing a custom area ---------- */
  const rel = (e: PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const onDown = (e: PointerEvent) => {
    if (!pageImg || where !== "custom") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = rel(e);
    setDraft({ ...start.current, w: 0, h: 0 });
  };
  const onMove = (e: PointerEvent) => {
    if (!start.current) return;
    const p = rel(e);
    setDraft({ x: Math.min(p.x, start.current.x), y: Math.min(p.y, start.current.y), w: Math.abs(p.x - start.current.x), h: Math.abs(p.y - start.current.y) });
  };
  const onUp = () => {
    if (!start.current) return;
    start.current = null;
    if (draft && draft.w > 0.02 && draft.h > 0.01) {
      setCustomRect(draft);
      setCustomPage(page);
      setErrs((x) => ({ ...x, custom: undefined }));
    }
    setDraft(null);
  };

  /* ---------- add a rule ---------- */
  const addRule = () => {
    const e: typeof errs = {};
    const u = normalizeUrl(url);
    if (!u) e.url = "Enter the web address this link should open.";
    else if (!isValidUrl(u)) e.url = "That doesn't look like a valid address. Try https://example.com or mailto:name@example.com.";
    if (!LATIN.test(text)) e.text = "Link text supports Latin letters, numbers and common symbols only. Use a different text or leave it blank.";
    let pg: number[] | "all" = "all";
    if (where === "custom") {
      if (!customRect) e.custom = "Drag on the page preview to draw the clickable area first.";
      pg = [customPage];
    } else {
      const s = parsePageSpec(pagesInput, pages);
      if (s.error) e.pages = s.error;
      else pg = s.pages;
    }
    setErrs(e);
    if (Object.keys(e).length) return;

    const href = /^[\x20-\x7E]+$/.test(u) ? u : new URL(u).href;
    setRules((r) => [...r, { id: uid(), url: href, text: text.trim(), where, pages: pg, custom: where === "custom" ? customRect! : undefined }]);
    setUrl("");
    setText("");
    setCustomRect(null);
    toast.success("Link added", `${WHERE_LABEL[where]} · ${formatPages(pg)}`);
  };

  /* ---------- build the PDF ---------- */
  const apply = () => {
    if (!file || !bufRef.current) return;
    const list = rules;
    proc.run(async (report) => {
      report(4, "Loading PDF");
      const { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, StandardFonts, rgb, degrees } = await loadPdfLib();
      const pdf = await PDFDocument.load(bufRef.current!, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const doc = await openPdf(bufRef.current!);
      const pdfPages = pdf.getPages();
      const blue = rgb(0.04, 0.28, 0.82);
      const measurePdf = (s: string) => font.widthOfTextAtSize(s, FONT_SIZE);
      const layouts = new Map<number, { W: number; H: number; placed: ReturnType<typeof layoutPage> }>();
      let expected = 0;

      for (let p = 1; p <= pdfPages.length; p++) {
        report(8 + (p / pdfPages.length) * 74, "Adding links", `Page ${p} of ${pdfPages.length}`);
        if (!list.some((r) => r.pages === "all" || r.pages.includes(p))) continue;
        const pjs = await doc.getPage(p);
        const vp = pjs.getViewport({ scale: 1 });
        const rot = ((vp.rotation % 360) + 360) % 360;
        const W = vp.width;
        const H = vp.height;
        const target = pdfPages[p - 1];
        let placedPage: ReturnType<typeof layoutPage>;
        try {
          placedPage = layoutPage(list, p, W, H, measurePdf);
        } catch {
          throw new Error("The link text contains characters that can't be written into a PDF with the built-in font. Use Latin letters, numbers and common symbols, or leave the text blank.");
        }
        layouts.set(p, { W, H, placed: placedPage });

        for (const pl of placedPage) {
          const rule = list.find((r) => r.id === pl.ruleId)!;
          const [ax, ay] = vp.convertToPdfPoint(pl.rect.x, pl.rect.y);
          const [bx, by] = vp.convertToPdfPoint(pl.rect.x + pl.rect.w, pl.rect.y + pl.rect.h);

          if (pl.label) {
            try {
              const [tx, ty] = vp.convertToPdfPoint(pl.textX, pl.baseline);
              target.drawText(pl.label, { x: tx, y: ty, size: FONT_SIZE, font, color: blue, rotate: degrees(rot) });
              const [u1x, u1y] = vp.convertToPdfPoint(pl.textX, pl.baseline + 1.8);
              const [u2x, u2y] = vp.convertToPdfPoint(pl.textX + pl.textWidth, pl.baseline + 1.8);
              target.drawLine({ start: { x: u1x, y: u1y }, end: { x: u2x, y: u2y }, thickness: 0.6, color: blue });
            } catch {
              throw new Error("The link text contains characters that can't be written into a PDF with the built-in font. Use Latin letters, numbers and common symbols, or leave the text blank.");
            }
          }

          const annot = pdf.context.register(
            pdf.context.obj({
              Type: "Annot",
              Subtype: "Link",
              Rect: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)],
              Border: [0, 0, 0],
              F: 4,
              A: { Type: "Action", S: "URI", URI: PDFString.of(rule.url) },
            })
          );
          const existing = target.node.lookup(PDFName.of("Annots"));
          if (existing instanceof PDFArray) existing.push(annot);
          else target.node.set(PDFName.of("Annots"), pdf.context.obj([annot]));
          expected++;
        }
      }
      doc.destroy();

      report(86, "Saving document");
      const bytes = await pdf.save();

      // Verify: reload the exported file and confirm every link annotation is really there.
      report(90, "Verifying links", "Re-reading the exported PDF");
      const countLinks = async (data: ArrayBuffer | Uint8Array) => {
        const chk = await PDFDocument.load(data, { ignoreEncryption: true });
        let n = 0;
        for (const pg of chk.getPages()) {
          const a = pg.node.lookup(PDFName.of("Annots"));
          if (a instanceof PDFArray) {
            for (let i = 0; i < a.size(); i++) {
              const d = a.lookup(i);
              if (d instanceof PDFDict && d.get(PDFName.of("Subtype"))?.toString() === "/Link") n++;
            }
          }
        }
        return n;
      };
      const [before, after] = await Promise.all([countLinks(bufRef.current!), countLinks(bytes)]);
      if (expected === 0) throw new Error("No links were placed. Check the page numbers you selected and try again.");
      if (after - before !== expected) throw new Error("The links could not be verified in the exported file. Please try again, or try a different PDF.");

      report(95, "Building preview");
      const out = await openPdf(bytes.slice().buffer as ArrayBuffer);
      const previews: Output["previews"] = [];
      for (const [pn, l] of Array.from(layouts.entries()).filter(([, v]) => v.placed.length).slice(0, 4)) {
        const r = await renderPage(out, pn, 0.9, 900);
        previews.push({ page: pn, img: r.canvas.toDataURL("image/jpeg", 0.8), boxes: l.placed.map((x) => ({ x: x.rect.x / l.W, y: x.rect.y / l.H, w: x.rect.w / l.W, h: x.rect.h / l.H })) });
      }
      out.destroy();
      report(100, "Done");
      return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), count: expected, previews };
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("Links added successfully", `${proc.result?.count} clickable link(s) embedded`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.reset();
    setFile(null);
    setRules([]);
    setPage(1);
    setPages(0);
    setPageImg(null);
    setDims(null);
    setCustomRect(null);
    setErrs({});
    setUrl("");
    setText("");
    setPagesInput("");
    bufRef.current = null;
  };

  const customActive = where === "custom";
  const labelStyle = (textX: number, baseline: number) =>
    dims
      ? ({ left: `${(textX / dims.w) * 100}%`, top: `${((baseline - FONT_SIZE * 0.85) / dims.h) * 100}%`, fontSize: `${(FONT_SIZE / dims.w) * 100}cqw`, lineHeight: 1 } as const)
      : undefined;

  /* ---------------------------- form (right column) ---------------------------- */
  const form = (
    <Panel title="Link details" description="Insert a clickable web link.">
      <div className="space-y-4">
        <div>
          <Label htmlFor="link-url">Link address</Label>
          <Input
            id="link-url"
            value={url}
            onChange={(e) => (setUrl(e.target.value), setErrs((x) => ({ ...x, url: undefined })))}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="https://example.com"
            inputMode="url"
            autoComplete="off"
            error={errs.url}
          />
        </div>
        <div>
          <Label htmlFor="link-text" hint="Optional">
            Link text
          </Label>
          <Input
            id="link-text"
            value={text}
            onChange={(e) => (setText(e.target.value), setErrs((x) => ({ ...x, text: undefined })))}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="Visit our website"
            maxLength={120}
            error={errs.text}
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {where === "whole" ? "Not shown for “Whole page” — the entire page simply becomes clickable." : where === "custom" ? "Shown inside your drawn area. Leave blank for an invisible link." : "Shown on the page in blue. Leave blank to show the web address."}
          </p>
        </div>
        <div>
          <Label htmlFor="link-pages" hint="Blank = all">
            Pages
          </Label>
          <Input
            id="link-pages"
            value={customActive ? `Page ${customRect ? customPage : page} (drawn area)` : pagesInput}
            onChange={(e) => (setPagesInput(e.target.value), setErrs((x) => ({ ...x, pages: undefined })))}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="all  ·  or e.g. 1, 3-5"
            disabled={customActive}
            error={errs.pages}
          />
        </div>
        <div>
          <Label>Where</Label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where to place the link">
            {WHERE_OPTIONS.map((w) => {
              const on = where === w;
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => (setWhere(w), setErrs((x) => ({ ...x, custom: undefined })))}
                  className={cn(
                    "flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all",
                    w === "custom" && "col-span-2",
                    on
                      ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
                      : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20"
                  )}
                >
                  {w === "custom" && <MousePointerSquareDashed className="h-4 w-4" />}
                  {WHERE_BTN[w]}
                </button>
              );
            })}
          </div>
          {customActive && (
            <div className="mt-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 text-xs leading-relaxed text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
              {customRect ? (
                <div className="flex items-center justify-between gap-2">
                  <span>✓ Area drawn on page {customPage}. Drag again to redraw.</span>
                  <button type="button" onClick={() => setCustomRect(null)} className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
              ) : (
                "Drag on the page preview to draw the clickable area."
              )}
            </div>
          )}
          {errs.custom && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {errs.custom}
            </p>
          )}
        </div>
        <Button className="w-full" onClick={addRule} disabled={!file || !pages} icon={<Plus className="h-4 w-4" />}>
          Add link
        </Button>
        {!file && <p className="text-center text-xs text-slate-500 dark:text-slate-400">Upload a PDF to start adding links.</p>}
      </div>
    </Panel>
  );

  return (
    <ToolLayout tool={tool} aside={proc.status === "idle" && form}>
      <AnimatePresence>
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_PDF} maxSize={150 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("PDF uploaded successfully", f[0].name))} />
            <InfoNote>Links are added as real, clickable PDF link annotations that work in every PDF viewer. If you enter link text, it is also written onto the page in blue so people can see it.</InfoNote>
          </Step>
        )}

        {file && proc.status === "idle" && (
          <Step k="edit">
            <FileCard name={file.name} size={file.size} meta={pages ? `${pages} page${pages > 1 ? "s" : ""}` : "Reading…"} onRemove={reset} />

            <Panel>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {customActive ? "Drag on the page to draw the clickable area." : "Live preview — dashed outline shows where your link will go."}
                </p>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[80px] text-center text-sm font-medium tabular-nums">
                    {page} / {pages || "–"}
                  </span>
                  <Button size="icon" variant="outline" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mx-auto max-w-xl">
                <div
                  ref={stageRef}
                  className={cn("relative select-none overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-white/10", customActive && "touch-none")}
                  style={{ cursor: customActive ? "crosshair" : "default", containerType: "inline-size" }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  {pageImg ? <img src={pageImg} alt={`Page ${page}`} className="pointer-events-none block w-full" draggable={false} /> : <div className="skeleton aspect-[3/4] w-full" />}

                  {dims &&
                    placed.map((p) => {
                      const pending = p.ruleId === "pending";
                      const whole = p.rect.w >= dims.w - 1 && p.rect.h >= dims.h - 1;
                      return (
                        <div key={p.ruleId} className="pointer-events-none">
                          <div
                            className={cn("absolute rounded-[3px] border-2", pending ? "border-dashed border-brand-500 bg-brand-400/15" : "border-emerald-500 bg-emerald-400/15")}
                            style={{ left: `${(p.rect.x / dims.w) * 100}%`, top: `${(p.rect.y / dims.h) * 100}%`, width: `${(p.rect.w / dims.w) * 100}%`, height: `${(p.rect.h / dims.h) * 100}%` }}
                          >
                            {whole && (
                              <span className={cn("absolute left-2 top-2 max-w-[80%] truncate rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", pending ? "bg-brand-600" : "bg-emerald-600")}>
                                Whole page → {shortUrl(rules.find((r) => r.id === p.ruleId)?.url ?? (url || "example.com"))}
                              </span>
                            )}
                          </div>
                          {p.label && (
                            <span className="absolute whitespace-nowrap font-sans text-[#0a47d1] underline" style={labelStyle(p.textX, p.baseline)}>
                              {p.label}
                            </span>
                          )}
                        </div>
                      );
                    })}

                  {draft && (
                    <div className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-brand-500 bg-brand-400/20" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />
                  )}
                </div>
              </div>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border-2 border-dashed border-brand-500" /> Not added yet
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-400/30" /> Added
                </span>
              </p>
            </Panel>

            <Panel title={`Links to add (${rules.length})`} description="These will be embedded when you create the PDF.">
              {rules.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No links yet. Fill in the form and press <strong>Add link</strong>.
                  {url.trim() && <span className="mt-1 block font-medium text-amber-700 dark:text-amber-300">You've typed an address — press “Add link” to include it.</span>}
                </p>
              ) : (
                <ul className="space-y-2">
                  {rules.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <Link2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={r.url}>
                          {r.text || shortUrl(r.url)}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={r.url}>
                          {r.text ? `${shortUrl(r.url)} · ` : ""}
                          {WHERE_LABEL[r.where]} · {formatPages(r.pages)}
                        </p>
                      </div>
                      {Array.isArray(r.pages) && (
                        <button onClick={() => setPage((r.pages as number[])[0])} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15" aria-label={`Preview page ${(r.pages as number[])[0]}`}>
                          View
                        </button>
                      )}
                      <button onClick={() => setRules(rules.filter((x) => x.id !== r.id))} aria-label="Remove link" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Button size="lg" className="w-full sm:w-auto" onClick={apply} disabled={rules.length === 0} icon={<Link2 className="h-5 w-5" />}>
              Create PDF with {rules.length || ""} link{rules.length !== 1 ? "s" : ""}
            </Button>
          </Step>
        )}

        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Embedding links" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Could not add links" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
            <Button variant="outline" onClick={() => proc.reset()}>
              Back to editor
            </Button>
          </Step>
        )}
        {proc.status === "done" && proc.result && file && (
          <Step k="done">
            <ResultPanel
              title="Links added!"
              subtitle={`${proc.result.count} clickable link${proc.result.count !== 1 ? "s" : ""} added and verified · ${formatBytes(proc.result.blob.size)}`}
              onDownload={() => (downloadBlob(proc.result!.blob, `${stripExt(file.name)}-linked.pdf`), toast.success("File downloaded successfully"))}
              downloadLabel="Download PDF"
              onReset={reset}
              extraActions={
                <Button variant="outline" onClick={() => proc.reset()}>
                  Edit links
                </Button>
              }
            >
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {proc.result.previews.map((p) => (
                  <figure key={p.page} className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                    <img src={p.img} alt={`Result preview of page ${p.page}`} className="block w-full" />
                    {p.boxes.map((b, i) => (
                      <span key={i} className="absolute rounded-sm border-2 border-emerald-500 bg-emerald-400/20" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
                    ))}
                    <figcaption className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">p.{p.page}</figcaption>
                  </figure>
                ))}
              </div>
              <ul className="space-y-1.5 text-sm">
                {rules.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600 dark:text-slate-400">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-white/10">{formatPages(r.pages)}</span>
                    <span className="text-xs">{WHERE_LABEL[r.where]}</span>
                    <span className="min-w-0 truncate">{r.text ? `${r.text} → ` : ""}{r.url}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Green boxes in the preview mark the clickable areas. Open the downloaded PDF and click the link text to test it.</p>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
