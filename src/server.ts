import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ReportSchema, type Report } from "./schema.js";
import { renderBody, renderHead } from "./renderers.js";
import { htmlShell } from "./template.js";
import puppeteer from "puppeteer";

const app = express();

// Middlewares
app.use(helmet());                       // sensible security headers
app.use(cors());                         // allow multiple frontends
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" })); // adjust if you plan very large payloads

// Health
app.get("/", (_req, res) => res.json({ status: "ok" }));

// HTML render
app.post("/render", (req: Request, res: Response, next: NextFunction) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const report: Report = parsed.data;
  const head = renderHead(report);
  const body = renderBody(report);
  const html = htmlShell(head, body);
  res.type("text/html; charset=utf-8").send(html);
});

// PDF render
// app.post("/render.pdf", async (req: Request, res: Response) => {
//   const parsed = ReportSchema.safeParse(req.body);
//   if (!parsed.success) {
//     return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
//   }
//   const report: Report = parsed.data;
//   const head = renderHead(report);
//   const body = renderBody(report);
//   const html = htmlShell(head, body);

//   const browser = await puppeteer.launch({ headless: true });
//   try {
//     const page = await browser.newPage();
//     await page.setContent(html, { waitUntil: ["load","domcontentloaded","networkidle0"] });
//     const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
//     res
//       .type("application/pdf")
//       .setHeader("Content-Disposition", `inline; filename="${report.reportName.replaceAll('"', "")}.pdf"`)
//       .send(pdf);
//   } finally {
//     await browser.close();
//   }
// });

app.post("/render.pdf", async (req, res) => {
  // 0) Validate body
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const report = parsed.data;

  const head = renderHead(report);
  const body = renderBody(report);
  const html = htmlShell(head, body);

  let browser: import("puppeteer").Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      // If corporate proxy/firewall blocks download, either set PUPPETEER_SKIP_DOWNLOAD=1
      // and point to local Chrome, or pass executablePath to your Chrome here.
      // executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    // Fail fast on page errors that would cause HTML error instead of PDF
    page.on("pageerror", (e) => console.error("[pageerror]", e));
    page.on("console", (msg) => msg.type() === "error" && console.error("[console]", msg.text()));

    await page.setContent(html, { waitUntil: ["load","domcontentloaded","networkidle0"] });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true
      // or explicit size: format: "A4", margin: { top: "18mm", right:"18mm", bottom:"18mm", left:"18mm" }
    });

    // IMPORTANT: set headers and send ONLY the buffer, nothing else.
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${report.reportName.replaceAll('"',"")}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  } catch (err: any) {
    console.error("PDF render failed:", err?.message || err);
    // Send JSON error with correct content-type so you won’t save a bogus .pdf
    res.status(500).json({ error: "PDF render failed", detail: String(err?.message || err) });
  } finally {
    if (browser) await browser.close();
  }
});


// Basic error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Express Report Renderer listening on http://localhost:${port}`);
});
