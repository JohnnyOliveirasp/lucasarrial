// Auto-audit da landing — naviga locales × breakpoints, coleta erros, gera markdown.
// Uso: npm run audit:landing
//   - Assume dev server em http://localhost:3000 (subir antes: npm run dev)
//   - Saída: docs/audits/YYYY-MM-DD-landing.md + screenshots/

import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = dirname(__dirname);
const AUDIT_BASE = join(FRONTEND_ROOT, "docs", "audits");

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const LOCALES = ["pt-BR", "en", "es"];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];
const NAV_TIMEOUT = 30_000;
const SETTLE_MS = 1_500;

const today = new Date().toISOString().slice(0, 10);
const auditDir = join(AUDIT_BASE, today);
const shotsDir = join(auditDir, "screenshots");

await mkdir(shotsDir, { recursive: true });

const findings = [];
const screenshots = [];

const browser = await chromium.launch();

try {
  for (const locale of LOCALES) {
    for (const vp of VIEWPORTS) {
      const label = `${locale}-${vp.name}`;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        locale,
      });
      const page = await ctx.newPage();

      const consoleErrors = [];
      const consoleWarns = [];
      const pageErrors = [];
      const requestFails = [];

      page.on("console", (msg) => {
        const text = msg.text();
        if (msg.type() === "error") consoleErrors.push(text);
        if (msg.type() === "warning") consoleWarns.push(text);
      });
      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("requestfailed", (req) =>
        requestFails.push(`${req.url()} → ${req.failure()?.errorText}`),
      );

      const url = `${BASE_URL}/${locale}`;
      let navOk = true;
      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: NAV_TIMEOUT,
        });
        await page.waitForTimeout(SETTLE_MS);
      } catch (err) {
        navOk = false;
        pageErrors.push(`NAV_FAIL: ${err.message}`);
      }

      const shotPath = join(shotsDir, `${label}.png`);
      try {
        await page.screenshot({ path: shotPath, fullPage: true });
        screenshots.push({ label, path: shotPath });
      } catch (err) {
        pageErrors.push(`SHOT_FAIL: ${err.message}`);
      }

      const audit = navOk
        ? await page.evaluate(() => {
            const docW = document.documentElement.scrollWidth;
            const winW = window.innerWidth;
            const overflowH = docW - winW;

            const imgs = Array.from(document.querySelectorAll("img"));
            const imgsNoAlt = imgs.filter((i) => !i.alt && !i.hasAttribute("aria-hidden")).length;

            const interactiveSel =
              'a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            const interactive = Array.from(document.querySelectorAll(interactiveSel));
            const smallTaps = interactive
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
              })
              .map((el) => ({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || "").trim().slice(0, 40),
                w: Math.round(el.getBoundingClientRect().width),
                h: Math.round(el.getBoundingClientRect().height),
              }));

            const h1Count = document.querySelectorAll("h1").length;
            const htmlLang = document.documentElement.lang;
            const title = document.title;

            const deadLinks = Array.from(document.querySelectorAll('a[href="#"]')).length;

            const heroVideo = document.querySelector("video");
            const heroVideoReady = heroVideo
              ? heroVideo.readyState >= 2
              : false;

            return {
              overflowH,
              imgsNoAlt,
              smallTapsCount: smallTaps.length,
              smallTapsSample: smallTaps.slice(0, 5),
              h1Count,
              htmlLang,
              title,
              deadLinks,
              heroVideoReady,
              hasVideo: !!heroVideo,
            };
          })
        : null;

      findings.push({
        label,
        locale,
        viewport: vp,
        url,
        navOk,
        consoleErrors,
        consoleWarns,
        pageErrors,
        requestFails: requestFails.filter(
          (r) => !r.includes("favicon") && !r.includes("data:"),
        ),
        audit,
      });

      await ctx.close();
      process.stdout.write(`✓ ${label}\n`);
    }
  }
} finally {
  await browser.close();
}

// ─── Generate report ─────────────────────────────────────────────────
const issues = [];

