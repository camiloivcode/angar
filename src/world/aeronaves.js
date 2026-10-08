import * as THREE from 'three';
import { loft, orientar } from './geometria.js';

/**
 * Aeronaves procedurales a escala real: Cessna 206, Cessna 210, Turbo Commander 685 y Bell 206B.
 * Origen en el centro de su huella, morro hacia +z, y hacia arriba. El lado izquierdo (babor) queda en +x.
 * Librea tomada de la foto del hangar del SENA: blanco con franjas finas vino y rojo, cristales tintados.
 */
const UP = new THREE.Vector3(0, 1, 0), RAD = Math.PI / 180;
let _mat;
const mats = () => _mat ??= {
  blanco: new THREE.MeshStandardMaterial({ color: 0xf3f3f0, roughness: 0.34, metalness: 0.1 }),
  gris: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 }),
  negro: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.6, metalness: 0.2 }),
  neumatico: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95, metalness: 0 }),
  aluminio: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.3, metalness: 0.85 }),
  cromo: new THREE.MeshStandardMaterial({ color: 0xe2e5e8, roughness: 0.12, metalness: 0.95 }),
  vino: new THREE.MeshStandardMaterial({ color: 0x7a1d2b, roughness: 0.4, metalness: 0.1 }),
  rojo: new THREE.MeshStandardMaterial({ color: 0xc1272d, roughness: 0.4, metalness: 0.1 }),
  azul: new THREE.MeshStandardMaterial({ color: 0x1c2f5e, roughness: 0.4, metalness: 0.1 }),
  amarillo: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.45, metalness: 0.1 }),
  vidrio: new THREE.MeshStandardMaterial({ color: 0x1d3a44, roughness: 0.06, metalness: 0.6 }),
  luzRoja: new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1010, emissiveIntensity: 1.2 }),
  luzVerde: new THREE.MeshStandardMaterial({ color: 0x22ff55, emissive: 0x10ff40, emissiveIntensity: 1.2 }),
  luzBlanca: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }),
  forro: new THREE.MeshStandardMaterial({ color: 0xd7d3ca, roughness: 0.9, side: THREE.BackSide }),            // revestimiento interior de la cabina
  tapiz: new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.92 }),
  cuero: new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.85 }),
  alfombra: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 1 }),
  pantalla: new THREE.MeshStandardMaterial({ color: 0x0b2630, emissive: 0x1c8aa6, emissiveIntensity: 0.9, roughness: 0.2 }),
};

// ───────────────────────── utilidades de geometría ─────────────────────────

/** Anillo del perfil NACA de 4 cifras (curvatura m en p, grosor t) entre las fracciones de cuerda xa..xb: superior LE→TE y luego inferior TE→LE. */
function anillo(t, m, p, xa, xb, N = 8) {
  const xs = Array.from({ length: N + 1 }, (_, i) => xa + (xb - xa) * (1 - Math.cos(Math.PI * i / N)) / 2);
  const yt = x => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const yc = x => x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x);
  const todo = [...xs.map(x => [x, yc(x) + yt(x), 0]), ...xs.map(x => [x, yc(x) - yt(x), 1]).reverse()], out = [];
  for (const q of todo) { const l = out[out.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) out.push(q); }
  if (Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
  return out;
}

/**
 * Tramo de ala (o estabilizador) de un lado: lado=+1 babor (x+), -1 estribor. Raíz en x0, punta a x0+semi.
 * s0..s1 = tramo de la envergadura (0..1) y ca..cb = parte de la cuerda (0..1) que se dibuja: así se separan alerones, flaps y elevadores.
 */
function alaTramo({ lado = 1, x0 = 0, semi, c0, c1, zLE, flecha = 0, y0, diedro = 0, t0 = 0.12, t1 = 0.09, m = 0.02, s0 = 0, s1 = 1, ca = 0, cb = 1 }) {
  const rA = anillo(t0, m, 0.4, ca, cb), rB = anillo(t1, m, 0.4, ca, cb), R = rA.length, pos = [], uv = [], idx = [];
  for (const s of [s0, s1]) {
    const ch = c0 + (c1 - c0) * s;
    for (let r = 0; r < R; r++) {
      const px = rA[r][0], py = rA[r][1] + (rB[r][1] - rA[r][1]) * s;
      pos.push(lado * (x0 + s * semi), y0 + s * semi * Math.tan(diedro) + py * ch, zLE + flecha * s - px * ch);
      uv.push(rA[r][2] ? 1 - px * 0.5 : px * 0.5, s);
    }
  }
  for (let r = 0; r < R; r++) { const a = r, a1 = (r + 1) % R, b = a + R, b1 = a1 + R; idx.push(a, b, a1, a1, b, b1); }
  for (const [k, inv] of [[0, false], [1, true]]) {   // tapas de raíz y de punta
    let cx = 0, cy = 0, cz = 0; for (let r = 0; r < R; r++) { const q = (k * R + r) * 3; cx += pos[q]; cy += pos[q + 1]; cz += pos[q + 2]; }
    const c = pos.length / 3; pos.push(cx / R, cy / R, cz / R); uv.push(0.5, k);
    for (let r = 0; r < R; r++) { const a = k * R + r, a1 = k * R + (r + 1) % R; idx.push(...(inv ? [c, a1, a] : [c, a, a1])); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); const q = g.attributes.position, ce = new THREE.Vector3(); for (let i = 0; i < q.count; i++) ce.add(new THREE.Vector3().fromBufferAttribute(q, i)); ce.divideScalar(q.count);
  orientar(g, v => v.clone().sub(ce));
  return g;
}
const ala = o => alaTramo(o);   // ala completa de un tramo

const malla = (geo, mat, padre, nombre = '') => { const m = new THREE.Mesh(geo, mat); m.name = nombre; padre.add(m); return m; };

/** Tubo (cilindro cónico) entre dos puntos. */
function tubo(g, p0, p1, r0, r1, mat, seg = 10) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), d = b.clone().sub(a), len = d.length();
  const m = malla(new THREE.CylinderGeometry(r1, r0, len, seg), mat, g); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); return m;
}
/** Puntal aerodinámico: caja plana (cuerda en z) entre dos puntos. */
function puntal(g, p0, p1, cuerda, esp, mat) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), y = b.clone().sub(a), len = y.length(); y.normalize();
  const z = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  const m = malla(new THREE.BoxGeometry(esp, len, cuerda), mat, g); m.position.copy(a).addScaledVector(y, len / 2); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); return m;
}
/** Rueda con neumático (toro), llanta y disco de freno; eje a lo largo de x. */
function rueda(g, x, y, z, R, w) {
  const M = mats(), t = Math.min(w * 0.55, R * 0.45), gr = new THREE.Group(); gr.position.set(x, y, z); g.add(gr);
  malla(new THREE.TorusGeometry(R - t, t, 10, 24).rotateY(Math.PI / 2), M.neumatico, gr);
  malla(new THREE.CylinderGeometry(R - t * 1.1, R - t * 1.1, w * 0.8, 20).rotateZ(Math.PI / 2), M.aluminio, gr);
  malla(new THREE.CylinderGeometry(R * 0.3, R * 0.3, w * 1.0, 12).rotateZ(Math.PI / 2), M.gris, gr);
  return gr;
}
/** Polígono vertical (en el plano z–y) con espesor en x: derivas, quillas, placas. pts: [[z, y], ...] */
function placa(g, pts, esp, mat, x = 0) {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y)); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: esp, bevelEnabled: true, bevelSize: esp * 0.4, bevelThickness: esp * 0.4, bevelSegments: 2 }); geo.translate(0, 0, -esp / 2); geo.rotateY(-Math.PI / 2);
  const m = malla(geo, mat, g); m.position.x = x; return m;
}
/** Banda de color sobre una placa trapezoidal (4 puntos: borde de ataque abajo, fuga abajo, fuga arriba, ataque arriba) entre las alturas y1..y2. */
function bandaPlaca(g, q, y1, y2, mat, esp, doble = true) {
  const [lb, tb, tt, lt] = q, f = (a, b, y) => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
  const poly = [[f(lb, lt, y1), y1], [f(tb, tt, y1), y1], [f(tb, tt, y2), y2], [f(lb, lt, y2), y2]];
  for (const s of doble ? [1, -1] : [1]) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(poly.flatMap(([z, y]) => [s * (esp / 2 + 0.004), y, z]), 3)); geo.setIndex(s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
    malla(geo, mat, g);
  }
}
const esfera = (g, x, y, z, r, mat) => { const m = malla(new THREE.SphereGeometry(r, 10, 8), mat, g); m.position.set(x, y, z); return m; };

