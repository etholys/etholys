/** Diapositivas — Guion Presentación PPT (V2, 2026). */
export type ExpedicionSlide = {
  n: number;
  title: string;
  visual: string;
  texto: string;
  guion: string;
  tecnico: string;
  accion: string;
};

export const EXPEDICION_PRESENTATION_SLIDES: ExpedicionSlide[] = [
  {
    n: 1,
    title: 'Portada y Bienvenida',
    visual: 'Logo del curso, Mapa A2 y Tablero colectivo.',
    texto: 'Hoy transformamos tu idea en un negocio de Triple Impacto.',
    guion:
      'Bienvenidos. Hoy no venimos a una clase, venimos a jugar. Ustedes son expedicionarios. Tienen un mapa vacío (A2) y 500 Eco-Créditos. El tablero central es colectivo; su mapa es su modelo de negocio.',
    tecnico: '',
    accion: '',
  },
  {
    n: 2,
    title: 'Reglas de Oro',
    visual: 'Dado, carta, ficha, Eco-Crédito.',
    texto: 'Lanzar · Robar carta · Pegar en tu mapa A2 · Validar (+100 Eco-Créditos).',
    guion:
      'En el tablero colectivo: si caes en estación, roba carta. Resuélvela en tu mapa A2. Si el facilitador valida, +100 Eco-Créditos.',
    tecnico: 'Tablero = pista de 20 casillas (todos). Mapa A2 = ficha de negocio (cada uno).',
    accion: '',
  },
  {
    n: 3,
    title: 'Cápsula 1 — Raíces',
    visual: 'Triple Impacto (económico, social, ambiental).',
    texto: 'Tu propósito es tu brújula.',
    guion: 'Los que caigan en Raíces: definan propósito y cliente ideal (LOHAS).',
    tecnico:
      '¿Qué vacío dejaría tu negocio? No vendes solo producto: vendes salud y tradición local. Propuesta = Producto + Beneficio + Diferenciador.',
    accion: 'Pegar ficha de propósito en el hueco Raíces del mapa A2.',
  },
  {
    n: 4,
    title: 'Cápsula 2 — Tierra',
    visual: 'Suelo vivo, gota de agua, ahorro.',
    texto: 'Ecoeficiencia = rentabilidad.',
    guion: 'Busquen en sus cartas cómo cerrar ciclos. ¿Qué residuo transforman hoy?',
    tecnico: 'Cada gota ahorrada es dinero. Residuos = oro negro (compost). Semáforo rojo/verde.',
    accion: 'Semáforo de eficiencia en mapa A2.',
  },
  {
    n: 5,
    title: 'Cápsula 3 — Alquimia',
    visual: 'Materia prima → producto final etiquetado.',
    texto: 'Transformar para ganar.',
    guion: 'Definan flujo de trabajo y mensaje de empaque.',
    tecnico: 'Inocuidad = seguro de vida. Etiqueta narrativa = vendedor silencioso.',
    accion: 'Flujograma de valor (3 pasos) en mapa A2.',
  },
  {
    n: 6,
    title: 'Cápsula 4 — Mercado',
    visual: 'WhatsApp Business, QR, storytelling.',
    texto: 'Venta directa: del campo al celular.',
    guion: 'Preparen guion de ventas y catálogo digital.',
    tecnico: 'WhatsApp Business: catálogo y etiquetas. Storytelling del detrás de escena.',
    accion: 'Canales híbridos + mensaje principal en mapa A2.',
  },
  {
    n: 7,
    title: 'Cápsula 5 — Futuro',
    visual: 'Punto de equilibrio.',
    texto: 'Si no hay ganancia, no hay impacto.',
    guion: 'Saquen las cuentas en su mapa A2. ¿Es rentable su expedición?',
    tecnico: 'Costo fijo, punto de equilibrio, hoja de ruta 12 meses.',
    accion: 'Calcular equilibrio y 3 hitos en mapa A2.',
  },
  {
    n: 8,
    title: 'Gran desafío — Feria',
    visual: 'Cronómetro 30 segundos.',
    texto: '¡Feria de negocios! Pitch de impacto.',
    guion: 'Quienes tengan 3+ estaciones en el mapa participan. Mejor pitch: +300 Eco-Créditos.',
    tecnico: '',
    accion: 'Pitch oral usando el mapa A2 como soporte.',
  },
  {
    n: 9,
    title: 'Cierre y resultados',
    visual: 'Tabla de puntajes.',
    texto: 'Eco-Créditos + Puntos de Impacto + fórmula final.',
    guion: 'La expedición termina hoy; el negocio real empieza mañana.',
    tecnico: 'Fórmula: (Eco-Créditos × 0,6) + (Puntos de Impacto × 10 × 0,4).',
    accion: '',
  },
];
