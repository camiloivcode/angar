import { Materials as M } from '../look/materials.js';

/**
 * Amoblado por tipo de recinto. `r` está en coordenadas del mundo: {x0, x1, z0, z1, lado, tipo, cap, puestos}.
 * Se usa un marco local (u a lo ancho, v desde el muro opuesto a la puerta hasta la puerta) para no repetir el giro por recinto.
 */
export function amoblar(kit, r) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0, sur = r.lado === 's';          // puerta al sur → tablero al norte
  const X = u => r.x0 + u, Z = v => sur ? r.z0 + v : r.z1 - v, ry = sur ? Math.PI : 0, cara = sur ? 0 : Math.PI;
  const c = { w, d, X, Z, ry, cara, kit, r, n: Math.min(r.puestos || r.cap || 25, 200) };
  (F[r.tipo] ?? F.aula)(c);
}

// Cuadrícula de puestos mirando al tablero. `fn(x, z)` pone lo que va en cada puesto.
function rejilla({ w, d, X, Z }, cols, filas, v0, paso, fn, margen = 0.5) {
  const pu = (w - 2 * margen) / cols;
  for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) fn(X(margen + pu * (i + 0.5)), Z(v0 + j * paso), i, j);
}
const tablero = ({ kit, X, Z, w }, ancho = 3.2) => {
  kit.block(M.laminateWhite, X(w * 0.45), Z(0.1), Math.min(w * 0.7, ancho), 1.1, 0.05, 0.9);
  kit.block(M.screenGlow, X(w - 0.8), Z(0.12), 1.1, 0.62, 0.05, 1.5);                                  // televisor
};
const instructor = ({ kit, X, Z, ry, w }) => { kit.desk(X(w * 0.25), Z(1.3), 1.4, 0.7); kit.chair(X(w * 0.25), Z(1.9), ry, M.fabricBlue); kit.plant(X(0.4), Z(0.5)); };

// Bancos de laboratorio: dos filas de bancos largos con banquillos.
function bancos(c, filas = 2, mat = M.laminateWhite) {
  const { kit, X, Z, w } = c, n = Math.max(1, Math.floor((w - 0.6) / 3.4));
  for (let j = 0; j < filas; j++) for (let i = 0; i < n; i++) {
    const x = X(0.3 + (w - 0.6) / n * (i + 0.5)), z = Z(3.3 + j * 2.4);
    kit.desk(x, z, Math.min(3.0, (w - 0.6) / n - 0.3), 0.9, mat);
    [-0.9, 0.9].forEach(dx => kit.stool(x + dx, z + (c.r.lado === 's' ? 0.75 : -0.75), 0.62));
  }
}
const panelPared = (c, items, mat = M.darkCharcoal) => items.forEach(u => {
  c.kit.block(mat, c.X(u), c.Z(0.25), 0.9, 1.9, 0.35);
  c.kit.block(M.screenGlow, c.X(u), c.Z(0.45), 0.6, 0.35, 0.03, 1.2);
});
const mesaConSillas = (kit, x, z, n = 4, ry = 0) => {
  kit.desk(x, z, 1.4, 0.8);
  for (let k = 0; k < n; k++) kit.chair(x + (k % 2 ? 0.45 : -0.45), z + (k < 2 ? 0.75 : -0.75), k < 2 ? Math.PI : 0, M.fabricBlue);
};
const lockers = ({ kit, X, Z }, u0, u1) => { for (let u = u0; u <= u1; u += 0.5) kit.block(M.stainlessSteel, X(u), Z(0.3), 0.45, 1.9, 0.5); };