/** Hélice de n palas con cono: eje z, centro del buje en (x, y, z); gira a `ang`. */
function helice(g, { x = 0, y, z, R, n, ang = 0, cono = 0.34, rc = 0.17, puntas = 'amarillo', ancho = 0.18 }) {
  const M = mats(), h = new THREE.Group(); h.position.set(x, y, z); g.add(h);
  const perfil = [[0, cono], [rc * 0.35, cono * 0.93], [rc * 0.7, cono * 0.7], [rc * 0.93, cono * 0.34], [rc, 0]].map(([r, yy]) => new THREE.Vector2(r, yy));
  malla(new THREE.LatheGeometry(perfil, 24).rotateX(Math.PI / 2), M.cromo, h);
  const sh = new THREE.Shape(); sh.moveTo(rc * 0.8, -ancho * 0.28); sh.lineTo(R * 0.35, -ancho * 0.5); sh.lineTo(R * 0.7, -ancho * 0.42); sh.lineTo(R * 0.98, -ancho * 0.3); sh.lineTo(R, 0); sh.lineTo(R * 0.98, ancho * 0.3); sh.lineTo(R * 0.7, ancho * 0.4); sh.lineTo(R * 0.35, ancho * 0.45); sh.lineTo(rc * 0.8, ancho * 0.28); sh.closePath();
  for (let k = 0; k < n; k++) {
    const b = new THREE.Group(); b.rotation.z = ang + k * Math.PI * 2 / n; h.add(b);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); geo.translate(0, 0, -0.011); geo.rotateX(24 * RAD); malla(geo, M.negro, b);
    const tip = new THREE.BoxGeometry(R * 0.07, ancho * 0.6, 0.026); tip.translate(R * 0.965, 0, 0); tip.rotateX(24 * RAD); malla(tip, M[puntas], b);
  }
  return h;
}

// ───────────────────────── librea (texturas) ─────────────────────────

