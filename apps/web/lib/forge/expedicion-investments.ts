import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';

export type ExpedicionInvestment = {
  id: string;
  label: string;
  ecoCost: number;
  impact: number;
  hint: string;
};

/** Menu de investimentos 5×5 (jogo físico): 5 estaciones × 5 fichas. */
export const EXPEDICION_INVESTMENTS: Record<ExpedicionStationSlug, ExpedicionInvestment[]> = {
  raices: [
    { id: 'r-i1', label: 'Propósito escrito', ecoCost: 80, impact: 2, hint: 'Pegar en mapa — Raíces' },
    { id: 'r-i2', label: 'Cliente LOHAS', ecoCost: 100, impact: 2, hint: 'Avatar + dolor + deseo' },
    { id: 'r-i3', label: 'Alianza local', ecoCost: 120, impact: 3, hint: '1 socio de confianza' },
    { id: 'r-i4', label: 'Historia de marca', ecoCost: 90, impact: 2, hint: 'Pitch de 30 s' },
    { id: 'r-i5', label: 'Certificación ética', ecoCost: 150, impact: 4, hint: 'Sello o compromiso público' },
  ],
  tierra: [
    { id: 't-i1', label: 'Semáforo hídrico', ecoCost: 70, impact: 2, hint: 'Rojo/amarillo/verde agua' },
    { id: 't-i2', label: 'Compostaje', ecoCost: 110, impact: 3, hint: 'Residuo → abono' },
    { id: 't-i3', label: 'Energía solar', ecoCost: 200, impact: 5, hint: 'Meta a 12 meses' },
    { id: 't-i4', label: 'Proveedor local', ecoCost: 100, impact: 2, hint: 'KM0 en cadena' },
    { id: 't-i5', label: 'Inventario verde', ecoCost: 85, impact: 2, hint: '3 insumos auditados' },
  ],
  alquimia: [
    { id: 'a-i1', label: 'Empaque sin plástico', ecoCost: 130, impact: 3, hint: 'Material alternativo' },
    { id: 'a-i2', label: 'Proceso inocuo', ecoCost: 95, impact: 2, hint: 'Checklist 3 pasos' },
    { id: 'a-i3', label: 'Upcycling', ecoCost: 140, impact: 4, hint: 'Subproducto con valor' },
    { id: 'a-i4', label: 'Etiqueta honesta', ecoCost: 75, impact: 2, hint: 'Claim verificable' },
    { id: 'a-i5', label: 'Lote piloto', ecoCost: 160, impact: 4, hint: '10 unidades test' },
  ],
  mercado: [
    { id: 'm-i1', label: 'Canal WhatsApp', ecoCost: 60, impact: 2, hint: 'Catálogo + respuesta' },
    { id: 'm-i2', label: 'Feria local', ecoCost: 120, impact: 3, hint: 'Stand + muestras' },
    { id: 'm-i3', label: 'Precio premium', ecoCost: 90, impact: 2, hint: 'Justificar +20%' },
    { id: 'm-i4', label: 'Red de distribución', ecoCost: 180, impact: 4, hint: '2 puntos de venta' },
    { id: 'm-i5', label: 'Contenido social', ecoCost: 80, impact: 2, hint: '4 posts / mes' },
  ],
  futuro: [
    { id: 'f-i1', label: 'Punto de equilibrio', ecoCost: 100, impact: 3, hint: 'Unidades mínimas/mes' },
    { id: 'f-i2', label: 'Fondo de reserva', ecoCost: 150, impact: 3, hint: '1 mes de costes' },
    { id: 'f-i3', label: 'Hoja 12 meses', ecoCost: 110, impact: 3, hint: '3 hitos' },
    { id: 'f-i4', label: 'Métrica de impacto', ecoCost: 95, impact: 2, hint: 'KPI social/ambiental' },
    { id: 'f-i5', label: 'Escalado regional', ecoCost: 220, impact: 5, hint: '2º municipio' },
  ],
};
