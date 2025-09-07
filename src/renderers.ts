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

const tw = (...cs: (string | undefined | null | false)[]) => cs.filter(Boolean).join(" ");

const alignFlex = (a: "left" | "center" | "right") =>
  a === "left" ? "justify-start" : a === "center" ? "justify-center" : "justify-end";

const dateFmt = (iso?: string) => {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const s = iso.slice(0, 10);
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return esc(iso);
  const map = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(d.getDate()).padStart(2, "0")} ${map[d.getMonth()]} ${d.getFullYear()}`;
};

/* ---------- Block renderers ---------- */
const headerBlock = (props: any, style: any) => `
<section class="${tw("mb-3", style?.wrapper)}">
  <h1 class="${tw("text-2xl font-bold text-slate-800", style?.title)}">${esc(props.text)}</h1>
</section>`;

const subheaderBlock = (props: any, style: any) => `
<section class="${tw("mb-2", style?.wrapper)}">
  <h2 class="${tw("text-xl font-semibold text-slate-700", style?.title)}">${esc(props.text)}</h2>
</section>`;

const dateBlock = (props: any, style: any, cfg: Cfg) => `
<section class="${tw("mb-2 flex", alignFlex(cfg.date.align), style?.wrapper)}">
  <div class="${tw("text-sm text-slate-600", style?.text)}">${esc(dateFmt(props.value))}</div>
</section>`;

const paraBlock = (props: any, style: any) => `
<section class="${tw("mb-3", style?.wrapper)}">
  <p class="${tw("text-justify", style?.text)}">${esc(props.text)}</p>
</section>`;

const dividerBlock = (colors: Col, style: any) => `
<hr class="${tw("my-4", style?.hr)}" style="border-color:${colors.border}"/>`;

const spacerBlock = (props: any, style: any) => {
  const m: Record<string, string> = { xs: "h-2", sm: "h-4", md: "h-8", lg: "h-12", xl: "h-20" };
  return `<div class="${tw(m[props.size || "md"], style?.wrapper)}"></div>`;
};

const pagebreakBlock = () => `<div class="pagebreak"></div>`;

const signatureBlock = (props: any, style: any, colors: Col) => {
  const n = Math.max(1, Math.min(5, props.lines ?? 1));
  const lines = Array.from({ length: n })
    .map(
      () =>
        `<div class="border-b" style="border-color:${colors.border};height:2rem;"></div>`
    )
    .join("");
  return `
<section class="${tw("mt-8", style?.wrapper)}">
  <div class="flex flex-col gap-6 w-64">
    ${lines}
    <div class="${tw("text-sm text-slate-600", style?.label)}">${esc(props.label || "")}</div>
  </div>
</section>`;
};

const footerTextBlock = (props: any, style: any) => `
<section class="${tw("mt-8 text-center text-sm text-slate-600", style?.text)}">${esc(
  props.text
)}</section>`;

const tableBlock = (props: any, style: any, cfg: Cfg, colors: Col) => {
  const title = props.title
    ? `<div class="${tw("mb-2 font-semibold text-slate-800", style?.title)}">${esc(
        props.title
      )}</div>`
    : "";
  const compact = cfg.table.compact ? "py-1 px-2 text-sm" : "py-2 px-3";

  const theadClass = tw(
    style?.thead,            /* component-level override */
    cfg.table.headerBg       /* global default */
  );

  const thead = (props.headers || [])
    .map(
      (h: string) =>
        `<th class="${compact} border-b font-semibold text-left" style="border-color:${colors.border}">${esc(
          h
        )}</th>`
    )
    .join("");
  const body = (props.rows || [])
    .map((row: any[], i: number) => {
      const bg = cfg.table.striped && i % 2 === 1 ? "bg-gray-50" : "";
      const tds = row
        .map(
          (c: any) =>
            `<td class="${compact} border-b" style="border-color:${colors.border}">${esc(
              c
            )}</td>`
        )
        .join("");
      return `<tr class="${bg}">${tds}</tr>`;
    })
    .join("");
  const notes = props.notes
    ? `<div class="mt-2 text-xs text-slate-500">${esc(props.notes)}</div>`
    : "";

  return `