for (const f of findings) {
  if (!f.navOk) {
    issues.push({ sev: "CRITICAL", label: f.label, msg: `Navegação falhou: ${f.url}` });
    continue;
  }
  for (const err of f.consoleErrors) {
    issues.push({ sev: "HIGH", label: f.label, msg: `JS error: ${err}` });
  }
  for (const err of f.pageErrors) {
    issues.push({ sev: "HIGH", label: f.label, msg: `Page error: ${err}` });
  }
  for (const fail of f.requestFails) {
    issues.push({ sev: "MEDIUM", label: f.label, msg: `Request failed: ${fail}` });
  }
  if (f.audit) {
    if (f.audit.overflowH > 1) {
      issues.push({
        sev: f.viewport.width < 768 ? "HIGH" : "MEDIUM",
        label: f.label,
        msg: `Overflow horizontal ${f.audit.overflowH}px (scrollWidth ${f.audit.overflowH + f.viewport.width} > ${f.viewport.width}px)`,
      });
    }
    if (f.audit.imgsNoAlt > 0) {
      issues.push({
        sev: "MEDIUM",
        label: f.label,
        msg: `${f.audit.imgsNoAlt} imagem(ns) sem alt text`,
      });
    }
    if (f.audit.smallTapsCount > 0 && f.viewport.width < 768) {
      issues.push({
        sev: "MEDIUM",
        label: f.label,
        msg: `${f.audit.smallTapsCount} touch target(s) < 44px no mobile. Ex: ${JSON.stringify(f.audit.smallTapsSample)}`,
      });
    }
    if (f.audit.h1Count !== 1) {
      issues.push({
        sev: "LOW",
        label: f.label,
        msg: `${f.audit.h1Count} <h1> na página (esperado: 1)`,
      });
    }
    if (f.audit.deadLinks > 0) {
      issues.push({
        sev: "LOW",
        label: f.label,
        msg: `${f.audit.deadLinks} link(s) com href="#" (dead link)`,
      });
    }
    if (f.audit.hasVideo && !f.audit.heroVideoReady) {
      issues.push({
        sev: "MEDIUM",
        label: f.label,
        msg: `Hero video presente mas readyState < 2 (não carregou metadados)`,
      });
    }
    if (f.audit.htmlLang !== f.locale) {
      issues.push({
        sev: "MEDIUM",
        label: f.label,
        msg: `<html lang="${f.audit.htmlLang}"> ≠ locale "${f.locale}"`,
      });
    }
  }
}

const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
issues.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);

const counts = issues.reduce((acc, i) => {
  acc[i.sev] = (acc[i.sev] || 0) + 1;
  return acc;
}, {});

const md = renderMarkdown({ findings, issues, counts });
const reportPath = join(auditDir, "landing.md");
await writeFile(reportPath, md, "utf8");

console.log(`\n────────────────────────────────`);
console.log(`Audit completo: ${reportPath}`);
console.log(`Screenshots: ${shotsDir}`);
console.log(
  `Issues: CRITICAL=${counts.CRITICAL || 0} HIGH=${counts.HIGH || 0} MEDIUM=${counts.MEDIUM || 0} LOW=${counts.LOW || 0}`,
);

if ((counts.CRITICAL || 0) + (counts.HIGH || 0) > 0) {
  process.exitCode = 1;
}

// ─── Markdown renderer ─────────────────────────────────────────────────
function renderMarkdown({ findings, issues, counts }) {
  const lines = [];
  lines.push(`# Audit Landing — ${today}`);
  lines.push("");
  lines.push(`**Base URL**: \`${BASE_URL}\``);
  lines.push(`**Locales**: ${LOCALES.join(", ")}`);
  lines.push(
    `**Breakpoints**: ${VIEWPORTS.map((v) => `${v.name} ${v.width}×${v.height}`).join(", ")}`,
  );
  lines.push("");
  lines.push("## Resumo de issues");
  lines.push("");
  lines.push("| Severidade | Total |");
  lines.push("|---|---|");
  lines.push(`| CRITICAL | ${counts.CRITICAL || 0} |`);
  lines.push(`| HIGH | ${counts.HIGH || 0} |`);
  lines.push(`| MEDIUM | ${counts.MEDIUM || 0} |`);
  lines.push(`| LOW | ${counts.LOW || 0} |`);
  lines.push(`| **TOTAL** | **${issues.length}** |`);
  lines.push("");

  if (issues.length === 0) {
    lines.push("✅ **Zero issues encontrados.** Landing aprovada.");
    lines.push("");
  } else {
    lines.push("## Issues (ordenadas por severidade)");
    lines.push("");
    for (const [i, issue] of issues.entries()) {
      lines.push(`### ${i + 1}. [${issue.sev}] \`${issue.label}\``);
      lines.push("");
      lines.push(issue.msg);
      lines.push("");
    }
  }

  lines.push("## Findings por cenário");
  lines.push("");
  for (const f of findings) {
    lines.push(`### \`${f.label}\` — ${f.url}`);
    lines.push("");
    lines.push(`- Nav OK: ${f.navOk}`);
    lines.push(`- Console errors: ${f.consoleErrors.length}`);
    lines.push(`- Console warnings: ${f.consoleWarns.length}`);
    lines.push(`- Page errors: ${f.pageErrors.length}`);
    lines.push(`- Request failures: ${f.requestFails.length}`);
    if (f.audit) {
      lines.push(`- Overflow horizontal: ${f.audit.overflowH}px`);
      lines.push(`- H1 count: ${f.audit.h1Count}`);
      lines.push(`- Imgs sem alt: ${f.audit.imgsNoAlt}`);
      lines.push(`- Small touch targets: ${f.audit.smallTapsCount}`);
      lines.push(`- Dead links: ${f.audit.deadLinks}`);
      lines.push(`- Hero video ready: ${f.audit.heroVideoReady}`);
      lines.push(`- html.lang: \`${f.audit.htmlLang}\``);
      lines.push(`- Title: \`${f.audit.title}\``);
    }
    lines.push("");
    lines.push(`![${f.label}](./screenshots/${f.label}.png)`);
    lines.push("");
  }
  return lines.join("\n");
}
