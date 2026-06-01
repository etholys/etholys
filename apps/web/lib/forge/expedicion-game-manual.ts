/** Contenido del Manual La Expedición (sustituye guion por diapositiva). */
export type ManualSection = {
  id: string;
  title: string;
  icon: string;
  body: string[];
};

export const EXPEDICION_GAME_MANUAL: ManualSection[] = [
  {
    id: 'objetivo',
    title: 'Objetivo del juego',
    icon: '🎯',
    body: [
      'Sprint de ~3,5 h: avanzar en la pista colectiva, robar cartas por estación y pegar fichas en tu Mapa personal.',
      'Ganáis Eco-Créditos y Puntos de Impacto. El facilitador valida respuestas (+100 Eco) y cierra el banco al final.',
    ],
  },
  {
    id: 'tablero',
    title: 'Tablero colectivo (centro de la pantalla)',
    icon: '🗺️',
    body: [
      'La pista tiene 20 casillas en forma de circuito. Cada color es una estación: Raíces, Tierra, Alquimia, Mercado, Futuro, Acción o Desafío.',
      'Cada jugador tiene un peón. En tu turno: lanzás el dado → avanzás → si caes en estación, robás carta de ese mazo.',
      'El tablero es compartido; tu mapa es solo tuyo.',
    ],
  },
  {
    id: 'dado',
    title: 'Dado virtual',
    icon: '🎲',
    body: [
      'Solo en tu turno. Sacás un número y el peón avanza tantas casillas.',
      'No podés lanzar si tenés una carta sin resolver: primero respondé o pasá turno.',
    ],
  },
  {
    id: 'cartas',
    title: 'Mazo por estación',
    icon: '🃏',
    body: [
      'Al robar, sale una carta del mazo de la estación donde caíste (no es aleatorio de todo el juego).',
      'Leé la consigna en voz alta, resolvela en tu mapa y escribí la respuesta en pantalla para validar.',
    ],
  },
  {
    id: 'mapa',
    title: 'Mapa personal',
    icon: '📋',
    body: [
      '5 estaciones en tu hoja física o digital: propósito, recursos, producto, mercado, finanzas.',
      'Las cartas y las fichas de inversión se “pegan” ahí. El facilitador confirma cuando está bien hecho.',
    ],
  },
  {
    id: 'eco',
    title: 'Eco-Créditos e impacto',
    icon: '💰',
    body: [
      'Empezáis con 500 Eco-Créditos. Validar ficha: +100 Eco y +1 Impacto.',
      'Desafíos pueden restar Eco. Inversiones del menú 5×5 cuestan Eco y suman impacto si las aplicás en el mapa.',
    ],
  },
  {
    id: 'inversiones',
    title: 'Inversiones 5×5',
    icon: '🧩',
    body: [
      'En cada estación hay 5 fichas de inversión (menú en la sala). Elegís una, la pegáis en el Mapa y descontáis el coste en Eco.',
      'Son el equivalente digital de las fichas impresas del juego físico.',
    ],
  },
  {
    id: 'facilitador',
    title: 'Rol del facilitador',
    icon: '👩‍🏫',
    body: [
      'Crea turmas/empresas en «Turmas», genera enlace e inscribe participantes.',
      'En la sala: sincroniza diapositivas, observa el tablero, activa «Modo emergencia» solo si hace falta mover por alguien.',
      'Coaching 1:1: sala sin tablero colectivo, solo vídeo y mapa del alumno.',
    ],
  },
  {
    id: 'turnos',
    title: 'Turnos y equipos',
    icon: '👥',
    body: [
      'Varios alumnos = un peón cada uno; el turno rota en orden.',
      'Una empresa/turma = misma partida y mismo enlace de convite.',
    ],
  },
];
