import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft, muestrear } from './geometria.js';

/**
 * Parque automotor: sedán, hatchback, SUV y pickup, más motos. Cada pieza (pintura, vidrio, molduras, faros, ruedas…) es un InstancedMesh por tipo,
 * así que 60 carros cuestan unas decenas de llamadas de dibujo. Eje local: largo en z (frente +z), ancho en x, alto en y; origen en el suelo.
 * Carrocería por secciones suavizadas (misma técnica que las aeronaves) con cabina de vidrio, techo pintado y pilares.
 */
const RAD = Math.PI / 180, V = (x, y, z) => new THREE.Vector3(x, y, z);
const caja = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
/** Barra de sección cuadrada entre dos puntos (pilares). */
function barra(p0, p1, ancho, esp) {
  const a = V(...p0), b = V(...p1), d = b.clone().sub(a), g = new THREE.BoxGeometry(ancho, esp, d.length());
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().normalize())); return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
/** Punto sobre la superficie de la cabina a la altura z y ángulo φ (0 = techo, 90° = costado), ligeramente hacia afuera. */
function sup(est, z, phi, afuera = 1.02) {
  const { filas, tz } = muestrear(est, 60), f = filas[Math.max(0, Math.min(60, Math.round(tz(z) * 60)))], p = phi * RAD, s = Math.sin(p), c = Math.cos(p), k = 2 / f.e;
  return [Math.sign(s) * Math.abs(s) ** k * f.w / 2 * afuera, Math.sign(c) * Math.abs(c) ** k * f.h / 2 * afuera + f.yc, z];
}
/** Neumático con flancos redondeados (eje en x). */
const llanta = (R, w) => new THREE.LatheGeometry([[R * 0.6, -w / 2], [R * 0.9, -w / 2], [R * 0.99, -w * 0.32], [R, 0], [R * 0.99, w * 0.32], [R * 0.9, w / 2], [R * 0.6, w / 2]].map(([r, y]) => new THREE.Vector2(r, y)), 20).rotateZ(Math.PI / 2);
/** Rin: disco, buje y cinco radios (eje en x). */
function rin(R, w) {
  const gs = [new THREE.CylinderGeometry(R * 0.62, R * 0.62, w * 0.7, 20).rotateZ(Math.PI / 2), new THREE.CylinderGeometry(R * 0.16, R * 0.16, w * 0.95, 10).rotateZ(Math.PI / 2)];
  for (let k = 0; k < 5; k++) gs.push(new THREE.BoxGeometry(w * 0.9, R * 0.1, R * 0.62).translate(0, 0, R * 0.31).rotateX(k * 72 * RAD));
  return mergeGeometries(gs);
}

