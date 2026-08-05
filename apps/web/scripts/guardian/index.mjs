#!/usr/bin/env node
/**
 * Guardião Etholys — sentinela de segurança do repositório.
 *
 * Lê o código como um revisor de segurança: procura segredos versionados, rotas sem
 * autenticação, falhas de isolamento entre empresas, falta de limites de pedidos,
 * padrões perigosos e lacunas de proteção de dados.
 *
 * Uso:
 *   node scripts/guardian/index.mjs                 relatório completo
 *   node scripts/guardian/index.mjs --new           apenas o que não está na baseline
 *   node scripts/guardian/index.mjs --update-baseline
 *   node scripts/guardian/index.mjs --json
 *   node scripts/guardian/index.mjs --fail-on high  código de saída 1 se houver achados >= severidade
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext } from './lib/context.mjs';

import secrets from './rules/secrets.mjs';
import apiAuth from './rules/api-auth.mjs';
import tenantIsolation from './rules/tenant-isolation.mjs';
import platformHardening from './rules/platform-hardening.mjs';
import rateLimit from './rules/rate-limit.mjs';
import dangerousCode from './rules/dangerous-code.mjs';
import dataProtection from './rules/data-protection.mjs';

const RULES = [secrets, apiAuth, tenantIsolation, platformHardening, rateLimit, dangerousCode, dataProtection];

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABEL = {
  critical: 'CRÍTICO',
  high: 'ALTO',
  medium: 'MÉDIO',
  low: 'BAIXO',
};

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(here, 'baseline.json');

function parseArgs(argv) {
  const args = { onlyNew: false, updateBaseline: false, json: false, failOn: null, rule: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--new') args.onlyNew = true;
    else if (arg === '--update-baseline') args.updateBaseline = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--fail-on') args.failOn = argv[++i];
    else if (arg === '--rule') args.rule = argv[++i];
  }
  return args;
}

function fingerprint(finding) {
  return `${finding.ruleId}::${finding.key}`;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { fingerprints: [], createdAt: null };
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return { fingerprints: [], createdAt: null };
  }
}

function collect(ctx, ruleFilter) {
  const findings = [];
  for (const rule of RULES) {
    if (ruleFilter && rule.id !== ruleFilter) continue;
    let produced = [];
    try {
      produced = rule.run(ctx) ?? [];
    } catch (error) {
      produced = [
        {
          severity: 'low',
          file: `scripts/guardian/rules/${rule.id}.mjs`,
          key: `rule-error:${rule.id}`,
          message: `A regra "${rule.id}" falhou a correr: ${error.message}`,
          hint: 'Corrigir a regra do Guardião.',
        },
      ];
    }
    for (const finding of produced) {
      findings.push({ ...finding, ruleId: rule.id, ruleTitle: rule.title });
    }
  }
  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return `${a.ruleId}${a.file}`.localeCompare(`${b.ruleId}${b.file}`);
  });
  return findings;
}

function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

function buildMarkdown(findings, { generatedAt, totals, ruleTotals }) {
  const lines = [];
  lines.push('# Relatório do Guardião Etholys');
  lines.push('');
  lines.push(`Gerado em ${generatedAt}.`);
  lines.push('');
  lines.push('| Gravidade | Achados |');
  lines.push('| --- | --- |');
  for (const sev of SEVERITY_ORDER) lines.push(`| ${SEVERITY_LABEL[sev]} | ${totals[sev]} |`);
  lines.push('');
  lines.push('| Área | Achados |');
  lines.push('| --- | --- |');
  for (const [title, count] of ruleTotals) lines.push(`| ${title} | ${count} |`);
  lines.push('');

  for (const sev of SEVERITY_ORDER) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`## ${SEVERITY_LABEL[sev]} (${group.length})`);
    lines.push('');
    for (const f of group) {
      const where = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`### ${f.message}`);
      lines.push('');
      lines.push(`- Onde: \`${where}\``);
      lines.push(`- Área: ${f.ruleTitle}`);
      if (f.hint) lines.push(`- Como resolver: ${f.hint}`);
      if (f.details?.length) {
        const shown = f.details.slice(0, 15);
        lines.push(`- Afetados: ${shown.map((d) => `\`${d}\``).join(', ')}${f.details.length > shown.length ? ` (+${f.details.length - shown.length})` : ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function printConsole(findings, totals, { onlyNew, reportPath }) {
  const color = process.env.NO_COLOR ? (s) => s : (code) => (s) => `\u001b[${code}m${s}\u001b[0m`;
  const paint = process.env.NO_COLOR
    ? { critical: (s) => s, high: (s) => s, medium: (s) => s, low: (s) => s, dim: (s) => s }
    : {
        critical: color('1;31'),
        high: color('31'),
        medium: color('33'),
        low: color('36'),
        dim: color('90'),
      };

  console.log('');
  console.log('  Guardião Etholys — varredura de segurança');
  console.log(`  ${onlyNew ? 'Apenas achados novos (fora da baseline)' : 'Todos os achados'}`);
  console.log('');
  for (const sev of SEVERITY_ORDER) {
    console.log(`  ${paint[sev](`${SEVERITY_LABEL[sev].padEnd(8)} ${String(totals[sev]).padStart(3)}`)}`);
  }
  console.log('');

  for (const sev of ['critical', 'high']) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    console.log(`  ${paint[sev](SEVERITY_LABEL[sev])}`);
    for (const f of group) {
      const where = f.line ? `${f.file}:${f.line}` : f.file;
      console.log(`   - ${f.message}`);
      console.log(`     ${paint.dim(where)}`);
    }
    console.log('');
  }

  console.log(`  Relatório completo: ${reportPath}`);
  console.log('');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctx = createContext();
  const all = collect(ctx, args.rule);

  if (args.updateBaseline) {
    const baseline = {
      createdAt: new Date().toISOString(),
      note: 'Achados conhecidos no momento da criação. O Guardião falha quando aparecem NOVOS achados.',
      fingerprints: all.map(fingerprint).sort(),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    console.log(`Baseline atualizada com ${baseline.fingerprints.length} achados: ${BASELINE_PATH}`);
    return 0;
  }

  const baseline = new Set(loadBaseline().fingerprints ?? []);
  const findings = args.onlyNew ? all.filter((f) => !baseline.has(fingerprint(f))) : all;

  const totals = countBySeverity(findings);
  const ruleTotals = RULES.map((rule) => [rule.title, findings.filter((f) => f.ruleId === rule.id).length]).filter(
    ([, count]) => count > 0,
  );

  const outDir = path.join(ctx.repoRoot, '.guardian');
  mkdirSync(outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const reportPath = path.join(outDir, 'report.md');
  writeFileSync(reportPath, buildMarkdown(findings, { generatedAt, totals, ruleTotals }), 'utf8');
  writeFileSync(
    path.join(outDir, 'findings.json'),
    `${JSON.stringify({ generatedAt, totals, findings }, null, 2)}\n`,
    'utf8',
  );

  if (args.json) {
    console.log(JSON.stringify({ generatedAt, totals, findings }, null, 2));
  } else {
    printConsole(findings, totals, { onlyNew: args.onlyNew, reportPath });
  }

  if (args.failOn) {
    const threshold = SEVERITY_ORDER.indexOf(args.failOn);
    if (threshold >= 0) {
      const blocking = findings.filter((f) => SEVERITY_ORDER.indexOf(f.severity) <= threshold);
      if (blocking.length > 0) {
        console.error(
          `Guardião: ${blocking.length} achado(s) com gravidade >= ${SEVERITY_LABEL[args.failOn]}.`,
        );
        return 1;
      }
    }
  }

  return 0;
}

process.exit(main());
