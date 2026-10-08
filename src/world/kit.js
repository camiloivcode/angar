import { Materials as M } from '../look/materials.js';
import { FLOOR_HEIGHT } from '../model/program.js';

/** Piezas de mobiliario instanciadas, adaptadas del kit de Sena-valley. Coordenadas del mundo; y0 es la cota del piso del nivel. */
export function makeKit(batch, y0) {
  const floor = y0 + 0.04;
  const box = (mat, x, y, z, w, h, d, ry = 0) => batch.box(mat, [x, y, z], [w, h, d], [0, ry, 0]);
  const block = (mat, x, z, w, h, d, lift = 0, ry = 0) => box(mat, x, floor + lift + h / 2, z, w, h, d, ry);
  const cyl = (mat, x, y, z, r, h, rot = [0, 0, 0]) => batch.cylinder(mat, [x, y, z], [r, h, r], rot);
  const desk = (x, z, w = 1.6, d = 0.8, mat = M.laminateWood) => {
    block(mat, x, z, w, 0.04, d, 0.7);
    [-1, 1].forEach(s => block(M.darkAluminumMullion, x + s * (w / 2 - 0.05), z, 0.05, 0.7, d * 0.85));
  };
  // La silla mira hacia (sin ry, cos ry); el respaldo queda detrás. Laterales en U en vez de cuatro patas.
  const chair = (x, z, ry = 0, mat = M.fabricGrey) => {
    const rx = Math.cos(ry), rz = -Math.sin(ry);
    block(mat, x, z, 0.45, 0.06, 0.45, 0.44, ry);
    [-1, 1].forEach(s => block(M.darkAluminumMullion, x + rx * s * 0.19, z + rz * s * 0.19, 0.04, 0.44, 0.4, 0, ry));
    block(mat, x - Math.sin(ry) * 0.21, z - Math.cos(ry) * 0.21, 0.45, 0.42, 0.05, 0.5, ry);
  };
  const monitor = (x, z, lift = 0.74) => { block(M.screenGlow, x, z, 0.56, 0.33, 0.03, lift + 0.12); block(M.darkCharcoal, x, z, 0.06, 0.12, 0.06, lift); };
  const sofa = (x, z, w, ry, mat) => {
    const nx = Math.sin(ry), nz = Math.cos(ry);
    block(mat, x, z, w, 0.4, 0.85, 0, ry);
    block(mat, x - nx * 0.4, z - nz * 0.4, w, 0.45, 0.15, 0.4, ry);
  };
  const stool = (x, z, lift = 0.65, mat = M.darkAluminumMullion) => { cyl(mat, x, floor + lift + 0.02, z, 0.18, 0.04); cyl(mat, x, floor + lift / 2, z, 0.03, lift); };
  const plant = (x, z) => { cyl(M.warmConcrete, x, floor + 0.25, z, 0.32, 0.5); cyl(M.planterGreen, x, floor + 1.0, z, 0.42, 1.0); };
  const pendant = (x, z, drop = 0.9, mat = M.laminateWhite) => {
    const top = y0 + FLOOR_HEIGHT - 0.1;
    cyl(M.darkCharcoal, x, top - drop / 2, z, 0.008, drop);
    cyl(mat, x, top - drop - 0.09, z, 0.24, 0.18);
  };
  // Luminaria lineal de cielorraso
  const luz = (x, z, w = 1.2, d = 0.2) => box(M.interiorLightFixture, x, y0 + FLOOR_HEIGHT - 0.12, z, w, 0.03, d);
  // Estantería de metal con repisas y cajas
  const estante = (x, z, w, d, h = 2.0, ry = 0, caja = M.laminateWood) => {
    block(M.darkCharcoal, x, z, w, h, d, 0, ry);
    for (let i = 0; i < Math.max(1, Math.floor(w / 0.6)); i++) for (const lift of [0.3, 0.9, 1.5]) {
      const u = -w / 2 + 0.3 + i * 0.6;
      block(i % 2 ? caja : M.senaOrange, x + Math.cos(ry) * u, z - Math.sin(ry) * u, 0.5, 0.35, d + 0.04, lift, ry);
    }
  };
  return { floor, box, block, cyl, desk, chair, monitor, sofa, stool, plant, pendant, luz, estante };
}