// Cada tipo: estaciones [z, ancho, alto, yc, exponente] del cuerpo y de la cabina, ruedas y accesorios.
const TIPOS = {
  sedan: { L: 4.45, W: 1.74, R: 0.31, rz: [1.33, -1.33], rx: 0.76, bw: 0.2,
    cuerpo: [[2.22, 1.40, 0.40, 0.52, 3.2], [2.05, 1.64, 0.56, 0.58, 3.4], [1.4, 1.74, 0.66, 0.62, 3.6], [0, 1.76, 0.72, 0.62, 3.6], [-1.4, 1.76, 0.72, 0.64, 3.6], [-2.0, 1.68, 0.62, 0.66, 3.4], [-2.22, 1.46, 0.46, 0.62, 3.2]],
    cabina: [[1.0, 1.50, 0.10, 0.95, 3], [0.72, 1.54, 0.40, 1.17, 3.2], [0, 1.54, 0.50, 1.22, 3.4], [-0.95, 1.52, 0.46, 1.20, 3.4], [-1.45, 1.44, 0.16, 1.02, 3.2]], techo: 1.47, zA: [1.0, 0.45], zC: [-1.0, -1.45], extra: () => [] },
  hatch: { L: 3.75, W: 1.66, R: 0.29, rz: [1.2, -1.2], rx: 0.72, bw: 0.18,
    cuerpo: [[1.88, 1.30, 0.38, 0.52, 3.2], [1.7, 1.52, 0.54, 0.58, 3.4], [1.1, 1.60, 0.64, 0.62, 3.6], [0, 1.62, 0.70, 0.64, 3.6], [-1.2, 1.62, 0.72, 0.68, 3.6], [-1.72, 1.54, 0.60, 0.70, 3.4], [-1.88, 1.36, 0.48, 0.68, 3.2]],
    cabina: [[0.85, 1.38, 0.10, 0.97, 3], [0.55, 1.42, 0.44, 1.2, 3.2], [-0.1, 1.42, 0.56, 1.27, 3.4], [-1.1, 1.40, 0.56, 1.28, 3.4], [-1.7, 1.34, 0.34, 1.1, 3.2]], techo: 1.55, zA: [0.85, 0.4], zC: [-1.1, -1.7], extra: () => [] },
  suv: { L: 4.35, W: 1.82, R: 0.35, rz: [1.34, -1.33], rx: 0.79, bw: 0.24,
    cuerpo: [[2.18, 1.50, 0.46, 0.66, 3.2], [2.0, 1.76, 0.62, 0.72, 3.4], [1.4, 1.82, 0.72, 0.76, 3.6], [0, 1.84, 0.80, 0.78, 3.6], [-1.4, 1.84, 0.80, 0.80, 3.6], [-2.0, 1.78, 0.70, 0.80, 3.4], [-2.18, 1.56, 0.54, 0.76, 3.2]],
    cabina: [[0.9, 1.60, 0.12, 1.14, 3], [0.6, 1.64, 0.52, 1.42, 3.2], [-0.2, 1.64, 0.62, 1.5, 3.4], [-1.4, 1.62, 0.60, 1.5, 3.4], [-2.05, 1.5, 0.3, 1.3, 3.2]], techo: 1.81, zA: [0.9, 0.4], zC: [-1.4, -2.05],
    extra: () => [[caja(0.04, 0.05, 1.9, 0.56, 1.81, -0.45), 'trim'], [caja(0.04, 0.05, 1.9, -0.56, 1.81, -0.45), 'trim'], [caja(1.86, 0.1, 3.9, 0, 0.3, 0), 'trim']] },   // barras de techo y molduras inferiores
  pickup: { L: 5.25, W: 1.9, R: 0.38, rz: [1.6, -1.55], rx: 0.82, bw: 0.26,
    cuerpo: [[2.62, 1.58, 0.5, 0.7, 3.2], [2.4, 1.84, 0.66, 0.76, 3.4], [1.8, 1.9, 0.78, 0.8, 3.6], [0.6, 1.9, 0.84, 0.82, 3.6], [-0.45, 1.9, 0.8, 0.82, 3.6]],
    cabina: [[1.05, 1.62, 0.12, 1.2, 3], [0.75, 1.68, 0.5, 1.44, 3.2], [0, 1.68, 0.62, 1.5, 3.4], [-0.55, 1.66, 0.5, 1.46, 3.4]], techo: 1.81, zA: [1.05, 0.5], zC: [-0.4, -0.55], techoSt: [[0.75, 1.68, 0.5, 1.44, 3.2], [0, 1.68, 0.62, 1.5, 3.4], [-0.55, 1.66, 0.5, 1.46, 3.4]],
    extra: () => [[caja(1.76, 0.08, 2.0, 0, 0.96, -1.55), 'paint'], [caja(0.08, 0.5, 2.1, 0.92, 1.22, -1.5), 'paint'], [caja(0.08, 0.5, 2.1, -0.92, 1.22, -1.5), 'paint'], [caja(1.9, 0.5, 0.08, 0, 1.22, -2.6), 'paint'], [caja(1.9, 0.5, 0.08, 0, 1.22, -0.5), 'paint'],
      [caja(1.7, 0.04, 2.0, 0, 1.0, -1.55), 'trim'], [caja(2.0, 0.22, 0.14, 0, 0.5, -2.64), 'trim'], [caja(1.9, 0.18, 4.8, 0, 0.36, 0.1), 'trim']] },   // caja, cubierta de caja, parachoques y estribos
};

