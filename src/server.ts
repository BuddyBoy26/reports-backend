import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import * as puppeteer from "puppeteer";

import { ReportSchema, type Report } from "./schema.js";
import { renderBody, renderHead } from "./renderers.js";
import { htmlShell } from "./template.js";

import { toDataUri } from "./lib/toDataUri.js";   // ⬅️ NEW helper

/* ──────────────────────────────────────────────────────────── */

const app = express();

/* ---------- Middleware ---------- */
app.use(
  express.json({ limit: "5mb", type: ["application/json", "application/*+json"] }),
);
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://claim-portal-testing.vercel.app",
      "https://claim-portal.vercel.app",
      "http://127.0.0.1:5500",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("*", cors());
app.use(morgan("dev"));

/* ---------- Helpers ---------- */
function justifyCSS(a: "left" | "center" | "right") {
  return a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center";
}
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function asciiFilename(raw: string): string {
  return (
    raw
      .normalize("NFKD")
      .replace(/[\u0080-\uFFFF]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\W+|\W+$/g, "") || "report"
  );
}

/* ---------- Embed every image as a data-URI ---------- */
async function hydrateAssets(report: Report) {
  report.assets.logo            = (await toDataUri(report.assets.logo))            ?? report.assets.logo;
  report.assets.headerImage     = (await toDataUri(report.assets.headerImage))     ?? report.assets.headerImage;
  report.assets.footerImage     = (await toDataUri(report.assets.footerImage))     ?? report.assets.footerImage;
  report.assets.backgroundImage = (await toDataUri(report.assets.backgroundImage)) ?? report.assets.backgroundImage;

  await Promise.all(
    report.components.map(async (c) => {
      if (c.type === "image") {
        const p: any = (c as any).props;
        p.url = (await toDataUri(p.url)) ?? p.url;
      }
    }),
  );
}

/* ---------- Header / footer HTML fragments ---------- */
function headerTemplate(report: Report) {
  if (!report.configs.header.visible) return "<div></div>";

  const title = report.assets.headerImage
    ? `<img src="${report.assets.headerImage}" style="height:18px;">`
    : `<div style="font-weight:600;">${escapeHtml(report.reportName)}</div>`;

  const logo  = report.assets.logo
    ? `<img src="${report.assets.logo}" style="height:14px;margin-right:8px;">`
    : "";

  return `
<div style="
  font-size:10px;
  color:${report.colors.text};
  width:100%;
  padding:4px 0;
  display:flex;
  align-items:center;
  justify-content:${justifyCSS(report.configs.header.align)};
  border-bottom:1px solid ${report.colors.border};
  font-family:${report.configs.font.family};
  margin:0 15mm;
">${logo}${title}</div>`;
}

function footerTemplate(report: Report) {
  if (!report.configs.footer.visible) return "<div></div>";

  const raw = report.configs.footer.text || "Page {{page}} of {{pages}}";
  const txt = raw
    .replaceAll("{{page}}", '&nbsp;<span class="pageNumber"></span>&nbsp;')
    .replaceAll("{{pages}}", '&nbsp;<span class="totalPages"></span>')
    .replace(/^Page\b/i, '<span style="padding-right:2px;">Page</span>')
    .replace(/\bof\b/i, '<span style="padding:0 2px;">of</span>');

  const img = report.assets.footerImage
    ? `<img src="${report.assets.footerImage}" style="height:14px;margin-right:8px;">`
    : "";

  return `
<div style="
  font-size:10px;
  color:${report.colors.text};
  width:100%;
  padding:4px 0;
  display:flex;
  align-items:center;
  justify-content:${justifyCSS(report.configs.footer.align)};
  border-top:1px solid ${report.colors.border};
  font-family:${report.configs.font.family};
  margin:0 15mm;
  font-variant-numeric: tabular-nums;
">${img}${txt}</div>`;
}

/* ---------- Routes ---------- */
app.get("/", (_req, res) => res.json({ status: "ok" }));

app.post("/render", async (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const report = parsed.data;
  await hydrateAssets(report);                            // ⬅️ embed images

  const html = htmlShell(renderHead(report), renderBody(report));
  res.type("text/html; charset=utf-8").send(html);
});

app.post("/render.pdf", async (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const report = parsed.data;
  await hydrateAssets(report);                            // ⬅️ embed images

  const html = htmlShell(
    renderHead(report) +
      `<style>@media print {.fixed-header,.fixed-footer{display:none!important}}</style>`,
    renderBody(report),
  );

  let browser: puppeteer.Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    page.on("pageerror",  (e) => console.error("[pageerror]", e));
    page.on("console",    (m) => m.type() === "error" && console.error("[console]", m.text()));

    await page.setContent(html, { waitUntil: ["load","domcontentloaded","networkidle0"] });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: report.configs.page.size === "Letter" ? "Letter" : "A4",
      landscape: report.configs.page.orientation === "landscape",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(report),
      footerTemplate: footerTemplate(report),
      margin: { top:"0mm", bottom:"0mm", left:"0mm", right:"0mm" },
      preferCSSPageSize: false,
    });

    const filename = asciiFilename(report.reportName)+".pdf";
    res
      .status(200)
      .setHeader("Content-Type", "application/pdf")
      .setHeader("Content-Disposition", `inline; filename="${filename}"`)
      .setHeader("Content-Length", String(pdf.length))
      .end(pdf);
  } catch (e: any) {
    console.error("PDF render failed:", e?.message || e);
    res.status(500).json({ error: "PDF render failed", detail: String(e?.message || e) });
  } finally {
    if (browser) await browser.close();
  }
});

/* ---------- Error handler ---------- */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

/* ---------- Listen ---------- */
const port = Number(process.env.PORT || 5000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Renderer running at http://localhost:${port}`);
});