const lienzo = (W, H, dibuja) => {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); dibuja(g, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; return t;
};
/** Modo de dibujo de las texturas del fuselaje: 'color' (librea), 'i' (opacidad: ventanas negras) o 'm' (máscara de cristal: ventanas blancas). */
let MODO = 'color';
export const modoTextura = () => MODO;
/** Pinta una cinta que sigue el fuselaje: φ(z) en grados (lado babor; el estribor se refleja). Colores [[φ-offset, ancho°, color], ...]. */
function cinta(g, W, H, tz, z0, z1, phiAt, capas) {
  if (MODO !== 'color') return;
  for (const lado of [1, -1]) for (const [off, ancho, color] of capas) {
    g.fillStyle = color; g.beginPath();
    const N = 30, pts = Array.from({ length: N + 1 }, (_, i) => { const z = z0 + (z1 - z0) * i / N, p = phiAt(z) + off; return [z, p]; });
    const X = p => (lado > 0 ? p : 360 - p) / 360 * W, Y = z => tz(z) * H;
    pts.forEach(([z, p], i) => { const x = X(p - ancho / 2), y = Y(z); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    for (let i = N; i >= 0; i--) { const [z, p] = pts[i]; g.lineTo(X(p + ancho / 2), Y(z)); }
    g.closePath(); g.fill();
  }
}
/** Ventana en el costado (φ entre p0 y p1, z entre za y zb), ambos lados: tintada en 'color', recorte en 'i' y 'm'. */
function ventana(g, W, H, tz, za, zb, p0, p1, { r = 10 } = {}) {
  for (const lado of [1, -1]) {
    const a = lado > 0 ? p0 : 360 - p1, b = lado > 0 ? p1 : 360 - p0, x = a / 360 * W, w = (b - a) / 360 * W, y = tz(za) * H, h = (tz(zb) - tz(za)) * H;
    if (MODO !== 'color') { g.fillStyle = MODO === 'm' ? '#fff' : '#000'; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); continue; }
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#34565c'); gr.addColorStop(0.5, '#17303a'); gr.addColorStop(1, '#0d1d26');
    g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
  }
}
/** Parabrisas que sube sobre el techo (se envuelve por los bordes u=0 y u=1 de la textura). */
function parabrisasTop(g, W, H, tz, za, zb, r = 18) {
  const y = tz(za) * H, h = (tz(zb) - tz(za)) * H;
  for (const x of [W * 0.9, -W * 0.1]) {
    if (MODO === 'color') { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2d4f56'); gr.addColorStop(1, '#14272f'); g.fillStyle = gr; } else g.fillStyle = MODO === 'm' ? '#fff' : '#000';
    g.beginPath(); g.roundRect(x, y, W * 0.2, h, r); g.fill();
  }
}
const mancha = (g, W, H, tz, z, p, rx, ry, color = '#101012') => { if (MODO !== 'color') return; for (const lado of [1, -1]) { g.fillStyle = color; g.beginPath(); g.ellipse((lado > 0 ? p : 360 - p) / 360 * W, tz(z) * H, rx, ry, 0, 0, Math.PI * 2); g.fill(); } };
const base = (g, W, H) => {
  if (MODO !== 'color') { g.fillStyle = MODO === 'm' ? '#000' : '#fff'; g.fillRect(0, 0, W, H); return; }
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#f6f6f3'); gr.addColorStop(0.18, '#f6f6f3'); gr.addColorStop(0.5, '#cfd2d6'); gr.addColorStop(0.82, '#f6f6f3'); gr.addColorStop(1, '#f6f6f3'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
};
/** Líneas de paneles y puertas: solo en la librea. */
const panelLine = (g, W, H, tz, x0, z0, x1, z1) => { if (MODO !== 'color') return; g.strokeStyle = 'rgba(30,30,34,.45)'; g.lineWidth = 2; g.strokeRect(x0 * W, tz(z0) * H, (x1 - x0) * W, (tz(z1) - tz(z0)) * H); };

/**
 * Fuselaje por secciones con cristales recortados: la pintura tiene las ventanas caladas (alphaTest), debajo hay un forro interior y encima
 * un cristal translúcido con la misma máscara, de modo que desde fuera se ve la cabina por dentro.
 */
function fuselaje(g, est, dibuja, { n = 90, interior = 0.955, vidrio = 0x1d3a44, nombre = 'Fuselaje' } = {}) {
  const L = loft(est, { n }), hacer = modo => { MODO = modo; const t = lienzo(1024, 512, (c, W, H) => dibuja(c, W, H, L.tz)); MODO = 'color'; return t; };
  const mapa = hacer('color'), opaco = hacer('i'), mascara = hacer('m'); opaco.colorSpace = mascara.colorSpace = THREE.NoColorSpace;
  malla(L.geo, new THREE.MeshStandardMaterial({ map: mapa, alphaMap: opaco, alphaTest: 0.5, roughness: 0.3, metalness: 0.1 }), g, nombre);
  malla(loft(est, { n: Math.round(n * 0.6), escala: interior }).geo, mats().forro, g, 'Forro interior');
  malla(loft(est, { n, escala: 1.004 }).geo, new THREE.MeshStandardMaterial({ color: vidrio, roughness: 0.05, metalness: 0.5, alphaMap: mascara, transparent: true, opacity: 0.5, depthWrite: false }), g, 'Cristales');
  return L;
}
/** Semiancho del fuselaje a la altura z (en φ = 90°). */
const semiAnchoEn = (L, z) => L.filas.reduce((b, f) => Math.abs(f.z - z) < Math.abs(b.z - z) ? f : b).w / 2;

/** Rótulo de texto pegado al costado (ambos lados, legible de morro a cola): matrícula, logotipo. */
function rotuloLado(g, texto, { z, y, x, ancho, alto, color = '#20242a', negrita = true, fuente = 'system-ui, Arial, sans-serif' }) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * alto / ancho); const t2 = c.getContext('2d');
  t2.font = `${negrita ? '800' : '600'} ${Math.round(c.height * 0.78)}px ${fuente}`; t2.textAlign = 'center'; t2.textBaseline = 'middle'; t2.fillStyle = color; t2.fillText(texto, c.width / 2, c.height / 2 + 2);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  for (const lado of [1, -1]) { const m = malla(new THREE.PlaneGeometry(ancho, alto), mat, g, 'Rótulo'); m.position.set(lado * (x + 0.014), y, z); m.rotation.y = lado * Math.PI / 2; }
}
/** Asiento de cabina (mira hacia +z): cojín, respaldo reclinado y reposacabezas. */
function asiento(g, x, y, z, { cuero = false, ry = 0, ancho = 0.46 } = {}) {
  const M = mats(), mt = cuero ? M.cuero : M.tapiz, s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s);
  const add = (geo, m, px, py, pz, rx = 0) => { const o = malla(geo, m, s); o.position.set(px, py, pz); o.rotation.x = rx; };
  add(new THREE.BoxGeometry(ancho, 0.1, 0.46), mt, 0, 0.3, 0); add(new THREE.BoxGeometry(ancho, 0.58, 0.1), mt, 0, 0.62, -0.22, -0.16); add(new THREE.BoxGeometry(ancho * 0.5, 0.18, 0.08), mt, 0, 0.98, -0.27, -0.16); add(new THREE.BoxGeometry(0.07, 0.3, 0.32), M.negro, 0, 0.13, 0);
}
/** Tablero de instrumentos con pantallas y visera. (x, y, z): centro; mira a -z (hacia el piloto). */
function tablero(g, { x = 0, y, z, ancho = 1.1, pantallas = 2 }) {
  const M = mats(), a = malla(new THREE.BoxGeometry(ancho, 0.3, 0.16), M.negro, g); a.position.set(x, y, z);
  const v = malla(new THREE.BoxGeometry(ancho, 0.05, 0.3), M.negro, g); v.position.set(x, y + 0.18, z - 0.06);
  for (let k = 0; k < pantallas; k++) { const p = malla(new THREE.BoxGeometry(0.26, 0.17, 0.012), M.pantalla, g); p.position.set(x + (k - (pantallas - 1) / 2) * 0.3, y + 0.01, z - 0.088); }
  for (let k = 0; k < 6; k++) { const b = malla(new THREE.BoxGeometry(0.03, 0.03, 0.02), M.gris, g); b.position.set(x - ancho * 0.4 + k * ancho * 0.16, y - 0.1, z - 0.09); }
}
/** Mando de vuelo (columna con volante) para el piloto en x. */
function yugo(g, x, y, z) { const M = mats(); tubo(g, [x, y, z], [x, y - 0.06, z - 0.38], 0.022, 0.022, M.negro); const v = malla(new THREE.BoxGeometry(0.34, 0.035, 0.04), M.negro, g); v.position.set(x, y - 0.06, z - 0.4); for (const s of [-1, 1]) { const m = malla(new THREE.BoxGeometry(0.035, 0.2, 0.04), M.negro, g); m.position.set(x + s * 0.17, y - 0.06, z - 0.4); } }
/** Alfombra de cabina. */
const alfombra = (g, x, y, z, ancho, largo) => { const m = malla(new THREE.BoxGeometry(ancho, 0.04, largo), mats().alfombra, g); m.position.set(x, y, z); };

