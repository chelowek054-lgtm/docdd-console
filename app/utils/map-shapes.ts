import type { NodeKind } from '../../server/lib/map-core';

/** Контуры в координатах 100 × 60; надпись располагается внутри центральной части. */
export const MAP_SHAPES: Record<NodeKind['shape'], string> = {
  rounded: 'M7 1 H93 Q99 1 99 8 V52 Q99 59 93 59 H7 Q1 59 1 52 V8 Q1 1 7 1 Z',
  rect: 'M1 1 H99 V59 H1 Z',
  note: 'M1 1 H84 L99 15 V59 H1 Z M84 1 V15 H99',
  hexagon: 'M10 1 H90 L99 30 L90 59 H10 L1 30 Z',
  person: 'M40 20 C34 18 35 1 50 1 C65 1 66 18 60 20 C80 20 97 23 99 32 V59 H1 V32 C3 23 20 20 40 20 Z',
  cylinder: 'M1 8 C1 -1 99 -1 99 8 V52 C99 61 1 61 1 52 Z M1 8 C1 17 99 17 99 8',
  queue: 'M9 1 H91 C102 1 102 59 91 59 H9 C-2 59 -2 1 9 1 Z M91 1 C80 1 80 59 91 59',
  package: 'M1 11 V1 H39 L45 11 H99 V59 H1 Z M1 11 H45',
  cloud: 'M12 51 C-4 49 0 29 10 26 C6 12 18 5 29 10 C32 -1 51 -1 57 7 C70 -2 87 5 88 17 C102 17 103 37 94 42 C98 54 79 62 69 54 C59 62 45 60 41 55 C28 63 17 60 12 51 Z'
};
