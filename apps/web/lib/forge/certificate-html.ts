export function forgeCertificateHtml(opts: {
  learnerName: string;
  courseTitle: string;
  institution: string;
  verifyCode: string;
  issuedAt: Date;
}): string {
  const date = opts.issuedAt.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Certificado — ${escape(opts.courseTitle)}</title>
<style>
  @media print { .no-print { display: none; } }
  body { font-family: Georgia, serif; margin: 0; background: #f1f5f9; }
  .page { max-width: 800px; margin: 2rem auto; background: #fff; border: 8px double #1e3a5f; padding: 3rem; text-align: center; }
  h1 { font-size: 2rem; color: #1e3a5f; margin: 0 0 0.5rem; letter-spacing: 0.05em; }
  .sub { color: #64748b; font-size: 0.95rem; margin-bottom: 2rem; }
  .name { font-size: 1.75rem; font-weight: bold; color: #0f172a; margin: 1.5rem 0; }
  .course { font-size: 1.25rem; color: #334155; }
  .code { font-family: monospace; margin-top: 2rem; font-size: 0.85rem; color: #6366f1; }
  .btn { display: inline-block; margin: 2rem 0 0; padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; }
</style>
</head>
<body>
<div class="page">
  <h1>CERTIFICADO DE CONCLUSIÓN</h1>
  <p class="sub">${escape(opts.institution)} · FORGE</p>
  <p>Se certifica que</p>
  <p class="name">${escape(opts.learnerName)}</p>
  <p>ha completado satisfactoriamente el programa</p>
  <p class="course"><strong>${escape(opts.courseTitle)}</strong></p>
  <p class="sub">${date}</p>
  <p class="code">Código de verificación: ${escape(opts.verifyCode)}</p>
</div>
<button class="no-print btn" onclick="window.print()">Imprimir / Guardar PDF</button>
</body>
</html>`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