/** Ala o estabilizador de un lado con alerones, flaps o elevadores como piezas separadas con su bisagra (se pueden mover en `g.userData.superficies`). */
function alaSup(g, o, { flap, aleron, elevador, cf = 0.28, mat, def = {} }) {
  const franjas = [['flaps', flap], ['alerones', aleron], ['elevadores', elevador]].filter(([, r]) => r).sort((p, q) => p[1][0] - q[1][0]);
  const tramos = []; let cur = 0;
  for (const [, [a, b]] of franjas) { if (a > cur + 1e-6) tramos.push([cur, a, 1]); tramos.push([a, b, 1 - cf]); cur = b; }
  if (cur < 1 - 1e-6) tramos.push([cur, 1, 1]);
  for (const [a, b, cb] of tramos) malla(alaTramo({ ...o, s0: a, s1: b, ca: 0, cb }), mat, g, 'Ala');
  const reg = g.userData.superficies ??= { flaps: [], alerones: [], elevadores: [], timon: null };
  for (const [nombre, [a, b]] of franjas) {
    const geo = alaTramo({ ...o, s0: a, s1: b, ca: 1 - cf, cb: 1 }), s = (a + b) / 2, ch = o.c0 + (o.c1 - o.c0) * s;
    const hx = o.lado * (o.x0 + s * o.semi), hy = o.y0 + s * o.semi * Math.tan(o.diedro ?? 0), hz = o.zLE + (o.flecha ?? 0) * s - (1 - cf) * ch;
    geo.translate(-hx, -hy, -hz); const m = malla(geo, mat, g, nombre); m.position.set(hx, hy, hz); m.rotation.x = def[nombre] ?? 0; reg[nombre].push(m);
  }
}
/** Deriva con timón separado (bisagra vertical). pts: [borde de ataque abajo, fuga abajo, fuga arriba, ataque arriba] en (z, y). */
function derivaTimon(g, pts, esp, mat, cf = 0.38) {
  const [lb, tb, tt, lt] = pts, h = (a, b) => [a[0] + (b[0] - a[0]) * (1 - cf), a[1] + (b[1] - a[1]) * (1 - cf)], hb = h(lb, tb), ht = h(lt, tt);
  placa(g, [lb, hb, ht, lt], esp, mat);
  const sh = new THREE.Shape(); [hb, tb, tt, ht].forEach(([z, y], i) => i ? sh.lineTo(z - hb[0], y - hb[1]) : sh.moveTo(z - hb[0], y - hb[1])); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: esp * 0.9, bevelEnabled: true, bevelSize: esp * 0.35, bevelThickness: esp * 0.35, bevelSegments: 2 }); geo.translate(0, 0, -esp * 0.45); geo.rotateY(-Math.PI / 2);
  const m = malla(geo, mat, g, 'Timón'); m.position.set(0, hb[1], hb[0]); (g.userData.superficies ??= { flaps: [], alerones: [], elevadores: [], timon: null }).timon = m;
}
const alaTex = (lineas) => lienzo(512, 256, (g, W, H) => {
  g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(40,44,50,.55)'; g.lineWidth = 2;
  for (const [u, v0, v1] of lineas) { g.beginPath(); g.moveTo(u * W, v0 * H); g.lineTo(u * W, v1 * H); g.stroke(); }
  g.fillStyle = 'rgba(30,34,40,.3)'; g.fillRect(0, 0, W * 0.5, 3);
});
const matPintura = map => new THREE.MeshStandardMaterial({ map, roughness: 0.3, metalness: 0.1 });
const lucesNav = (g, y, xTip, z, lucesZ = null) => { const M = mats(); esfera(g, xTip, y, z, 0.05, M.luzRoja); esfera(g, -xTip, y, z, 0.05, M.luzVerde); if (lucesZ !== null) esfera(g, 0, y, lucesZ, 0.045, M.luzBlanca); };

// ───────────────────────── Cessna 206 y 210 ─────────────────────────