function geometriasDe(t) {
  const P = [], G = [], T = [], FD = [], FT = [], PL = [];
  const lower = loft(t.cuerpo, { n: 36, m: 20 }).geo;
  P.push(lower);
  const cab = loft(t.cabina, { n: 30, m: 24 }).geo; G.push(cab);
  P.push(loft(t.techoSt ?? t.cabina.slice(1, -1), { n: 24, m: 24, phi0: -52, phi1: 52, escala: 1.012, cerrar: false }).geo);                          // techo pintado
  const [zA0, zA1] = t.zA, [zC0, zC1] = t.zC, zB = (zA1 + zC0) / 2 - 0.05, esp = 0.05;
  for (const s of [1, -1]) {
    const m = ([x, y, z]) => [s * x, y, z], c = t.cabina;
    P.push(barra(m(sup(c, zA0, 98)), m(sup(c, zA1, 54)), esp, esp));                                  // pilar A
    P.push(barra(m(sup(c, zC0, 98)), m(sup(c, zC1, 54)), 0.07, 0.07));                                 // pilar C
    P.push(barra(m(sup(c, zB, 98)), m(sup(c, zB, 54)), esp, esp));                                     // pilar B
    P.push(caja(0.1, 0.07, 0.16, s * (t.W / 2 + 0.04), c[1][3] - 0.12, zA0 - 0.1));                    // espejo
    FD.push(caja(0.34, 0.12, 0.08, s * (t.W / 2 - 0.4), t.cuerpo[1][3] + 0.04, t.L / 2 - 0.02));       // faros delanteros
    FT.push(caja(0.36, 0.12, 0.08, s * (t.W / 2 - 0.34), t.cuerpo[t.cuerpo.length - 2][3] + 0.1, -t.L / 2 + 0.02));   // luces traseras
  }
  T.push(caja(t.W * 0.82, 0.14, 0.1, 0, t.cuerpo[1][3] - 0.22, t.L / 2 - 0.05), caja(t.W * 0.82, 0.14, 0.1, 0, t.cuerpo[t.cuerpo.length - 2][3] - 0.22, -t.L / 2 + 0.05),   // parachoques
    caja(t.W * 0.5, 0.15, 0.06, 0, t.cuerpo[1][3] + 0.02, t.L / 2 - 0.01), caja(t.W * 0.96, 0.07, t.L * 0.62, 0, t.cuerpo[2][3] - t.cuerpo[2][2] / 2 + 0.02, 0));          // parrilla y faldones
  PL.push(caja(0.33, 0.16, 0.02, 0, t.cuerpo[1][3] - 0.2, t.L / 2 + 0.02), caja(0.33, 0.16, 0.02, 0, t.cuerpo[t.cuerpo.length - 2][3] - 0.12, -t.L / 2 - 0.02));
  for (const [g, k] of t.extra()) ({ paint: P, trim: T })[k].push(g);
  const R = t.R;
  return { paint: mergeGeometries(P), glass: mergeGeometries(G), trim: mergeGeometries(T), faroD: mergeGeometries(FD), faroT: mergeGeometries(FT), placa: mergeGeometries(PL), neum: llanta(R, t.bw), rin: rin(R, t.bw), neumBox: R };
}

let _m;
const mats = () => _m ??= {
  paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0f1c24, roughness: 0.05, metalness: 0.55 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.7, metalness: 0.2 }),
  faroD: new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffeab0, emissiveIntensity: 0.55, roughness: 0.2 }),
  faroT: new THREE.MeshStandardMaterial({ color: 0xb01818, emissive: 0x8a0808, emissiveIntensity: 0.6, roughness: 0.3 }),
  placa: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 }),       // placas amarillas colombianas
  neum: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }),
  rin: new THREE.MeshStandardMaterial({ color: 0xc6cbd0, roughness: 0.28, metalness: 0.85 }),
};
// Colores frecuentes en Colombia: blancos, plateados y grises dominan, con negros, rojos, azules y beige.
const COLORES = [0xf4f4f1, 0xf4f4f1, 0xf4f4f1, 0xd9dcdf, 0xb9bec4, 0x8a9096, 0x2a2d31, 0x1c1d20, 0xa5242b, 0x2c4f8f, 0xcdbf9d, 0x3b6a52];
const ORDEN_TIPOS = ['sedan', 'hatch', 'suv', 'pickup', 'sedan', 'suv', 'hatch', 'sedan'];

