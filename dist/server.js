// src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import puppeteer from "puppeteer";
import { ReportSchema } from "./schema.js";
import { renderBody, renderHead } from "./renderers.js";
import { htmlShell } from "./template.js";
const app = express();
/* ============ Middleware ============ */
app.use(express.json({ limit: "5mb", type: ["application/json", "application/*+json"] }));
app.use(cors({
    origin: ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());
app.use(morgan("dev"));
/* ============ Utils ============ */
function justifyCSS(align) {
    return align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
}
function escapeHtml(s) {
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
/** Fetch a remote image and return a data URI, or null if it fails. */
async function urlToDataUri(url) {
    if (!url)
        return null;
    try {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get("content-type") || "image/png";
        const b64 = buf.toString("base64");
        return `data:${ct};base64,${b64}`;
    }
    catch (e) {
        console.warn("[assets] Failed to fetch image for template:", url, e);
        return null;
    }
}
async function buildTemplateAssets(report) {
    const logo = await urlToDataUri(report.assets?.logo);
    const headerImage = await urlToDataUri(report.assets?.headerImage);
    const footerImage = await urlToDataUri(report.assets?.footerImage);
    return { logo, headerImage, footerImage };
}
function headerTemplate(report, tplAssets) {
    if (!report.configs.header.visible)
        return `<div></div>`;
    const titleHtml = tplAssets.headerImage
        ? `<img src="${tplAssets.headerImage}" style="height:18px;" />`
        : `<div style="font-weight:600;">${escapeHtml(report.reportName)}</div>`;
    const logoHtml = tplAssets.logo ? `<img src="${tplAssets.logo}" style="height:14px;margin-right:8px;" />` : "";
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
function footerTemplate(report, tplAssets) {
    if (!report.configs.footer.visible)
        return `<div></div>`;
    // Use non-breaking spaces to prevent Chromium template whitespace collapse.
    // Also wrap static words in spans so spacing is consistent across engines.
    const raw = report.configs.footer.text || "Page {{page}} of {{pages}}";
    const textHtml = raw
        .replaceAll("{{page}}", '&nbsp;<span class="pageNumber"></span>&nbsp;')
        .replaceAll("{{pages}}", '&nbsp;<span class="totalPages"></span>')
        // Ensure "Page" and "of" remain separated even if the engine trims text nodes.
        .replace(/^Page\b/i, '<span style="padding-right:2px;">Page</span>')
        .replace(/\bof\b/i, '<span style="padding:0 2px;">of</span>');
    const imgHtml = tplAssets.footerImage ? `<img src="${tplAssets.footerImage}" style="height:14px;margin-right:8px;" />` : "";
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
  /* Tabular numbers help avoid page-number jitter */
  font-variant-numeric: tabular-nums;
">
  ${imgHtml}${textHtml}
</div>`;
}
/* ============ Routes ============ */
app.get("/", (_req, res) => res.json({ status: "ok" }));
// Return HTML for in-app preview
app.post("/render", (req, res) => {
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    const report = parsed.data;
    const head = renderHead(report);
    const body = renderBody(report);
    const html = htmlShell(head, body);
    res.type("text/html; charset=utf-8").send(html);
});
// Return PDF with page numbers + inlined header/footer images
app.post("/render.pdf", async (req, res) => {
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    const report = parsed.data;
    // Hide DOM fixed header/footer during print (PDF will use puppeteer templates)
    const head = renderHead(report);
    const body = renderBody(report);
    const html = htmlShell(head + `<style>@media print { .fixed-header, .fixed-footer { display:none !important; } }</style>`, body);
    let browser = null;
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
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: headerTemplate(report, { logo: tplAssets.logo, headerImage: tplAssets.headerImage }),
            footerTemplate: footerTemplate(report, { footerImage: tplAssets.footerImage }),
            margin: {
                top: "30mm", // space for header
                bottom: "30mm", // space for footer
                left: "15mm",
                right: "15mm",
            },
            preferCSSPageSize: false,
        });
        res.status(200);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${report.reportName.replaceAll('"', "")}.pdf"`);
        res.setHeader("Content-Length", String(pdf.length));
        res.end(pdf);
    }
    catch (e) {
        console.error("PDF render failed:", e?.message || e);
        res.status(500).json({ error: "PDF render failed", detail: String(e?.message || e) });
    }
    finally {
        if (browser)
            await browser.close();
    }
});
/* ============ Error Handler ============ */
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
});
/* ============ Listen ============ */
const port = Number(process.env.PORT || 5000);
app.listen(port, "0.0.0.0", () => {
    console.log(`Renderer running at http://localhost:${port}`);
});
