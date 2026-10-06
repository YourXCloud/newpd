/**
 * Pure layout helpers for the Add URL tool.
 * All coordinates are in PDF points in *display space* (top-left origin, after page rotation),
 * so the live preview and the exported PDF are positioned by exactly the same maths.
 */

export type Where = "bl" | "bc" | "br" | "whole" | "custom";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LinkRule {
  id: string;
  url: string;
  text: string; // optional visible text ("" = none)
  where: Where;
  pages: number[] | "all";
  custom?: Rect; // fractions of the page (0-1), only for where === "custom"
}

export interface Placed {
  ruleId: string;
  rect: Rect; // clickable area in points
  label: string | null; // visible text to draw (null = invisible link)
  textX: number;
  baseline: number;
  textWidth: number;
}

export const FONT_SIZE = 11;
const MARGIN = 24;
const PAD = 4;
const GAP = 4;

export const WHERE_LABEL: Record<Where, string> = {
  bl: "Bottom left",
  bc: "Bottom centre",
  br: "Bottom right",
  whole: "Whole page",
  custom: "Custom area",
};

export function appliesTo(rule: LinkRule, page: number) {
  return rule.pages === "all" || rule.pages.includes(page);
}

export function shortUrl(url: string) {
  return url.replace(/^mailto:/i, "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Cut text with "..." until it fits the available width. */
function fitText(text: string, maxW: number, measure: (s: string) => number) {
  if (measure(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && measure(t + "...") > maxW) t = t.slice(0, -1);
  return t + "...";
}

export function layoutPage(rules: LinkRule[], page: number, W: number, H: number, measure: (s: string) => number): Placed[] {
  const out: Placed[] = [];
  const stack = { bl: 0, bc: 0, br: 0 };

  for (const r of rules) {
    if (!appliesTo(r, page)) continue;

    if (r.where === "whole") {
      out.push({ ruleId: r.id, rect: { x: 0, y: 0, w: W, h: H }, label: null, textX: 0, baseline: 0, textWidth: 0 });
      continue;
    }

    if (r.where === "custom") {
      if (!r.custom) continue;
      const rect = { x: r.custom.x * W, y: r.custom.y * H, w: r.custom.w * W, h: r.custom.h * H };
      if (r.text) {
        const label = fitText(r.text, Math.max(10, rect.w - PAD * 2), measure);
        out.push({ ruleId: r.id, rect, label, textX: rect.x + PAD, baseline: rect.y + rect.h / 2 + FONT_SIZE * 0.35, textWidth: measure(label) });
      } else {
        out.push({ ruleId: r.id, rect, label: null, textX: 0, baseline: 0, textWidth: 0 });
      }
      continue;
    }

    // Bottom placements – show the custom text, or the address itself when no text is given.
    const raw = r.text || shortUrl(r.url);
    const label = fitText(raw, W - MARGIN * 2 - PAD * 2, measure);
    const tw = measure(label);
    const bw = tw + PAD * 2;
    const bh = FONT_SIZE + PAD * 2 + 2;
    const slot = r.where as "bl" | "bc" | "br";
    const x = slot === "bl" ? MARGIN : slot === "bc" ? (W - bw) / 2 : W - MARGIN - bw;
    const y = H - MARGIN - bh - stack[slot] * (bh + GAP);
    stack[slot]++;
    out.push({
      ruleId: r.id,
      rect: { x, y, w: bw, h: bh },
      label,
      textX: x + PAD,
      baseline: y + PAD + FONT_SIZE * 0.8,
      textWidth: tw,
    });
  }
  return out;
}

export function formatPages(pages: number[] | "all"): string {
  if (pages === "all") return "All pages";
  const parts: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    parts.push(j > i ? `${pages[i]}–${pages[j]}` : String(pages[i]));
    i = j + 1;
  }
  return `Page${pages.length > 1 || parts[0].includes("–") ? "s" : ""} ${parts.join(", ")}`;
}
