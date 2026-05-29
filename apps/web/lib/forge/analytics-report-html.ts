import type { CourseAnalytics } from '@/lib/forge/course-analytics-types';
import type { ProgramAnalytics } from '@/lib/forge/program-analytics-types';
import type { Locale } from '@/lib/i18n';
import { forgeT, forgeTFormat } from '@/lib/forge/i18n';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';

function dateLocale(loc: Locale): string {
  if (loc === 'pt') return 'pt-PT';
  if (loc === 'en') return 'en-GB';
  return 'es-ES';
}

export function courseAnalyticsReportHtml(
  courseTitle: string,
  data: CourseAnalytics,
  locale?: Locale,
  generatedAt = new Date()
): string {
  const loc = parseForgeEmailLocale(locale);
  const dl = dateLocale(loc);
  const modules = data.moduleHeatmap
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.title)}</td><td>${m.completionRate}%</td><td>${m.activityCount}</td></tr>`
    )
    .join('');
  const atRisk = data.atRisk
    .map((a) => {
      const name = escapeHtml(a.name ?? a.email ?? a.userId);
      const date = new Date(a.enrolledAt).toLocaleDateString(dl);
      const line = forgeTFormat('forge.report.atRiskItem', loc, {
        name,
        percent: a.progressPercent,
        date,
      });
      return `<li>${line}</li>`;
    })
    .join('');

  const heading = forgeTFormat('forge.report.courseHeading', loc, { course: escapeHtml(courseTitle) });
  const generated = forgeTFormat('forge.report.generated', loc, {
    date: generatedAt.toLocaleString(dl),
  });

  return `<!DOCTYPE html><html lang="${loc}"><head><meta charset="utf-8"/><title>FORGE — ${escapeHtml(courseTitle)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#0f172a}
h1{font-size:1.5rem}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #e2e8f0;padding:.5rem;text-align:left}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}.stat{background:#f8fafc;border-radius:8px;padding:1rem}
.stat b{display:block;font-size:1.5rem}</style></head><body>
<h1>${heading}</h1>
<p style="color:#64748b">${generated}</p>
<div class="stats">
<div class="stat"><span>${forgeT('forge.analytics.stat.learners', loc)}</span><b>${data.learnerCount}</b></div>
<div class="stat"><span>${forgeT('forge.analytics.stat.progress', loc)}</span><b>${data.avgProgress}%</b></div>
<div class="stat"><span>${forgeT('forge.analytics.stat.active7', loc)}</span><b>${data.activeLast7Days}</b></div>
<div class="stat"><span>${forgeT('forge.analytics.stat.certs', loc)}</span><b>${data.certificatesIssued}</b></div>
</div>
<h2>${forgeT('forge.report.colModule', loc)}</h2><table><thead><tr><th>${forgeT('forge.report.colModule', loc)}</th><th>${forgeT('forge.report.colCompletion', loc)}</th><th>${forgeT('forge.report.colActivities', loc)}</th></tr></thead><tbody>${modules}</tbody></table>
<h2>${forgeTFormat('forge.report.atRiskHeading', loc, { count: data.atRisk.length })}</h2><ul>${atRisk || `<li>${forgeT('forge.report.none', loc)}</li>`}</ul>
</body></html>`;
}

export function programAnalyticsReportHtml(
  data: ProgramAnalytics,
  locale?: Locale,
  generatedAt = new Date()
): string {
  const loc = parseForgeEmailLocale(locale);
  const dl = dateLocale(loc);
  const rows = data.courses
    .map(
      (c) =>
        `<tr><td>${c.coverEmoji} ${escapeHtml(c.title)}</td><td>${c.learnerCount}</td><td>${c.avgProgress}%</td><td>${c.activeLast7Days}</td><td>${c.certificatesIssued}</td></tr>`
    )
    .join('');

  const heading = forgeTFormat('forge.report.programHeading', loc, { title: escapeHtml(data.title) });
  const meta = forgeTFormat('forge.report.programMeta', loc, {
    courses: data.courseCount,
    learners: data.totalLearners,
    progress: data.avgProgressAcrossCourses,
  });

  return `<!DOCTYPE html><html lang="${loc}"><head><meta charset="utf-8"/><title>FORGE — ${escapeHtml(data.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:.5rem}</style></head><body>
<h1>${heading}</h1>
<p>${meta} · ${forgeTFormat('forge.report.generated', loc, { date: generatedAt.toLocaleString(dl) })}</p>
<table><thead><tr><th>${forgeT('forge.report.colCourse', loc)}</th><th>${forgeT('forge.report.colLearners', loc)}</th><th>${forgeT('forge.report.colProgress', loc)}</th><th>${forgeT('forge.report.colActive7', loc)}</th><th>${forgeT('forge.report.colCerts', loc)}</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
