import { Materials as M } from '../look/materials.js';
import { SITIO as S } from '../model/program.js';

/**
 * Muros con vanos y puertas con hoja, sobre un InstanceBatcher. Todo en coordenadas de planta (x, z) y se lleva al mundo aquí.
 * Un vano es {c, w, yb, yt, vidrio}: c es el centro a lo largo del muro; con `vidrio` lleva un panel de vidrio.
 */
export function crearMuros(batch) {
  const { ox, oz } = S;
  const aabb = (mat, x0, x1, y0, y1, z0, z1) => {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    batch.box(mat, [(x0 + x1) / 2 + ox, (y0 + y1) / 2, (z0 + z1) / 2 + oz], [x1 - x0, y1 - y0, z1 - z0]);
  };

  /** eje 'x': muro a lo largo de x en z = c · eje 'z': a lo largo de z en x = c. `a0..a1` es el tramo; `y` la cota de su base. */
  function muro(mat, { eje, c, a0, a1, y = 0, h, esp = 0.15, ab = [] }) {
    const seg = (m, s0, s1, yb, yt) => eje === 'x' ? aabb(m, s0, s1, y + yb, y + yt, c - esp / 2, c + esp / 2) : aabb(m, c - esp / 2, c + esp / 2, y + yb, y + yt, s0, s1);
    let cur = a0;
    for (const o of [...ab].sort((p, q) => p.c - q.c)) {
      const s0 = Math.max(o.c - o.w / 2, a0), s1 = Math.min(o.c + o.w / 2, a1);
      if (s0 < cur - 1e-6 || s1 <= s0) continue;                                  // vano solapado o fuera del muro: se ignora
      seg(mat, cur, s0, 0, h);
      if (o.yb > 0.01) seg(mat, s0, s1, 0, o.yb);
      if (o.yt < h - 0.01) seg(mat, s0, s1, o.yt, h);
      if (o.vidrio) seg(M.lowEGlass, s0, s1, o.yb, o.yt);
      cur = s1;
    }
    seg(mat, cur, a1, 0, h);
  }

  // Hoja abierta unos 80°: bisagra en (hx, hz), dirección (dx, dz) unitaria.
  const hoja = (hx, hz, len, dx, dz, y, mat) => {
    batch.box(mat, [hx + dx * len / 2 + ox, y + 1.025, hz + dz * len / 2 + oz], [len - 0.04, 2.05, 0.04], [0, Math.atan2(-dz, dx), 0]);
  };
  const A = 80 * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A);

  /** Puerta con marco y hoja(s). `hacia` (±1) indica a qué lado del muro se abre. Eje como en `muro`. */
  function puerta({ eje, c, a, w, hacia, esp = 0.15, y = 0, doble = false, vidrio = false }) {
    const mat = vidrio ? M.lowEGlass : M.laminateWood, f = M.darkAluminumMullion, t = esp + 0.04;
    const marco = (s0, s1, yb, yt) => eje === 'x' ? aabb(f, s0, s1, y + yb, y + yt, c - t / 2, c + t / 2) : aabb(f, c - t / 2, c + t / 2, y + yb, y + yt, s0, s1);
    marco(a - w / 2 - 0.05, a - w / 2, 0, 2.1); marco(a + w / 2, a + w / 2 + 0.05, 0, 2.1); marco(a - w / 2 - 0.05, a + w / 2 + 0.05, 2.1, 2.15);
    const abre = (pos, len, signo) => {                                             // signo: +1 hoja hacia +a, -1 hacia -a desde su bisagra
      const along = signo * ca, out = hacia * sa;
      if (eje === 'x') hoja(pos, c, len, along, out, y, mat); else hoja(c, pos, len, out, along, y, mat);
    };
    if (doble) { abre(a - w / 2, w / 2, +1); abre(a + w / 2, w / 2, -1); } else abre(a - w / 2, w, +1);
  }
  return { aabb, muro, puerta };
}