function cessna(a, v210) {
  const M = mats(), g = new THREE.Group(), L = a.largo, zn = L / 2, semi = a.ancho / 2;
  const est = v210 ? [
    [zn - 0.35, 0.46, 0.48, 1.02, 2.0], [zn - 0.5, 0.74, 0.74, 1.04, 2.1], [zn - 1.0, 0.92, 0.92, 1.1, 2.2], [zn - 1.7, 1.02, 1.06, 1.2, 2.3], [zn - 2.2, 1.1, 1.26, 1.36, 2.5],
    [zn - 3.0, 1.15, 1.42, 1.5, 2.6], [zn - 4.3, 1.16, 1.42, 1.5, 2.6], [zn - 5.6, 0.98, 1.22, 1.5, 2.4], [zn - 6.8, 0.66, 0.84, 1.5, 2.2], [zn - 7.9, 0.34, 0.46, 1.5, 2.0], [-zn, 0.1, 0.16, 1.5, 2.0]]
  : [
    [zn - 0.35, 0.5, 0.52, 1.0, 2.0], [zn - 0.5, 0.8, 0.78, 1.02, 2.1], [zn - 1.0, 0.97, 0.96, 1.07, 2.2], [zn - 1.6, 1.06, 1.08, 1.16, 2.3], [zn - 2.2, 1.12, 1.22, 1.3, 2.5],
    [zn - 3.1, 1.16, 1.36, 1.46, 2.6], [zn - 4.3, 1.18, 1.38, 1.47, 2.6], [zn - 5.5, 1.1, 1.3, 1.47, 2.5], [zn - 6.7, 0.86, 1.06, 1.46, 2.3], [zn - 7.7, 0.56, 0.72, 1.46, 2.2], [zn - 8.4, 0.28, 0.4, 1.46, 2.0], [-zn, 0.1, 0.16, 1.46, 2.0]];
  const zCab = zn - 2.2, zRoof = zn - 3.1, zAft = zn - 6.0;      // base del parabrisas, techo, ventana trasera
  const F = fuselaje(g, est, (c, W, H, tz) => {
    base(c, W, H);
    ventana(c, W, H, tz, zCab - 0.1, zRoof - 0.15, 25, 90, { r: 16 }); ventana(c, W, H, tz, zRoof - 0.3, zn - 5.0, 70, 106, { r: 12 }); ventana(c, W, H, tz, zn - 5.15, zAft, 74, 100, { r: 10 });
    parabrisasTop(c, W, H, tz, zCab - 0.05, zRoof);
    mancha(c, W, H, tz, zn - 0.75, 112, 20, 10); mancha(c, W, H, tz, zn - 1.1, 130, 14, 18, '#303236');         // entradas de aire del capó
    cinta(c, W, H, tz, zn - 0.6, -zn + 0.25, z => 88 - Math.max(0, (zn - 3 - z) / (L - 3)) * 22, [[-4, 3.2, '#7a1d2b'], [0, 2.2, '#c1272d'], [4, 3.2, '#7a1d2b'], [10, 1.6, '#1c2f5e']]);
    if (!v210) panelLine(c, W, H, tz, 0.705, zRoof - 0.4, 0.795, zAft + 0.4);                                    // puerta de carga del 206 (estribor)
    panelLine(c, W, H, tz, 0.2, zRoof, 0.24, zn - 5.0); panelLine(c, W, H, tz, 0.16, zn - 1.05, 0.34, zn - 1.7);   // puerta de cabina y tapa del capó
  }, { vidrio: 0x1d3f40 });
  // cabina por dentro: alfombra, tablero con pantallas, mandos y seis asientos (2 + 2 + 2)
  const piso = 0.9;
  alfombra(g, 0, piso, zn - 4.2, 0.98, 3.9); tablero(g, { y: piso + 0.72, z: zn - 2.35, ancho: 1.0 });
  for (const x of [0.3, -0.3]) { yugo(g, x, piso + 0.62, zn - 2.5); [3.4, 4.45, 5.5].forEach(d => asiento(g, x, piso, zn - d)); }
  // ala alta con alerones y flaps; en el 206 con puntales, en el 210 en voladizo
  const yAla = 2.12, dih = (v210 ? 2.2 : 1.2) * RAD, aMat = matPintura(alaTex([]));
  for (const lado of [1, -1]) {
    alaSup(g, { lado, x0: 0.35, semi: semi - 0.35, c0: v210 ? 1.75 : 1.68, c1: v210 ? 1.15 : 1.22, zLE: 1.32, flecha: v210 ? -0.05 : 0, y0: yAla, diedro: dih, t0: v210 ? 0.14 : 0.13, t1: 0.1 },
      { flap: [0.03, 0.42], aleron: [0.48, 0.96], cf: 0.27, mat: aMat, def: { flaps: v210 ? -18 * RAD : 0 } });   // el 210 aparece con flaps abajo (mantenimiento)
    const xT = lado * (semi - 0.02), yT = yAla + (semi - 0.35) * Math.tan(dih), zTE = 1.32 + (v210 ? -0.05 : 0) - (v210 ? 1.15 : 1.22);
    esfera(g, xT, yT, 0.85, 0.05, lado > 0 ? M.luzRoja : M.luzVerde); esfera(g, xT, yT + 0.06, zTE + 0.1, 0.035, M.luzBlanca);     // luz de navegación y estroboscópica
    tubo(g, [lado * (semi - 0.12), yT, zTE], [lado * (semi - 0.12), yT - 0.02, zTE - 0.22], 0.006, 0.004, M.negro);               // descargador estático
    if (!v210) { puntal(g, [lado * 0.6, 0.95, 0.66], [lado * 2.95, yAla + 0.1, 0.66], 0.16, 0.04, M.blanco); puntal(g, [lado * 1.75, 1.55, 0.66], [lado * 2.15, yAla + 0.03, 0.66], 0.1, 0.03, M.blanco); }
    const esc = malla(new THREE.BoxGeometry(0.3, 0.025, 0.16), M.cromo, g, 'Escalón'); esc.position.set(lado * (0.62 + 0.06), 0.66, 0.55); tubo(g, [lado * 0.52, 0.74, 0.55], [lado * 0.7, 0.66, 0.55], 0.012, 0.012, M.cromo);   // escalón de ingreso
  }
  { const luz = malla(new THREE.BoxGeometry(0.14, 0.07, 0.02), M.luzBlanca, g, 'Luz de aterrizaje'); luz.position.set(semi * 0.4, yAla - 0.03, 1.33); }
  // empenaje: deriva con timón, estabilizador con elevadores y franjas
  const fin = [[-zn + 1.75, 1.84], [-zn + 0.12, 1.88], [-zn - 0.02 + 0.0, a.alto], [-zn + 0.6, a.alto]];
  derivaTimon(g, fin, 0.11, M.blanco); bandaPlaca(g, fin, a.alto - 0.34, a.alto - 0.23, M.rojo, 0.11); bandaPlaca(g, fin, a.alto - 0.22, a.alto - 0.11, M.azul, 0.11); bandaPlaca(g, fin, a.alto - 0.1, a.alto, M.amarillo, 0.11);
  const eMat = matPintura(alaTex([]));
  for (const lado of [1, -1]) alaSup(g, { lado, x0: 0.12, semi: 1.62, c0: 1.0, c1: 0.62, zLE: -zn + 1.3, flecha: -0.25, y0: v210 ? 1.52 : 1.5, t0: 0.09, t1: 0.07, m: 0 }, { elevador: [0, 1], cf: 0.34, mat: eMat });
  lucesNav(g, 1.52, 1.72, -zn + 0.7, null); esfera(g, 0, a.alto + 0.04, -zn + 0.28, 0.045, M.luzBlanca); esfera(g, 0, 1.5, -zn + 0.03, 0.04, M.luzBlanca);
  // tren de aterrizaje: triciclo
  const hx = v210 ? 1.22 : 1.34;
  for (const lado of [1, -1]) {
    tubo(g, [lado * 0.52, 0.95, 0.12], [lado * hx, 0.3, 0.12], 0.045, 0.036, M.gris); rueda(g, lado * (hx + 0.02), 0.3, 0.12, 0.3, 0.17);
    if (v210) { const pl = malla(new THREE.BoxGeometry(0.03, 0.55, 0.5), M.blanco, g); pl.position.set(lado * (hx - 0.1), 0.62, 0.0); pl.rotation.z = lado * 0.24; }          // compuerta del tren retráctil
    else { const pa = malla(new THREE.SphereGeometry(1, 14, 10), M.blanco, g); pa.scale.set(0.12, 0.26, 0.66); pa.position.set(lado * (hx + 0.17), 0.3, 0.1); }   // carenado de rueda
  }
  const zNg = zn - 1.4; tubo(g, [0, 1.12, zNg - 0.2], [0, 0.28, zNg + 0.08], 0.05, 0.04, M.cromo); tubo(g, [0, 0.62, zNg - 0.05], [0, 0.5, zNg - 0.5], 0.02, 0.02, M.negro); rueda(g, 0, 0.26, zNg + 0.08, 0.26, 0.13);
  // hélice, escape, pitot y antenas
  helice(g, { y: v210 ? 1.02 : 1.0, z: zn - 0.35, R: v210 ? 1.0 : 1.04, n: 3, ang: 0.52 });
  tubo(g, [0.4, 1.0, zn - 1.4], [0.55, 0.78, zn - 2.5], 0.05, 0.05, M.aluminio); tubo(g, [semi - 1.6, yAla - 0.09, 1.1], [semi - 1.6, yAla - 0.12, 1.5], 0.012, 0.012, M.negro);
  const ant = malla(new THREE.BoxGeometry(0.02, 0.28, 0.14), M.negro, g); ant.position.set(0, 2.3, -0.6); const ant2 = malla(new THREE.BoxGeometry(0.02, 0.14, 0.1), M.negro, g); ant2.position.set(0.1, 2.24, 0.3);
  // rótulos: matrícula (ilustrativa) en la cola y logotipo SENA en el capó
  rotuloLado(g, v210 ? 'HK-4830' : 'HK-4827', { z: -2.9, y: 1.46, x: semiAnchoEn(F, -2.9) * 0.97, ancho: 0.8, alto: 0.2 });
  rotuloLado(g, 'SENA', { z: zn - 1.45, y: est[2][3] - 0.3, x: semiAnchoEn(F, zn - 1.45) * 0.78, ancho: 0.62, alto: 0.2, color: '#2f9e2f' });
  return g;
}

