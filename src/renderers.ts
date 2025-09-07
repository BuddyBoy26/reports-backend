/* eslint-disable @typescript-eslint/ban-types */
import type { Cfg, Col, Report } from "./schema.js";

/* ---------- Utilities ---------- */
const esc = (v: unknown) =>
  v == null
    ? ""
    : String(v)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const tw = (...cs: (string | undefined | null | false)[]) =>
  cs.filter(Boolean).join(" ");

const alignFlex = (a: "left" | "center" | "right") =>
  a === "left" ? "justify-start" : a === "center" ? "justify-center" : "justify-end";

const dateFmt = (iso?: string) => {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const s = iso.slice(0, 10);
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return esc(iso);
  const map = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
               "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${
    map[d.getMonth()]
  } ${d.getFullYear()}`;
};

/* ---------- Block renderers ---------- */
const headerBlock = (p: any, s: any) => `
<section class="${tw("mb-3", s?.wrapper)}">
  <h1 class="${tw("text-2xl font-bold text-slate-800", s?.title)}">${esc(p.text)}</h1>
</section>`;

const subheaderBlock = (p: any, s: any) => `
<section class="${tw("mb-2", s?.wrapper)}">
  <h2 class="${tw("text-xl font-semibold text-slate-700", s?.title)}">${esc(p.text)}</h2>
</section>`;

const dateBlock = (p: any, s: any, cfg: Cfg) => `
<section class="${tw(
  "mb-2 flex",
  alignFlex(cfg.date.align),
  s?.wrapper
)}">
  <div class="${tw("text-sm text-slate-600", s?.text)}">${esc(dateFmt(p.value))}</div>
</section>`;

const paraBlock = (p: any, s: any) => `
<section class="${tw("mb-3", s?.wrapper)}">
  <p class="${tw("text-justify", s?.text)}">${esc(p.text)}</p>
</section>`;

const dividerBlock = (col: Col, s: any) => `
<hr class="${tw("my-4", s?.hr)}" style="border-color:${col.border}"/>`;

const spacerBlock = (p: any, s: any) => {
  const m: Record<string, string> = {
    xs: "h-2",
    sm: "h-4",
    md: "h-8",
    lg: "h-12",
    xl: "h-20"
  };
  return `<div class="${tw(m[p.size || "md"], s?.wrapper)}"></div>`;
};

const pagebreakBlock = () => `<div class="pagebreak"></div>`;

const signatureBlock = (p: any, s: any, col: Col) => {
  const n = Math.max(1, Math.min(5, p.lines ?? 1));
  const lines = Array.from({ length: n })
    .map(
      () =>
        `<div class="border-b" style="border-color:${col.border};height:2rem;"></div>`
    )
    .join("");
  return `
<section class="${tw("mt-8", s?.wrapper)}">
  <div class="flex flex-col gap-6 w-64">
    ${lines}
    <div class="${tw("text-sm text-slate-600", s?.label)}">${esc(
      p.label || ""
    )}</div>
  </div>
</section>`;
};

const footerTextBlock = (p: any, s: any) => `
<section class="${tw(
  "mt-8 text-center text-sm text-slate-600",
  s?.text
)}">${esc(p.text)}</section>`;

const tableBlock = (p: any, s: any, cfg: Cfg, col: Col) => {
  const title = p.title
    ? `<div class="${tw(
        "mb-2 font-semibold text-slate-800",
        s?.title
      )}">${esc(p.title)}</div>`
    : "";
  const compact = cfg.table.compact ? "py-1 px-2 text-sm" : "py-2 px-3";
  const theadClass = tw(s?.thead, cfg.table.headerBg);
  const thead = (p.headers || [])
    .map(
      (h: string) =>
        `<th class="${compact} border-b font-semibold text-left" style="border-color:${col.border}">${esc(
          h
        )}</th>`
    )
    .join("");
  const body = (p.rows || [])
    .map((row: any[], i: number) => {
      const bg = cfg.table.striped && i % 2 === 1 ? "bg-gray-50" : "";
      const tds = row
        .map(
          (c: any) =>
            `<td class="${compact} border-b" style="border-color:${col.border}">${esc(
              c
            )}</td>`
        )
        .join("");
      return `<tr class="${bg}">${tds}</tr>`;
    })
    .join("");
  const notes = p.notes
    ? `<div class="mt-2 text-xs text-slate-500">${esc(p.notes)}</div>`
    : "";

  return `
<section class="${tw("my-4", s?.wrapper)}">
  ${title}
  <div class="${tw("tbl-wrap overflow-x-auto", s?.container)}">
    <table class="${tw(
      "tbl w-full border-collapse",
      cfg.table.border
    )}" style="border-color:${col.border}">
      <thead class="${theadClass}">
        ${thead ? `<tr>${thead}</tr>` : ""}
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  ${notes}
</section>`;
};

const imageBlock = (p: any, s: any) => {
  const sz: string[] = [];
  if (p.width) sz.push(`width:${p.width};`);
  if (p.height) sz.push(`height:${p.height};`);
  const cap = p.caption
    ? `<div class="${tw(
        "text-xs text-slate-500 mt-1 text-center",
        s?.caption
      )}">${esc(p.caption)}</div>`
    : "";
  return `
<section class="${tw("my-4", s?.wrapper)}">
  <img src="${esc(p.url)}" alt="${esc(p.alt || "")}"
       class="${tw("max-w-full mx-auto", s?.img)}"
       style="${sz.join("")}"/>
  ${cap}
</section>`;
};

