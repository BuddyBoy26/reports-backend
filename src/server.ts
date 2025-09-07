import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import * as puppeteer from "puppeteer";

import { ReportSchema, type Report } from "./schema.js";
import { renderBody, renderHead } from "./renderers.js";
import { htmlShell } from "./template.js";

const app = express();

/* ---------- Middleware ---------- */
app.use(
  express.json({ limit: "5mb", type: ["application/json", "application/*+json"] })
);
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://claim-portal-testing.vercel.app",
      "https://claim-portal.vercel.app",
      "http://127.0.0.1:5500"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());
app.use(morgan("dev"));

/* ---------- Helpers ---------- */
function justifyCSS(align: "left" | "center" | "right") {
  return align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
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
  // Replace everything outside 0-127 with “_”, and collapse runs of “_”
  return raw
    .normalize("NFKD")          // break accents ⇒ base+mark
    .replace(/[\u0080-\uFFFF]/g, "_")  // non-ASCII → _
    .replace(/_+/g, "_")               // shrink repeats
    .replace(/^\W+|\W+$/g, "")         // trim leading/trailing non-word
    || "report";                       // fallback
}

async function urlToDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.warn("[assets] Failed to fetch image:", url, e);
    return null;
  }
}

async function buildTemplateAssets(report: Report) {
  return {
    logo: await urlToDataUri(report.assets.logo),
    headerImage: await urlToDataUri(report.assets.headerImage),
    footerImage: await urlToDataUri(report.assets.footerImage),
  };
}

/* ---------- Header/footer template strings ---------- */
function headerTemplate(
  report: Report,
  tplAssets: { logo: string | null; headerImage: string | null }
) {
  if (!report.configs.header.visible) return "<div></div>";

  const titleHtml = tplAssets.headerImage
    ? `<img src="${tplAssets.headerImage}" style="height:18px;" />`
    : `<div style="font-weight:600;">${escapeHtml(report.reportName)}</div>`;

  const logoHtml = tplAssets.logo
    ? `<img src="${tplAssets.logo}" style="height:14px;margin-right:8px;" />`
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
">
  ${logoHtml}${titleHtml}
</div>`;
}

function footerTemplate(report: Report, tplAssets: { footerImage: string | null }) {
  if (!report.configs.footer.visible) return "<div></div>";

  const raw = report.configs.footer.text || "Page {{page}} of {{pages}}";
  const textHtml = raw
    .replaceAll("{{page}}", '&nbsp;<span class="pageNumber"></span>&nbsp;')
    .replaceAll("{{pages}}", '&nbsp;<span class="totalPages"></span>')
    .replace(/^Page\b/i, '<span style="padding-right:2px;">Page</span>')
    .replace(/\bof\b/i, '<span style="padding:0 2px;">of</span>');

  const imgHtml = tplAssets.footerImage
    ? `<img src="${tplAssets.footerImage}" style="height:14px;margin-right:8px;" />`
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
">
  ${imgHtml}${textHtml}
</div>`;
}

/* ---------- Routes ---------- */
app.get("/", (_req, res) => res.json({ status: "ok" }));

/* ---- Live-preview HTML ---- */
app.post("/render", (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const report = parsed.data;
  const html = htmlShell(renderHead(report), renderBody(report));
  res.type("text/html; charset=utf-8").send(html);
});

/* ---- PDF generation ---- */
app.post("/render.pdf", async (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const report = parsed.data;

  const html = htmlShell(
    renderHead(report) +
      /* hide fixed header/footer when printing; puppeteer uses template equivalents */
      `<style>@media print { .fixed-header, .fixed-footer { display:none !important; } }</style>`,
    renderBody(report)
  );

  let browser: puppeteer.Browser | null = null;
  try {
    const tplAssets = await buildTemplateAssets(report);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("[pageerror]", e));
    page.on("console", (msg) => msg.type() === "error" && console.error("[console]", msg.text()));

    await page.setContent(html, { waitUntil: ["load", "domcontentloaded", "networkidle0"] });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: report.configs.page.size === "Letter" ? "Letter" : "A4",
      landscape: report.configs.page.orientation === "landscape",
      printBackground: true, // keep background color / image
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(report, {
        logo: tplAssets.logo,
        headerImage: tplAssets.headerImage,
      }),
      footerTemplate: footerTemplate(report, { footerImage: tplAssets.footerImage }),
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      preferCSSPageSize: false,
    });
    const filename = asciiFilename(report.reportName) + ".pdf";
    res
      .status(200)
      .setHeader("Content-Type", "application/pdf")
      .setHeader(
        "Content-Disposition",
        `inline; filename="${filename.replaceAll('"', "")}"`
      )
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