// ───────────────────────── Turbo Commander 685 ─────────────────────────

function commander(a) {
  const M = mats(), g = new THREE.Group(), zn = a.largo / 2, semi = a.ancho / 2;
  const est = [[zn, 0.12, 0.2, 1.55, 2.0], [zn - 0.3, 0.7, 0.72, 1.6, 2.2], [zn - 1.0, 1.15, 1.22, 1.72, 2.4], [zn - 2.2, 1.5, 1.62, 1.92, 2.7], [zn - 3.3, 1.62, 1.78, 2.0, 2.9],
    [zn - 6.2, 1.62, 1.78, 2.0, 2.9], [zn - 8.0, 1.52, 1.66, 2.0, 2.8], [zn - 10.0, 1.0, 1.1, 2.0, 2.4], [zn - 12.0, 0.46, 0.56, 2.0, 2.1], [-zn, 0.14, 0.2, 2.0, 2.0]];
  const F = fuselaje(g, est, (c, W, H, tz) => {
    base(c, W, H);
    ventana(c, W, H, tz, zn - 3.2, zn - 2.2, 20, 92, { r: 14 });   // parabrisas lateral
    for (let k = 0; k < 6; k++) ventana(c, W, H, tz, zn - 3.9 - k * 1.12, zn - 4.75 - k * 1.12, 74, 103, { r: 20 });
    parabrisasTop(c, W, H, tz, zn - 3.3, zn - 2.0, 20);
    cinta(c, W, H, tz, zn - 0.8, -zn + 0.3, z => 94 - Math.max(0, (zn - 4 - z) / 11) * 18, [[-5.5, 3, '#7a1d2b'], [-1.5, 5.5, '#c1272d'], [3.5, 3, '#1c2f5e'], [8, 1.6, '#f2c200']]);
    panelLine(c, W, H, tz, 0.2, zn - 5.0, 0.26, zn - 8.2);   // puerta de entrada (babor)
  }, { n: 100, vidrio: 0x1d3a44 });
  // cabina: dos pilotos y seis pasajeros en tres filas, con alfombra y tablero de tres pantallas
  const piso = 1.22;
  alfombra(g, 0, piso, 0, 1.2, 6.4); tablero(g, { y: piso + 0.78, z: zn - 3.2, ancho: 1.3, pantallas: 3 });
  for (const x of [0.4, -0.4]) { yugo(g, x, piso + 0.7, zn - 3.4); asiento(g, x, piso, zn - 4.3, { cuero: true }); [5.6, 6.9, 8.2].forEach(d => asiento(g, x, piso, zn - d, { cuero: true })); }
  // ala alta con alerones y flaps, góndolas largas y hélices tripala
  const yAla = 2.5, aMat = matPintura(alaTex([])), dih = 2 * RAD;
  for (const lado of [1, -1]) {
    alaSup(g, { lado, x0: 0.6, semi: semi - 0.6, c0: 2.55, c1: 1.45, zLE: 1.15, flecha: -0.2, y0: yAla, diedro: dih, t0: 0.14, t1: 0.1 }, { flap: [0.04, 0.4], aleron: [0.46, 0.96], cf: 0.27, mat: aMat, def: { flaps: -12 * RAD } });
    const yT = yAla + (semi - 0.6) * Math.tan(dih);
    esfera(g, lado * (semi - 0.02), yT, 0.55, 0.06, lado > 0 ? M.luzRoja : M.luzVerde); esfera(g, lado * (semi - 0.02), yT + 0.07, -0.2, 0.04, M.luzBlanca);
    tubo(g, [lado * (semi - 0.12), yT, 1.15 - 0.2 - 1.45 + 0.02], [lado * (semi - 0.12), yT - 0.02, 1.15 - 0.2 - 1.45 - 0.25], 0.007, 0.005, M.negro);    // descargador estático
    const gx = lado * 3.0, nTex = lienzo(512, 256, (c, W, H) => { base(c, W, H); cinta(c, W, H, z => (3 - z) / 5.8, 2.5, -2.8, () => 90, [[-3, 4, '#7a1d2b'], [3, 3, '#c1272d']]); });
    const gnac = loft([[3.0, 0.3, 0.3, 1.96, 2.0], [2.75, 0.86, 0.9, 1.98, 2.2], [2.2, 1.0, 1.06, 2.02, 2.3], [0.8, 1.08, 1.14, 2.08, 2.4], [-0.8, 1.0, 1.08, 2.12, 2.4], [-2.0, 0.7, 0.78, 2.12, 2.2], [-3.0, 0.16, 0.22, 2.13, 2.0]], { n: 60, m: 28 });
    const nacela = malla(gnac.geo, matPintura(nTex), g, 'Góndola'); nacela.position.x = gx; nacela.userData.cara = lado;
    const toma = malla(new THREE.BoxGeometry(0.5, 0.16, 0.06), M.negro, g, 'Toma de aire'); toma.position.set(gx, 1.5, 2.75);                  // toma inferior del capó
    helice(g, { x: gx, y: 1.97, z: 3.0, R: 1.16, n: 3, ang: lado * 0.6, cono: 0.4, rc: 0.2 });
    tubo(g, [gx + 0.5, 1.9, 0.6], [gx + 0.62, 1.78, -1.0], 0.07, 0.07, M.aluminio);                                 // escape
    tubo(g, [gx, 1.45, 0.3], [gx, 0.4, 0.3], 0.07, 0.055, M.gris); rueda(g, gx, 0.38, 0.3, 0.38, 0.22); const pu = malla(new THREE.BoxGeometry(0.03, 0.9, 0.85), M.blanco, g); pu.position.set(gx + lado * 0.2, 0.9, 0.3);   // tren principal
  }
  { const luz = malla(new THREE.BoxGeometry(0.16, 0.08, 0.02), M.luzBlanca, g, 'Luz de aterrizaje'); luz.position.set(semi * 0.38, yAla - 0.03, 1.16); }
  // deriva grande con timón, estabilizador con elevadores
  const fin = [[-zn + 3.35, 2.5], [-zn + 0.4, 2.55], [-zn - 0.05, a.alto], [-zn + 1.0, a.alto]];
  derivaTimon(g, fin, 0.14, M.blanco, 0.36); bandaPlaca(g, fin, a.alto - 0.5, a.alto - 0.32, M.rojo, 0.14); bandaPlaca(g, fin, a.alto - 0.3, a.alto - 0.14, M.azul, 0.14); bandaPlaca(g, fin, a.alto - 0.12, a.alto, M.amarillo, 0.14);
  const eMat = matPintura(alaTex([]));
  for (const lado of [1, -1]) alaSup(g, { lado, x0: 0.15, semi: 2.4, c0: 1.55, c1: 0.85, zLE: -zn + 2.0, flecha: -0.45, y0: 2.2, diedro: 6 * RAD, t0: 0.1, t1: 0.08, m: 0 }, { elevador: [0, 1], cf: 0.34, mat: eMat });
  esfera(g, 0, a.alto + 0.05, -zn + 0.4, 0.05, M.luzBlanca); esfera(g, 0, 2.05, -zn + 0.02, 0.05, M.luzBlanca);
  // tren de morro, antenas y pitot
  const zNg = zn - 2.6; tubo(g, [0, 1.15, zNg - 0.1], [0, 0.32, zNg + 0.12], 0.06, 0.05, M.cromo); tubo(g, [0, 0.8, zNg], [0, 0.55, zNg - 0.6], 0.025, 0.025, M.negro); rueda(g, 0, 0.3, zNg + 0.12, 0.3, 0.16);
  const ant = malla(new THREE.BoxGeometry(0.02, 0.3, 0.16), M.negro, g); ant.position.set(0, 2.95, 0.5); const ant2 = malla(new THREE.BoxGeometry(0.02, 0.16, 0.1), M.negro, g); ant2.position.set(0, 1.08, 1.4);
  tubo(g, [semi - 2.0, yAla - 0.12, 1.3], [semi - 2.0, yAla - 0.14, 1.8], 0.012, 0.012, M.negro);
  rotuloLado(g, 'HK-4852', { z: -zn + 2.6, y: 2.0, x: semiAnchoEn(F, -zn + 2.6) * 0.98, ancho: 0.95, alto: 0.24 });
  rotuloLado(g, 'SENA', { z: zn - 7.5, y: 1.55, x: semiAnchoEn(F, zn - 7.5) * 0.9, ancho: 0.8, alto: 0.24, color: '#2f9e2f' });
  return g;
}

