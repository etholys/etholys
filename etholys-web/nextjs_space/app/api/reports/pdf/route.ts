export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount ?? 0);
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'executive';
    const companyId = searchParams.get('companyId');
    const companyFilter: any = companyId ? { companyId } : {};

    const [projects, tasks, companies] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true, ...companyFilter }, include: { company: true, milestones: true } }),
      prisma.task.findMany({ where: { isActive: true, project: companyFilter }, include: { assignee: true, project: true } }),
      prisma.company.findMany({ where: { isActive: true } }),
    ]);

    const totalBudget = (projects ?? []).reduce((s: number, p: any) => s + (p?.budget ?? 0), 0);
    const totalSpent = (projects ?? []).reduce((s: number, p: any) => s + (p?.spent ?? 0), 0);
    const doneTasks = (tasks ?? []).filter((t: any) => t?.status === 'DONE')?.length ?? 0;
    const totalTasks = tasks?.length ?? 0;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1e293b; font-size: 12px; }
      h1 { color: #0D9488; font-size: 24px; border-bottom: 3px solid #0D9488; padding-bottom: 8px; }
      h2 { color: #334155; font-size: 16px; margin-top: 24px; }
      .stats { display: flex; gap: 16px; margin: 16px 0; }
      .stat { background: #f1f5f9; padding: 16px; border-radius: 8px; flex: 1; text-align: center; }
      .stat .value { font-size: 20px; font-weight: bold; color: #0D9488; }
      .stat .label { font-size: 10px; color: #64748b; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
      .progress-bar { background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 4px; background: #0D9488; }
    </style></head><body>
      <h1>ATLAS ERP — ${type === 'executive' ? 'Reporte Ejecutivo' : type === 'project' ? 'Avance de Proyectos' : type === 'financial' ? 'Reporte Financiero' : 'Tareas Completadas'}</h1>
      <p style="color: #64748b;">Generado: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

      <div class="stats">
        <div class="stat"><div class="value">${projects?.length ?? 0}</div><div class="label">Proyectos</div></div>
        <div class="stat"><div class="value">${formatMoney(totalBudget)}</div><div class="label">Presupuesto Total</div></div>
        <div class="stat"><div class="value">${formatMoney(totalSpent)}</div><div class="label">Gastado</div></div>
        <div class="stat"><div class="value">${doneTasks}/${totalTasks}</div><div class="label">Tareas Completadas</div></div>
      </div>

      <h2>Proyectos</h2>
      <table>
        <thead><tr><th>Proyecto</th><th>Empresa</th><th>Estado</th><th>Presupuesto</th><th>Gastado</th><th>Progreso</th></tr></thead>
        <tbody>
          ${(projects ?? []).map((p: any) => `
            <tr>
              <td><strong>${p?.name ?? ''}</strong>${p?.donorName ? `<br><span style="color:#64748b;font-size:10px">${p.donorName}</span>` : ''}</td>
              <td>${p?.company?.shortName ?? ''}</td>
              <td><span class="badge" style="background:${getStatusBg(p?.status)}">${p?.status ?? ''}</span></td>
              <td>${formatMoney(p?.budget ?? 0)}</td>
              <td>${formatMoney(p?.spent ?? 0)}</td>
              <td><div class="progress-bar"><div class="progress-fill" style="width:${p?.progress ?? 0}%"></div></div>${p?.progress ?? 0}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${type === 'tasks' || type === 'executive' ? `
        <h2>Tareas Recientes</h2>
        <table>
          <thead><tr><th>Tarea</th><th>Proyecto</th><th>Asignado</th><th>Estado</th><th>Prioridad</th></tr></thead>
          <tbody>
            ${(tasks ?? []).slice(0, 20).map((t: any) => `
              <tr>
                <td>${t?.title ?? ''}</td>
                <td>${t?.project?.name ?? ''}</td>
                <td>${t?.assignee?.name ?? '-'}</td>
                <td><span class="badge" style="background:${getStatusBg(t?.status)}">${t?.status ?? ''}</span></td>
                <td>${t?.priority ?? ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        <p>ATLAS ERP — Gestión Integral de Proyectos y Tareas</p>
        <p>Este reporte fue generado automáticamente. Todos los datos son actualizados al momento de la generación.</p>
      </div>
    </body></html>`;

    const createRes = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deployment_token: process.env.ABACUSAI_API_KEY, html_content: html, pdf_options: { format: 'A4', landscape: type === 'financial' }, base_url: process.env.NEXTAUTH_URL || '' }),
    });
    if (!createRes.ok) return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 });
    const { request_id } = await createRes.json();
    if (!request_id) return NextResponse.json({ error: 'No request ID' }, { status: 500 });

    let attempts = 0;
    while (attempts < 120) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusResult = await statusRes.json();
      if (statusResult?.status === 'SUCCESS' && statusResult?.result?.result) {
        const pdfBuffer = Buffer.from(statusResult.result.result, 'base64');
        return new NextResponse(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="reporte-${type}.pdf"` } });
      }
      if (statusResult?.status === 'FAILED') return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
      attempts++;
    }
    return NextResponse.json({ error: 'Timeout' }, { status: 500 });
  } catch (error: any) {
    console.error('PDF error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

function getStatusBg(status: string | null | undefined): string {
  const m: Record<string, string> = { DRAFT: '#e2e8f0', PLANNING: '#dbeafe', IN_PROGRESS: '#fef3c7', ON_HOLD: '#fee2e2', COMPLETED: '#dcfce7', CANCELLED: '#f3f4f6', BACKLOG: '#e2e8f0', TODO: '#dbeafe', IN_REVIEW: '#f3e8ff', DONE: '#dcfce7' };
  return m?.[status ?? ''] ?? '#e2e8f0';
}