/** `cars`: [{ x, z, rotY, tipo? }]. rotY 0 mira hacia +z. */
export function buildCarFleet(group, cars) {
  const M = mats(), dummy = new THREE.Object3D(), local = new THREE.Matrix4(), out = new THREE.Matrix4(), color = new THREE.Color();
  for (const [nombre, t] of Object.entries(TIPOS)) {
    const lista = cars.map((c, i) => ({ ...c, tipo: c.tipo ?? ORDEN_TIPOS[(i * 3 + (i >> 1)) % ORDEN_TIPOS.length], i })).filter(c => c.tipo === nombre);
    if (!lista.length) continue;
    const geo = geometriasDe(t), n = lista.length, im = (g, m, k = n) => { const x = new THREE.InstancedMesh(g, m, k); x.castShadow = true; group.add(x); return x; };
    const mesh = { paint: im(geo.paint, M.paint), glass: im(geo.glass, M.glass), trim: im(geo.trim, M.trim), faroD: im(geo.faroD, M.faroD), faroT: im(geo.faroT, M.faroT), placa: im(geo.placa, M.placa),
      neum: im(geo.neum, M.neum, n * 4), rin: im(geo.rin, M.rin, n * 4) };
    lista.forEach((c, k) => {
      dummy.position.set(c.x, 0, c.z); dummy.rotation.y = c.rotY ?? 0; dummy.updateMatrix();
      for (const key of ['paint', 'glass', 'trim', 'faroD', 'faroT', 'placa']) mesh[key].setMatrixAt(k, dummy.matrix);
      mesh.paint.setColorAt(k, color.setHex(COLORES[(c.i * 5 + (c.i >> 2) + nombre.length) % COLORES.length]));
      let w = 0;
      for (const z of t.rz) for (const s of [1, -1]) { out.multiplyMatrices(dummy.matrix, local.makeTranslation(s * (t.W / 2 - 0.12), t.R, z)); mesh.neum.setMatrixAt(k * 4 + w, out); mesh.rin.setMatrixAt(k * 4 + w, out); w++; }
    });
    for (const m of Object.values(mesh)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}

/** Motos (muy comunes en Barranquilla): `motos`: [{ x, z, rotY }]. Mismo eje que los carros. */
export function buildMotos(group, motos) {
  if (!motos.length) return;
  const M = mats(), R = 0.31, P = [], T = [], ME = [], FD = [], FT = [], PL = [];
  const cap = (r, l, x, y, z, ry = 0) => new THREE.CapsuleGeometry(r, l, 4, 10).rotateX(Math.PI / 2).rotateY(ry).translate(x, y, z);
  P.push(cap(0.17, 0.34, 0, 0.88, 0.12), new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.9, 1.1).translate(0, 0.96, 0.62), caja(0.34, 0.06, 0.62, 0, 0.62, -0.58));       // tanque, carenado y guardabarro
  T.push(caja(0.3, 0.1, 0.7, 0, 0.82, -0.24), barra([0.04, 0.86, 0.38], [0.04, 1.02, 0.42], 0.03, 0.03), caja(0.74, 0.03, 0.03, 0, 1.04, 0.42), caja(0.34, 0.26, 0.5, 0, 0.5, 0.02));
  ME.push(barra([0.1, 0.9, 0.5], [0.09, R, 0.66], 0.045, 0.045), barra([-0.1, 0.9, 0.5], [-0.09, R, 0.66], 0.045, 0.045), barra([0, 0.5, -0.1], [0, R, -0.62], 0.06, 0.05), new THREE.CylinderGeometry(0.045, 0.06, 0.95, 8).rotateX(Math.PI / 2).translate(0.2, 0.36, -0.25), caja(0.08, 0.1, 0.1, 0.38, 1.1, 0.42), caja(0.08, 0.1, 0.1, -0.38, 1.1, 0.42));
  FD.push(caja(0.2, 0.14, 0.06, 0, 0.96, 0.8)); FT.push(caja(0.2, 0.06, 0.05, 0, 0.72, -0.92)); PL.push(caja(0.2, 0.14, 0.02, 0, 0.6, -0.95));
  const geo = { paint: mergeGeometries(P), trim: mergeGeometries(T), metal: mergeGeometries(ME), faroD: mergeGeometries(FD), faroT: mergeGeometries(FT), placa: mergeGeometries(PL), neum: llanta(R, 0.11), rin: rin(R, 0.11) };
  const mat = { paint: M.paint, trim: M.trim, metal: M.rin, faroD: M.faroD, faroT: M.faroT, placa: M.placa, neum: M.neum, rin: M.rin };
  const n = motos.length, dummy = new THREE.Object3D(), local = new THREE.Matrix4(), out = new THREE.Matrix4(), color = new THREE.Color(), colores = [0x1c1d20, 0xa5242b, 0x2c4f8f, 0xf4f4f1, 0x1c1d20, 0x8a9096];
  const mesh = Object.fromEntries(Object.keys(geo).map(k => { const m = new THREE.InstancedMesh(geo[k], mat[k], k === 'neum' || k === 'rin' ? n * 2 : n); m.castShadow = true; m.userData.obstaculo = true; group.add(m); return [k, m]; }));
  motos.forEach((c, i) => {
    dummy.position.set(c.x, 0, c.z); dummy.rotation.y = c.rotY ?? 0; dummy.updateMatrix();
    for (const k of ['paint', 'trim', 'metal', 'faroD', 'faroT', 'placa']) mesh[k].setMatrixAt(i, dummy.matrix);
    mesh.paint.setColorAt(i, color.setHex(colores[i % colores.length]));
    [0.66, -0.62].forEach((z, w) => { out.multiplyMatrices(dummy.matrix, local.makeTranslation(0, R, z)); mesh.neum.setMatrixAt(i * 2 + w, out); mesh.rin.setMatrixAt(i * 2 + w, out); });
  });
  for (const m of Object.values(mesh)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