// ───────────────────────── Bell 206B JetRanger II ─────────────────────────

function bell(a) {
  const M = mats(), g = new THREE.Group(), zc = a.largo / 2, zMastil = zc - a.ancho / 2, zN = zMastil + 2.9;  // la punta de la pala delantera toca el círculo SMS
  // cabina en forma de gota, con cristales recortados
  const est = [[zN, 0.12, 0.22, 1.18, 2.0], [zN - 0.15, 0.7, 0.78, 1.2, 2.2], [zN - 0.65, 1.2, 1.4, 1.4, 2.35], [zN - 1.5, 1.42, 1.78, 1.58, 2.5], [zN - 2.5, 1.46, 1.9, 1.7, 2.6], [zN - 3.4, 1.34, 1.78, 1.78, 2.6], [zN - 4.1, 0.96, 1.3, 1.84, 2.4], [zN - 4.6, 0.55, 0.74, 1.9, 2.2], [zN - 4.9, 0.4, 0.46, 1.95, 2.0]];
  const F = fuselaje(g, est, (c, W, H, tz) => {
    base(c, W, H);
    ventana(c, W, H, tz, zN - 0.5, zN - 1.9, 20, 80, { r: 26 }); ventana(c, W, H, tz, zN - 2.0, zN - 3.1, 35, 76, { r: 16 }); ventana(c, W, H, tz, zN - 0.9, zN - 1.6, 120, 150, { r: 14 });   // parabrisas, puertas, ventanas de pie
    parabrisasTop(c, W, H, tz, zN - 0.6, zN - 1.9, 24);
    cinta(c, W, H, tz, zN - 0.2, zN - 4.8, z => 118 - Math.max(0, (zN - z - 1.8)) * 2, [[0, 15, '#c1272d'], [-10.5, 2.4, '#7a1d2b']]);    // franja roja sobre fondo blanco
    panelLine(c, W, H, tz, 0.2, zN - 2.0, 0.27, zN - 3.1);
  }, { n: 70, vidrio: 0x1d3a48, nombre: 'Cabina' });
  // cabina por dentro: dos pilotos y banca trasera, consola, mandos cíclico y colectivo
  const piso = 0.84;
  alfombra(g, 0, piso, zN - 2.0, 1.1, 3.1); tablero(g, { y: piso + 0.62, z: zN - 0.75, ancho: 0.9, pantallas: 2 });
  for (const x of [0.32, -0.32]) { asiento(g, x, piso, zN - 1.95); tubo(g, [x * 0.7, piso, zN - 1.35], [x * 0.7, piso + 0.62, zN - 1.45], 0.02, 0.02, M.negro); tubo(g, [x * 2.0, piso + 0.05, zN - 1.8], [x * 2.0, piso + 0.5, zN - 1.5], 0.018, 0.015, M.negro); }
  [-0.52, 0, 0.52].forEach(x => asiento(g, x, piso, zN - 3.15, { ancho: 0.5 }));
  // cubierta del motor / caja de transmisión sobre la cabina, con toma de aire
  const deck = loft([[zMastil + 1.5, 0.5, 0.2, 2.4, 2.2], [zMastil + 0.9, 1.0, 0.5, 2.5, 2.3], [zMastil - 0.2, 1.1, 0.6, 2.55, 2.4], [zMastil - 1.2, 0.8, 0.46, 2.52, 2.3], [zMastil - 2.0, 0.4, 0.26, 2.42, 2.1]], { n: 40, m: 24 });
  malla(deck.geo, M.blanco, g, 'Cubierta de motor'); tubo(g, [0.0, 2.7, zMastil - 1.6], [0.0, 2.67, zMastil - 2.3], 0.1, 0.07, M.aluminio);
  { const toma = malla(new THREE.BoxGeometry(0.5, 0.05, 0.4), M.negro, g, 'Toma de aire'); toma.position.set(0, 2.78, zMastil + 0.45); }
  // viga de cola cónica con franja roja, deriva superior e inferior, estabilizador con placas
  const viga = loft([[zN - 4.7, 0.46, 0.5, 1.96, 2.0], [zN - 6.2, 0.36, 0.38, 2.02, 2.0], [zN - 8.5, 0.2, 0.22, 2.1, 2.0], [zN - 9.55, 0.15, 0.18, 2.14, 2.0]], { n: 30, m: 20 });
  const vTex = lienzo(256, 256, (c, W, H) => { c.fillStyle = '#f6f6f3'; c.fillRect(0, 0, W, H); c.fillStyle = '#c1272d'; c.fillRect(W * 0.17, 0, W * 0.16, H); c.fillRect(W * 0.67, 0, W * 0.16, H); c.fillStyle = '#7a1d2b'; c.fillRect(W * 0.14, 0, W * 0.02, H); c.fillRect(W * 0.64, 0, W * 0.02, H); });
  malla(viga.geo, matPintura(vTex), g, 'Viga de cola');
  const zt = -zc + 0.25;
  const finS = [[zt + 1.15, 2.12], [zt - 0.1, 2.15], [zt - 0.2, 2.78], [zt + 0.3, 2.78]], finI = [[zt + 0.85, 2.02], [zt - 0.1, 2.06], [zt - 0.15, 1.45], [zt + 0.4, 1.55]];
  placa(g, finS, 0.07, M.blanco); bandaPlaca(g, finS, 2.4, 2.56, M.rojo, 0.07); placa(g, finI, 0.07, M.blanco); bandaPlaca(g, finI, 1.7, 1.84, M.rojo, 0.07);
  for (const lado of [1, -1]) { malla(ala({ lado, x0: 0.1, semi: 0.85, c0: 0.5, c1: 0.4, zLE: zt + 1.2, flecha: -0.05, y0: 2.07, t0: 0.08, t1: 0.07, m: 0.02 }), M.blanco, g, 'Estabilizador'); const p = malla(new THREE.BoxGeometry(0.03, 0.38, 0.4), M.blanco, g); p.position.set(lado * 0.96, 2.07, zt + 1.0); }
  // rotor de cola (babor), caja de engranajes y luz
  const gb = malla(new THREE.BoxGeometry(0.14, 0.16, 0.22), M.gris, g); gb.position.set(0.1, 2.15, zt - 0.12);
  for (const k of [0, 1]) { const b = malla(new THREE.BoxGeometry(0.03, 0.55, 0.1), M.negro, g); b.position.set(0.2, 2.15 + (k ? 0.3 : -0.3), zt - 0.12); b.rotation.x = (k ? 1 : -1) * 0.12; }
  esfera(g, 0.2, 2.15, zt - 0.12, 0.05, M.cromo); esfera(g, 0, 1.3, zt + 0.1, 0.04, M.luzBlanca); esfera(g, 0, 2.82, zt + 0.1, 0.04, M.luzBlanca);
  // rotor principal: mástil, cabeza y dos palas (paradas, alineadas con la viga), caídas por su peso
  tubo(g, [0, 2.85 - 0.25, zMastil], [0, 2.84, zMastil], 0.1, 0.075, M.negro); const hub = malla(new THREE.BoxGeometry(0.62, 0.12, 0.24), M.negro, g); hub.position.set(0, 2.78, zMastil);
  for (const s of [1, -1]) { const bl = new THREE.Group(); bl.position.set(0, 2.76, zMastil); bl.rotation.x = s * 0.055; g.add(bl); const pala = malla(new THREE.BoxGeometry(0.34, 0.035, 4.5), M.negro, bl); pala.position.z = s * (0.5 + 2.25); const pt = malla(new THREE.BoxGeometry(0.34, 0.04, 0.5), s > 0 ? M.rojo : M.amarillo, bl); pt.position.z = s * 4.8; }
  // patines con travesaños, antenas y pitot
  for (const lado of [1, -1]) {
    const x = lado * 0.95; tubo(g, [x, 0.09, zN - 0.8], [x, 0.09, zN - 3.9], 0.045, 0.045, M.negro); tubo(g, [x, 0.09, zN - 0.8], [x, 0.3, zN - 0.35], 0.045, 0.045, M.negro);
    tubo(g, [x, 0.09, zN - 1.1], [lado * 0.62, 0.7, zN - 1.1], 0.04, 0.04, M.negro); tubo(g, [x, 0.09, zN - 3.1], [lado * 0.62, 0.78, zN - 3.1], 0.04, 0.04, M.negro);
  }
  tubo(g, [-0.95, 0.12, zN - 1.1], [0.95, 0.12, zN - 1.1], 0.04, 0.04, M.negro); tubo(g, [-0.95, 0.12, zN - 3.1], [0.95, 0.12, zN - 3.1], 0.04, 0.04, M.negro);
  esfera(g, 0, 1.22, zN - 0.05, 0.07, M.luzBlanca);
  tubo(g, [0.3, 0.6, zN - 2.6], [0.3, 0.44, zN - 2.6], 0.012, 0.012, M.negro); tubo(g, [0, 2.1, zt + 0.9], [0, 1.95, zt + 0.9], 0.012, 0.012, M.negro); tubo(g, [0.25, 1.28, zN - 0.2], [0.25, 1.28, zN + 0.1], 0.01, 0.01, M.negro);
  rotuloLado(g, 'HK-4871', { z: zN - 6.9, y: 2.04, x: 0.2, ancho: 0.62, alto: 0.15 });
  rotuloLado(g, 'SENA', { z: zN - 3.9, y: 1.28, x: 0.62, ancho: 0.46, alto: 0.16, color: '#2f9e2f' });
  return g;
}

export function crearAeronave(a) {
  const g = ({ c206: () => cessna(a, false), c210: () => cessna(a, true), tc685: () => commander(a), bell206: () => bell(a) })[a.id]();
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}