<section class="${tw("my-4", style?.wrapper)}">
  ${title}
  <div class="${tw("tbl-wrap overflow-x-auto", style?.container)}">
    <table class="${tw("tbl w-full border-collapse", cfg.table.border)}"
           style="border-color:${colors.border}">
      <thead class="${theadClass}">
        ${thead ? `<tr>${thead}</tr>` : ""}
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  ${notes}
</section>`;
};

/* NEW ---------- image block ---------- */
const imageBlock = (props: any, style: any) => {
  const sizing: string[] = [];
  if (props.width) sizing.push(`width:${props.width};`);
  if (props.height) sizing.push(`height:${props.height};`);
  const cap = props.caption
    ? `<div class="${tw("text-xs text-slate-500 mt-1 text-center", style?.caption)}">${esc(
        props.caption
      )}</div>`
    : "";
  return `
<section class="${tw("my-4", style?.wrapper)}">
  <img src="${esc(props.url)}" alt="${esc(props.alt || "")}" class="${tw(
    "max-w-full mx-auto",
    style?.img
  )}" style="${sizing.join("")}"/>
  ${cap}
</section>`;
};

/* ---------- Renderers ---------- */
export const renderBody = (r: Report) => {
  const firstPageHeader =
    r.configs.header.visible && r.configs.header.repeat === "first"
      ? `
<section class="mb-6 border-b pb-3" style="border-color:${r.colors.border}">
  <div class="flex items-center ${"justify-" + r.configs.header.align}">
    ${r.assets.logo ? `<img src="${r.assets.logo}" alt="logo" class="h-8 mr-3"/>` : ""}
    ${
      r.assets.headerImage
        ? `<img src="${r.assets.headerImage}" alt="header" class="h-10"/>`
        : `<div class="text-xl font-semibold">${escapeHtml(r.reportName)}</div>`
    }
  </div>
</section>`
      : "";

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
        /* NEW */
        case "image":
          return imageBlock((c as any).props, c.style);
        default:
          return "";
      }
    })
    .join("");

  /* Fixed header only when repeat === 'all' */
  const fixedHeader =
    r.configs.header.visible && r.configs.header.repeat === "all"
      ? `
<header class="fixed-header border-b" style="border-color:${r.colors.border}">
  <div class="flex items-center ${"justify-" + r.configs.header.align} h-full px-4">
    ${r.assets.logo ? `<img src="${r.assets.logo}" alt="logo" class="h-8 mr-3"/>` : ""}
    ${
      r.assets.headerImage
        ? `<img src="${r.assets.headerImage}" alt="header" class="h-10"/>`
        : `<div class="font-semibold">${escapeHtml(r.reportName)}</div>`
    }
  </div>
</header>`
      : "";

  const fixedFooter = r.configs.footer.visible
    ? `
<footer class="fixed-footer border-t px-4" style="border-color:${r.colors.border}">
  ${
    r.assets.footerImage ? `<img src="${r.assets.footerImage}" alt="footer" class="h-6 mr-2"/>` : ""
  }
  <span class="text-sm text-gray-600">
    ${r.configs.footer.text.replace("{{page}}", "").replace("{{pages}}", "")}
  </span>
</footer>`
    : "";

  const main = `
<main class="prose max-w-none text-[0] body-wrap">
  <div class="text-[inherit] ${r.configs.font.base} ${r.configs.font.leading}" style="font-family:${r.configs.font.family}">
    ${firstPageHeader}${parts}
  </div>
</main>`;

  return `${fixedHeader}${main}${fixedFooter}`;
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
body {
  color: var(--color-text);
  background-color: var(--color-bg);
  ${
    r.assets.backgroundImage
      ? `background-image:url('${r.assets.backgroundImage}');
         background-size:cover;
         background-repeat:no-repeat;
         background-position:center top;`
      : ""
  }
}
.body-wrap { padding-top: var(--header-h); padding-bottom: var(--footer-h); }
.fixed-header {
  position: fixed; top: 0; left: 0; right: 0; height: var(--header-h);
  background: var(--color-bg); z-index: 1000;
}
.fixed-footer {
  position: fixed; bottom: 0; left: 0; right: 0; height: var(--footer-h);
  background: var(--color-bg); z-index: 1000; display: flex; align-items: center;
}
.pagebreak { page-break-after: always; }

@page { size: var(--page-size) var(--page-orientation); margin: var(--page-margin); }

@media print {
  .fixed-header { position: fixed; }
  .fixed-footer { position: fixed; }
  html, body { height: auto !important; }

  .tbl { page-break-inside: auto; break-inside: auto; }
  .tbl thead { display: table-header-group; }
  .tbl tfoot { display: table-footer-group; }
  .tbl tr { page-break-inside: avoid; break-inside: avoid; }
  .tbl-wrap { overflow: visible !important; }
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