/* ---------- Renderers ---------- */
export const renderBody = (r: Report) => {
  /* first-page header (repeat === 'first') */
  const firstHeader =
    r.configs.header.visible && r.configs.header.repeat === "first"
      ? `<section class="mb-6 border-b pb-3" style="border-color:${r.colors.border}">
           <div class="flex items-center ${"justify-" + r.configs.header.align}">
             ${
               r.assets.logo
                 ? `<img src="${r.assets.logo}" alt="logo" class="h-8 mr-3"/>`
                 : ""
             }
             ${
               r.assets.headerImage
                 ? `<img src="${r.assets.headerImage}" alt="header" class="h-10"/>`
                 : `<div class="text-xl font-semibold">${escapeHtml(
                     r.reportName
                   )}</div>`
             }
           </div>
         </section>`
      : "";

  /* main content blocks */
  const parts = r.components
    .map((c) => {
      switch (c.type) {
        case "header":
          return headerBlock((c as any).props, c.style);
        case "subheader":
          return subheaderBlock((c as any).props, c.style);
        case "date":
          return dateBlock((c as any).props, c.style, r.configs);
        case "para":
          return paraBlock((c as any).props, c.style);
        case "divider":
          return dividerBlock(r.colors, c.style);
        case "spacer":
          return spacerBlock((c as any).props, c.style);
        case "pagebreak":
          return pagebreakBlock();
        case "signature":
          return signatureBlock((c as any).props, c.style, r.colors);
        case "footerText":
          return footerTextBlock((c as any).props, c.style);
        case "table":
          return tableBlock((c as any).props, c.style, r.configs, r.colors);
        case "image":
          return imageBlock((c as any).props, c.style);
        default:
          return "";
      }
    })
    .join("");

  /* fixed header (repeat === 'all') */
  const fixedHeader =
    r.configs.header.visible && r.configs.header.repeat === "all"
      ? `<header class="fixed-header border-b" style="border-color:${r.colors.border}">
           <div class="flex items-center ${"justify-" + r.configs.header.align} h-full px-4">
             ${
               r.assets.logo
                 ? `<img src="${r.assets.logo}" alt="logo" class="h-8 mr-3"/>`
                 : ""
             }
             ${
               r.assets.headerImage
                 ? `<img src="${r.assets.headerImage}" alt="header" class="h-10"/>`
                 : `<div class="font-semibold">${escapeHtml(r.reportName)}</div>`
             }
           </div>
         </header>`
      : "";

  /* fixed footer */
  const fixedFooter = r.configs.footer.visible
    ? `<footer class="fixed-footer border-t px-4" style="border-color:${r.colors.border}">
         ${
           r.assets.footerImage
             ? `<img src="${r.assets.footerImage}" alt="footer" class="h-6 mr-2"/>`
             : ""
         }
         <span class="text-sm text-gray-600">${
           r.configs.footer.text.replace("{{page}}", "").replace("{{pages}}", "")
         }</span>
       </footer>`
    : "";

  /* background layer */
  const pageBg = r.assets.backgroundImage ? `<div class="page-bg"></div>` : "";

  const main = `
<main class="prose max-w-none text-[0] body-wrap">
  <div class="text-[inherit] ${r.configs.font.base} ${r.configs.font.leading}"
       style="font-family:${r.configs.font.family}">
    ${firstHeader}${parts}
  </div>
</main>`;

  return `${pageBg}${fixedHeader}${main}${fixedFooter}`;
};

export const renderHead = (r: Report) => `
<style>
:root{
  --color-text:${r.colors.text};
  --color-border:${r.colors.border};
  --color-bg:${r.colors.background};
  --page-size:${r.configs.page.size};
  --page-orientation:${r.configs.page.orientation};
  --page-margin:${r.configs.page.margin};
  --header-h:${r.configs.header.visible && r.configs.header.repeat === "all" ? "48px" : "0px"};
  --footer-h:${r.configs.footer.visible ? "40px" : "0px"};
}
body{
  color:var(--color-text);
  background-color:var(--color-bg);
}

${r.assets.backgroundImage ? `
.page-bg{
  position:fixed;
  top:0;
  left:0;
  width:100%;
  height:100%;
  background-image:url('${r.assets.backgroundImage}');
  background-size:cover;
  background-repeat:no-repeat;
  background-position:center top;
  z-index:-1;
}` : ""}

/* inner white margin via padding, not page margin */
.body-wrap{
  padding:var(--page-margin);
  padding-top:calc(var(--header-h) + var(--page-margin));
  padding-bottom:calc(var(--footer-h) + var(--page-margin));
  box-decoration-break:clone;
  -webkit-box-decoration-break:clone; /* Chrome & Puppeteer */
}

.fixed-header{
  position:fixed;
  top:0;
  left:0;
  right:0;
  height:var(--header-h);
  background:transparent;
  z-index:1000;
}

.fixed-footer{
  position:fixed;
  bottom:0;
  left:0;
  right:0;
  height:var(--footer-h);
  background:transparent;
  z-index:1000;
  display:flex;
  align-items:center;
}

.pagebreak{page-break-after:always;}

@page{
  size:var(--page-size) var(--page-orientation);
  margin:0;           /* no browser margin */
}

@media print{
  .fixed-header{position:fixed;}
  .fixed-footer{position:fixed;}
  .page-bg{position:fixed;}
  html,body{height:auto !important;}

  .tbl{page-break-inside:auto;break-inside:auto;}
  .tbl thead{display:table-header-group;}
  .tbl tfoot{display:table-footer-group;}
  .tbl tr{page-break-inside:avoid;break-inside:avoid;}
  .tbl-wrap{overflow:visible !important;}
}
</style>`;

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