const F = {
  aula(c) {
    const { kit, ry, w, d } = c, cols = Math.max(2, Math.floor((w - 0.8) / 0.95)), filas = Math.ceil(25 / cols);
    tablero(c); instructor(c);
    let k = 0;
    rejilla(c, cols, filas, 2.6, Math.min(1.15, (d - 3.4) / filas), (x, z) => {
      if (k++ >= 25) return;
      kit.desk(x, z, 0.8, 0.5); kit.chair(x, z + (c.r.lado === 's' ? 0.55 : -0.55), ry, M.fabricGrey);
    });
  },
  informatica(c) {
    const { kit, ry, w, d } = c, cols = Math.max(2, Math.floor((w - 0.8) / 1.1)), filas = Math.ceil(25 / cols);
    tablero(c); instructor(c);
    let k = 0;
    rejilla(c, cols, filas, 2.6, Math.min(1.2, (d - 3.4) / filas), (x, z) => {
      if (k++ >= 25) return;
      kit.desk(x, z, 0.95, 0.6, M.laminateWhite); kit.monitor(x, z + (c.r.lado === 's' ? -0.1 : 0.1)); kit.chair(x, z + (c.r.lado === 's' ? 0.6 : -0.6), ry, M.darkCharcoal);
    });
  },
  multiple(c) {
    const { kit, ry, w, d, X, Z } = c, cols = Math.floor((w - 1.5) / 0.55), filas = Math.ceil(c.r.cap / cols);
    kit.block(M.woodParquet, X(w / 2), Z(1.0), Math.min(w * 0.5, 8), 0.25, 1.8);                       // tarima
    kit.block(M.laminateWhite, X(w / 2), Z(0.15), Math.min(w * 0.45, 6), 2.2, 0.05, 0.5);              // pantalla
    kit.desk(X(w * 0.3), Z(1.0), 0.7, 0.5, M.laminateWood);
    let k = 0;
    rejilla(c, cols, filas, 3.0, Math.min(0.9, (d - 4) / filas), (x, z) => { if (k++ < c.r.cap) kit.chair(x, z, ry, M.auditoriumSeatingRed); }, 0.75);
  },
  'lab-electricidad'(c) { bancos(c); panelPared(c, [c.w * 0.2, c.w * 0.4, c.w * 0.6, c.w * 0.8]); c.kit.block(M.stainlessSteel, c.X(c.w / 2), c.Z(3.3), 0.3, 0.18, 0.28, 0.74); },
  'lab-avionica'(c) {
    bancos(c);
    for (let u = 0.8; u < c.w - 0.5; u += 1.0) c.kit.block(M.darkCharcoal, c.X(u), c.Z(0.4), 0.7, 2.0, 0.8);   // racks
    panelPared(c, [c.w * 0.3, c.w * 0.7], M.laminateWhite);
  },
  'lab-instrumentos'(c) { bancos(c); panelPared(c, [0.8, 2.0, 3.2, 4.4, c.w - 1], M.darkAluminumMullion); [1, 3, 5].forEach(u => c.kit.cyl(M.stainlessSteel, c.X(Math.min(u, c.w - 0.5)), c.kit.floor + 0.5, c.Z(8.2), 0.25, 1.0)); },
  'lab-hidraulica'(c) {
    bancos(c, 1);
    [0.8, 2.2, 3.6].forEach(u => c.kit.cyl(M.stainlessSteel, c.X(Math.min(u, c.w - 0.6)), c.kit.floor + 0.9, c.Z(0.6), 0.4, 1.8));          // tanques
    c.kit.box(M.senaOrange, c.X(c.w / 2), c.kit.floor + 2.2, c.Z(0.25), c.w - 1, 0.1, 0.1);                                                    // tuberías
    c.kit.block(M.darkCharcoal, c.X(c.w * 0.7), c.Z(6.5), 1.6, 0.9, 0.8);
  },
  'lab-compuestos'(c) {
    bancos(c, 1, M.laminateWood);
    c.kit.block(M.stainlessSteel, c.X(Math.min(1.2, c.w - 1)), c.Z(0.9), 1.6, 1.4, 1.2);                       // horno de curado
    c.kit.block(M.ductGalvanized, c.X(c.w * 0.65), c.Z(0.7), 1.4, 0.5, 0.8, 1.7);                              // campana de extracción
    [0.6, 1.0].forEach(u => c.kit.cyl(M.fabricGrey, c.X(c.w - u), c.kit.floor + 0.15, c.Z(7.6), 0.18, 1.2, [0, 0, Math.PI / 2]));   // rollos de fibra
  },
  banos(c) {
    const { kit, w, d, X, Z } = c, n = Math.max(2, Math.floor((w - 1) / 1.0));
    for (let i = 0; i < n; i++) {                                                                               // cubículos con inodoro
      kit.block(M.laminateWhite, X(0.5 + i), Z(1.6), 0.05, 1.9, 2.0, 0.15);
      kit.block(M.laminateWhite, X(1.0 + i), Z(0.9), 0.5, 0.4, 0.7);
    }
    for (let i = 0; i < Math.max(2, Math.floor(w / 1.4)); i++) { kit.block(M.stainlessSteel, X(0.7 + i * 1.4), Z(d - 0.6), 0.5, 0.15, 0.4, 0.85); kit.block(M.lowEGlass, X(0.7 + i * 1.4), Z(d - 0.25), 0.7, 0.9, 0.02, 1.2); }
  },
  recepcion(c) {
    const { kit, X, Z, w, ry } = c;
    kit.block(M.laminateWood, X(w * 0.5), Z(3.0), 3.6, 1.1, 0.8); kit.block(M.laminateWhite, X(w * 0.5), Z(3.0), 3.8, 0.05, 1.0, 1.1);
    kit.monitor(X(w * 0.5 - 0.8), Z(2.9), 1.16); kit.chair(X(w * 0.5 - 0.8), Z(2.2), c.cara, M.fabricBlue);
    kit.sofa(X(w * 0.3), Z(6.5), 2.2, ry, M.senaOrange); kit.sofa(X(w * 0.7), Z(6.5), 2.2, ry, M.fabricBlue); kit.plant(X(0.5), Z(8));
  },
  direccion(c) { const { kit, X, Z, w, ry } = c; kit.desk(X(w / 2), Z(3), 1.8, 0.9); kit.chair(X(w / 2), Z(2.2), c.cara, M.darkCharcoal); kit.chair(X(w / 2 - 0.5), Z(4.1), ry); kit.chair(X(w / 2 + 0.5), Z(4.1), ry); kit.estante(X(w / 2), Z(0.35), Math.max(1.2, w - 0.6), 0.4); kit.plant(X(0.4), Z(8)); },
  coordinacion(c) {
    const { kit, X, Z, w, ry } = c;
    for (let i = 0; i < 6; i++) { const x = X(0.8 + (i % 3) * Math.max(1.0, (w - 1.2) / 3)), z = Z(2.5 + Math.floor(i / 3) * 3.2); kit.desk(x, z, 1.1, 0.7); kit.monitor(x, z); kit.chair(x, z + 0.7, ry, M.fabricBlue); }
    kit.estante(X(w / 2), Z(0.35), w - 0.8, 0.4);
  },
  juntas(c) {
    const { kit, X, Z, w, d } = c, L = Math.min(w - 2, 6);
    kit.block(M.laminateWood, X(w / 2), Z(d / 2), L, 0.05, 1.4, 0.74);
    for (let i = 0; i < 7; i++) [-1, 1].forEach(s => kit.chair(X(w / 2 - L / 2 + 0.5 + i * (L - 1) / 6), Z(d / 2 + s * 1.0), s > 0 ? Math.PI * (c.cara ? 0 : 1) : Math.PI * (c.cara ? 1 : 0), M.fabricGrey));
    kit.block(M.screenGlow, X(w / 2), Z(0.15), 2.4, 1.3, 0.05, 1.1); kit.block(M.laminateWood, X(w / 2), Z(d - 0.4), w - 1, 0.8, 0.4);
  },
  archivo(c) { const { kit, X, Z, w, d } = c; for (let j = 0; j < 3; j++) for (let i = 0; i < Math.floor((w - 0.8) / 1.2); i++) kit.block(M.stainlessSteel, X(0.8 + i * 1.2), Z(1.6 + j * 2.6), 1.0, 1.9, 0.9); kit.desk(X(w - 1), Z(d - 0.8), 1.2, 0.6); },
  cafetin(c) { const { kit, X, Z, w, d } = c; kit.block(M.laminateWood, X(w / 2), Z(0.6), w - 0.8, 1.0, 0.6); kit.block(M.stainlessSteel, X(w / 2), Z(0.6), 0.5, 0.4, 0.4, 1.0); for (let i = 0; i < 3; i++) mesaConSillas(kit, X(0.8 + i * Math.max(1, (w - 1.2) / 3)), Z(4 + (i % 2) * 2), 2); },
  oficina(c) {
    const { kit, X, Z, w, d, ry } = c, cols = Math.max(3, Math.floor((w - 0.6) / 1.5)), filas = Math.ceil(21 / cols);
    let k = 0;
    rejilla(c, cols, filas, 1.5, Math.min(2.3, (d - 2.5) / filas), (x, z) => {
      if (k++ >= 21) return;
      kit.desk(x, z, 1.3, 0.7); kit.monitor(x, z); kit.chair(x, z + (c.r.lado === 's' ? 0.65 : -0.65), ry, M.fabricBlue); kit.block(M.fabricGrey, x, z + (c.r.lado === 's' ? -0.45 : 0.45), 1.3, 0.9, 0.04, 0.74);
    }, 0.4);
    kit.plant(X(w - 0.4), Z(d - 0.5));
  },
  'equipos-tierra'(c) {   // las máquinas (remolcador, tractor, plataformas, gatos…) las coloca el constructor del bloque; aquí, estantería y mesa de herramienta
    const { kit, X, Z, w, d } = c;
    const lej = c.r.ladoHangar === 'der' ? 0.35 : w - 0.35, otro = c.r.ladoHangar === 'der' ? w - 1.2 : 1.2;
    kit.estante(X(lej), Z(d * 0.5), 5.0, 0.5, 2.0, Math.PI / 2); kit.block(M.darkCharcoal, X(otro), Z(d - 0.7), 1.2, 0.9, 0.7); kit.block(M.laminateWhite, X(otro), Z(d - 0.7), 1.3, 0.05, 0.8, 0.9);
  },
  almacen(c) {
    const { kit, X, Z, w, d } = c;
    const mx = c.r.ladoHangar === 'der' ? w - 1.2 : 1.2;
    kit.block(M.laminateWood, X(mx), Z(d - 1.4), 0.7, 1.1, 2.2); kit.block(M.laminateWhite, X(mx), Z(d - 1.4), 0.8, 0.05, 2.4, 1.1);   // mostrador
    for (let i = 0; i < Math.max(2, Math.floor((w - 2) / 1.6)); i++) { kit.estante(X(0.8 + i * 1.6), Z(2.5), 0.9, 4.2, 2.2, Math.PI / 2); kit.estante(X(0.8 + i * 1.6), Z(6.4), 0.9, 2.0, 2.2, Math.PI / 2); }
  },
  cuarentena(c) {
    const { kit, X, Z, w, d } = c;
    for (let u = 0.2; u <= w - 0.1; u += 0.9) { kit.block(M.stainlessSteel, X(u), Z(0.2), 0.06, 2.2, 0.06); kit.block(M.stainlessSteel, X(u), Z(d - 0.2), 0.06, 2.2, 0.06); }   // jaula
    kit.block(M.auditoriumSeatingRed, X(w / 2), Z(d - 0.2), w - 0.4, 0.3, 0.04, 1.0);                         // cinta de cuarentena
    kit.estante(X(w / 2), Z(0.8), Math.max(1.2, w - 0.8), 0.6, 2.2);
    for (let i = 0; i < 4; i++) kit.block(M.safetyYellow, X(0.8 + i * 0.9), Z(3), 0.6, 0.4, 0.5, 0);
    kit.block(M.auditoriumSeatingRed, X(w / 2), Z(1.9), 1.2, 0.5, 0.05, 1.4);                                 // letrero
  },
  bombas(c) {
    const { kit, X, Z, w } = c;
    [0.8, 2.0].forEach(u => kit.cyl(M.stainlessSteel, X(Math.min(u, w - 0.6)), kit.floor + 1.1, Z(1.3), 0.5, 2.2));   // tanques de aire
    kit.block(M.senaGreen, X(w / 2), Z(4.2), 1.2, 1.0, 0.8); kit.block(M.darkCharcoal, X(w / 2), Z(6.3), 1.0, 0.8, 0.7);
    kit.box(M.ductGalvanized, X(w / 2), kit.floor + 2.4, Z(0.5), w - 0.6, 0.12, 0.12);
  },
  enfermeria(c) {
    const { kit, X, Z, w, ry } = c;
    kit.block(M.laminateWhite, X(w - 0.8), Z(3.2), 0.8, 0.3, 2.0, 0.55); kit.block(M.fabricBlue, X(w - 0.8), Z(3.2), 0.78, 0.12, 1.9, 0.85);
    kit.desk(X(1.0), Z(7), 1.2, 0.6); kit.chair(X(1.0), Z(7.6), ry, M.fabricBlue); kit.block(M.auditoriumSeatingRed, X(0.4), Z(0.25), 0.7, 0.6, 0.15, 1.3);
  },
  instructores(c) {
    const { kit, X, Z, w, ry } = c;
    for (let i = 0; i < 8; i++) { const x = X(0.7 + (i % 4) * Math.max(1.1, (w - 1.0) / 4)), z = Z(3 + Math.floor(i / 4) * 3.2); kit.desk(x, z, 1.1, 0.7); kit.monitor(x, z); kit.chair(x, z + 0.7, ry, M.fabricBlue); }
    lockers(c, 0.4, Math.min(w - 0.4, 4));
  },
  cafeteria(c) {
    const { kit, X, Z, w, d } = c;
    kit.block(M.laminateWood, X(w - 1.0), Z(d / 2), 0.7, 1.1, d - 1.5); kit.block(M.stainlessSteel, X(w - 1.0), Z(d / 2), 0.9, 0.05, d - 1.4, 1.1);
    const cols = Math.floor((w - 3) / 2.4), filas = 4;
    for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) mesaConSillas(kit, X(1.2 + i * 2.4), Z(1.5 + j * 1.9), 4);
  },
  biblioteca(c) {
    const { kit, X, Z, w, d, ry } = c;
    for (let i = 0; i < Math.floor((w - 2) / 2.2); i++) { kit.estante(X(1 + i * 2.2), Z(1.6), 1.8, 0.4, 2.0, 0, M.fabricBlue); kit.estante(X(1 + i * 2.2), Z(2.4), 1.8, 0.4, 2.0, 0, M.senaGreen); }
    for (let i = 0; i < Math.floor((w - 2) / 3.2); i++) mesaConSillas(kit, X(1.5 + i * 3.2), Z(5.4), 4);
    for (let i = 0; i < 4; i++) { kit.desk(X(1 + i * 1.3), Z(d - 0.6), 1.0, 0.6, M.laminateWhite); kit.monitor(X(1 + i * 1.3), Z(d - 0.6)); kit.chair(X(1 + i * 1.3), Z(d - 1.2), ry, M.darkCharcoal); }
  },
  aseo(c) { const { kit, X, Z, w } = c; kit.estante(X(w / 2), Z(0.5), Math.max(1.0, w - 0.4), 0.5, 2.0); kit.cyl(M.stainlessSteel, X(w / 2), kit.floor + 0.3, Z(3), 0.35, 0.6); kit.block(M.safetyYellow, X(w / 2), Z(5), 0.5, 0.9, 0.4); },
};
