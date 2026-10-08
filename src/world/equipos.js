import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EQUIPOS } from '../medidas.js';

/**
 * Equipos de apoyo y herramientas del hangar a escala real (medidas de EQUIPOS en medidas.js; las no verificadas son aproximadas).
 * Cada constructor devuelve un Group con el origen en el suelo y el frente hacia +z; las piezas se fusionan por material (pocas llamadas de dibujo).
 */
const C = (hex, r = 0.45, m = 0.25) => new THREE.MeshStandardMaterial({ color: hex, roughness: r, metalness: m });
let _m;
const mat = () => _m ??= {
  naranja: C(0xe8650c, 0.4, 0.2), amarillo: C(0xf2b705, 0.4, 0.2), rojo: C(0xb8202a, 0.4, 0.25), azul: C(0x1f4e8c, 0.4, 0.25), verde: C(0x2f6b3c, 0.45, 0.2),
  acero: C(0x8b929a, 0.4, 0.8), cromo: C(0xdfe3e6, 0.15, 0.95), negro: C(0x1b1c1e, 0.7, 0.2), goma: C(0x131313, 0.95, 0), gris: C(0x5d646b, 0.55, 0.5),
  madera: C(0x9a6b3c, 0.7, 0), blanco: C(0xf1f1ee, 0.4, 0.1), pantalla: new THREE.MeshStandardMaterial({ color: 0x0c2630, emissive: 0x16647a, emissiveIntensity: 0.6, roughness: 0.2 }),
  vidrio: new THREE.MeshStandardMaterial({ color: 0x12222b, roughness: 0.06, metalness: 0.5 }), luz: new THREE.MeshStandardMaterial({ color: 0xffb400, emissive: 0xff9a00, emissiveIntensity: 0.9 }),
};

// ── ayudantes de armado ──
const nuevo = () => { const g = new THREE.Group(), M = mat(); return { g, M, add(geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; } }; };
const caja = (w, h, d, r = 0) => r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1)) : new THREE.BoxGeometry(w, h, d);
const cil = (r0, r1, h, s = 14) => new THREE.CylinderGeometry(r1, r0, h, s);
/** Tubo entre dos puntos. */
function tubo(b, p0, p1, r, m) {
  const a = new THREE.Vector3(...p0), c = new THREE.Vector3(...p1), d = c.clone().sub(a), o = b.add(cil(r, r, d.length(), 8), m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
/** Rueda con eje en x. */
function rueda(b, x, y, z, R, w, M) { const t = Math.min(w * 0.5, R * 0.5); b.add(new THREE.TorusGeometry(R - t, t, 8, 18).rotateY(Math.PI / 2), M.goma, x, y, z); b.add(cil(R - t * 1.1, R - t * 1.1, w * 0.8, 14).rotateZ(Math.PI / 2), M.acero, x, y, z); }
/** Fusiona las piezas por material en una sola malla cada una. */
function fusionar(g) {
  g.updateMatrixWorld(true); const por = new Map();
  g.children.slice().forEach(o => { if (!o.isMesh) return; const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); if (!por.has(o.material)) por.set(o.material, []); por.get(o.material).push(geo); g.remove(o); });
  for (const [m, geos] of por) { const o = new THREE.Mesh(mergeGeometries(geos), m); o.castShadow = o.receiveShadow = true; g.add(o); }
  return g;
}

// ── equipos de línea ──
function remolcador() {
  const { g, M, add } = nuevo(), E = EQUIPOS.remolcador;
  add(caja(0.86, 0.3, 1.5, 0.05), M.gris, 0, 0.34, 0.1); add(caja(0.8, 0.34, 1.05, 0.08), M.naranja, 0, 0.68, 0.18); add(caja(0.8, 0.1, 0.4, 0.03), M.negro, 0, 0.9, -0.05);
  [-1, 1].forEach(s => { rueda({ add }, s * 0.43, 0.3, -0.35, 0.3, 0.22, M); rueda({ add }, s * 0.4, 0.14, 0.95, 0.14, 0.12, M); });
  // cuna delantera para la rueda de morro: dos rodillos, y brazo de dirección largo
  [-1, 1].forEach(s => add(cil(0.07, 0.07, 0.5, 10).rotateX(Math.PI / 2), M.acero, s * 0.22, 0.4, 1.15)); add(caja(0.56, 0.06, 0.5), M.acero, 0, 0.35, 1.15);
  tubo({ add }, [0, 0.55, -0.55], [0, 1.0, -E.largo + 1.35 - 0.55], 0.025, M.negro); add(cil(0.025, 0.025, 0.5, 8).rotateZ(Math.PI / 2), M.negro, 0, 1.0, -E.largo + 1.35 - 0.55);   // manilar
  add(cil(0.06, 0.06, 0.1, 10), M.luz, 0, 1.02, 0.25); add(caja(0.5, 0.04, 0.4), M.negro, 0, 0.16, -0.62);
  return fusionar(g);
}
function tractor() {
  const { g, M, add } = nuevo();
  add(caja(1.3, 0.55, 2.4, 0.1), M.amarillo, 0, 0.62, 0.1); add(caja(1.32, 0.12, 1.0, 0.04), M.negro, 0, 0.35, 0.9); add(caja(1.1, 0.5, 0.9, 0.06), M.amarillo, 0, 1.0, 0.85);
  for (const x of [-0.55, 0.55]) for (const z of [-0.35, 0.85]) add(cil(0.04, 0.04, 0.85, 8), M.negro, x, 1.4, z);   // postes de cabina
  add(caja(1.3, 0.08, 1.3, 0.03), M.amarillo, 0, 1.85, 0.25); add(caja(1.0, 0.45, 0.04), M.vidrio, 0, 1.45, 0.85 + 0.45); add(caja(0.5, 0.12, 0.5, 0.05), M.negro, 0, 1.15, 0.1);   // techo, parabrisas, asiento
  [-1, 1].forEach(s => { rueda({ add }, s * 0.68, 0.34, 1.0, 0.34, 0.26, M); rueda({ add }, s * 0.68, 0.34, -0.8, 0.34, 0.26, M); add(caja(0.2, 0.1, 0.08), M.luz, s * 0.45, 0.78, 1.34); });
  add(cil(0.06, 0.06, 0.12, 10), M.luz, 0, 1.92, 0.25); add(caja(0.2, 0.2, 0.3), M.acero, 0, 0.45, -1.22); add(cil(0.04, 0.04, 0.3, 8).rotateX(Math.PI / 2), M.negro, 0, 0.5, -1.45);   // enganche
  return fusionar(g);
}
function barraRemolque() {
  const { g, M, add } = nuevo();
  tubo({ add }, [-0.7, 0.12, 0], [0, 0.5, 2.2], 0.04, M.amarillo); tubo({ add }, [0.7, 0.12, 0], [0, 0.5, 2.2], 0.04, M.amarillo); tubo({ add }, [-0.7, 0.12, 0], [0.7, 0.12, 0], 0.035, M.amarillo);
  add(new THREE.TorusGeometry(0.08, 0.02, 6, 12).rotateY(Math.PI / 2), M.acero, 0, 0.5, 2.3); add(cil(0.025, 0.025, 0.7, 8).rotateZ(Math.PI / 2), M.negro, 0, 0.58, 1.8);
  return fusionar(g);
}
function gato() {
  const { g, M, add } = nuevo(), E = EQUIPOS.gato;
  for (let k = 0; k < 3; k++) { const a = k * 2.094, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62; tubo({ add }, [x, 0.04, z], [x * 0.18, 0.95, z * 0.18], 0.03, M.amarillo); add(cil(0.07, 0.07, 0.04, 10), M.negro, x, 0.02, z); }
  add(cil(0.1, 0.1, 0.95, 14), M.rojo, 0, 0.62, 0); add(cil(0.06, 0.06, 0.8, 12), M.cromo, 0, 1.4, 0); add(cil(0.12, 0.12, 0.06, 14), M.negro, 0, E.alto - 0.03, 0);
  add(cil(0.025, 0.025, 0.6, 8).rotateZ(Math.PI / 2), M.negro, 0.2, 0.75, 0); add(cil(0.04, 0.04, 0.12, 8), M.negro, 0.5, 0.75, 0);   // manija de la bomba
  return fusionar(g);
}
function plataforma() {
  const { g, M, add } = nuevo(), E = EQUIPOS.plataforma, yD = E.alto - 0.45;
  add(caja(E.ancho, 0.07, E.largo * 0.55), M.negro, 0, yD, E.largo * 0.2);               // cubierta
  for (const x of [-0.55, 0.55]) for (const z of [-0.6, 1.0]) { add(cil(0.035, 0.035, yD, 8), M.amarillo, x, yD / 2, z); rueda({ add }, x, 0.1, z, 0.1, 0.07, M); }
  for (const x of [-0.58, 0.58]) { add(cil(0.02, 0.02, E.largo * 0.55, 8).rotateX(Math.PI / 2), M.rojo, x, yD + 0.45, E.largo * 0.2); add(cil(0.02, 0.02, 0.45, 8), M.rojo, x, yD + 0.22, 1.0); add(cil(0.02, 0.02, 0.45, 8), M.rojo, x, yD + 0.22, -0.6); }
  add(cil(0.02, 0.02, E.ancho, 8).rotateZ(Math.PI / 2), M.rojo, 0, yD + 0.45, -0.6);
  for (let k = 0; k < 4; k++) add(caja(E.ancho * 0.9, 0.04, 0.26), M.acero, 0, (k + 1) * yD / 5, 1.19 + 0.28 * (4 - k));    // peldaños
  for (const x of [-0.5, 0.5]) tubo({ add }, [x, 0.1, 2.31], [x, yD, 1.19], 0.025, M.amarillo);
  return fusionar(g);
}
function bancoMotor() {
  const { g, M, add } = nuevo(), E = EQUIPOS.bancoMotor;
  add(caja(E.largo, 0.16, E.ancho * 0.8), M.gris, 0, 0.12, 0); for (const x of [-1.6, 0, 1.6]) add(caja(0.14, 1.1, E.ancho * 0.8), M.azul, x, 0.7, 0);                     // bancada y castillete
  add(caja(E.largo * 0.8, 0.1, 0.1), M.azul, 0, 1.25, 0.6); add(caja(E.largo * 0.8, 0.1, 0.1), M.azul, 0, 1.25, -0.6);
  add(caja(1.0, 0.55, 0.6, 0.04), M.acero, -0.2, 1.65, 0); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(cil(0.1, 0.1, 0.45, 12).rotateZ(Math.PI / 2), M.gris, -0.2 + (k - 1) * 0.3, 1.65, s * 0.5);   // motor plano de seis cilindros
  add(cil(0.14, 0.14, 0.3, 14).rotateX(Math.PI / 2), M.cromo, 0.65, 1.65, 0); add(caja(0.04, 1.9, 0.14), M.negro, 0.85, 1.65, 0); add(caja(0.04, 0.14, 1.9), M.negro, 0.85, 1.65, 0).rotation.x = 0.6;    // brida y hélice de prueba
  add(cil(0.3, 0.3, 0.9, 16).rotateZ(Math.PI / 2), M.verde, -1.5, 0.5, 0.65);                                                                                                      // tanque de combustible
  add(caja(E.ancho * 0.9, 1.9, 0.08), M.negro, -E.largo / 2 - 0.1, 1.1, 0);                                                                                                       // pantalla de protección
  add(caja(0.7, 1.4, 0.55, 0.04), M.gris, E.largo / 2 + 0.7, 0.7, -0.6); add(caja(0.5, 0.35, 0.04), M.pantalla, E.largo / 2 + 0.7, 1.15, -0.32); add(caja(0.5, 0.2, 0.04), M.pantalla, E.largo / 2 + 0.7, 0.8, -0.32);   // consola
  return fusionar(g);
}
function carroHerramientas() {
  const { g, M, add } = nuevo();
  add(caja(0.72, 0.84, 0.5, 0.02), M.rojo, 0, 0.55, 0); add(caja(0.74, 0.05, 0.52), M.negro, 0, 0.99, 0); add(caja(0.66, 0.1, 0.08), M.negro, 0, 1.06, -0.2);
  for (let k = 0; k < 6; k++) { add(caja(0.64, 0.005 + 0.02, 0.01), M.negro, 0, 0.22 + k * 0.13, 0.255); add(caja(0.3, 0.025, 0.03), M.cromo, 0, 0.27 + k * 0.13, 0.27); }
  for (const x of [-0.3, 0.3]) for (const z of [-0.18, 0.18]) rueda({ add }, x, 0.07, z, 0.07, 0.04, M);
  return fusionar(g);
}
function bancoTrabajo() {
  const { g, M, add } = nuevo();
  add(caja(2.0, 0.06, 0.8), M.madera, 0, 0.9, 0); add(caja(2.0, 0.05, 0.7), M.acero, 0, 0.3, 0);
  for (const x of [-0.95, 0.95]) for (const z of [-0.35, 0.35]) add(cil(0.03, 0.03, 0.9, 8), M.gris, x, 0.45, z);
  add(caja(0.18, 0.12, 0.16), M.azul, 0.8, 0.99, 0.18); add(cil(0.012, 0.012, 0.22, 6).rotateX(Math.PI / 2), M.negro, 0.8, 1.0, 0.36); add(caja(0.12, 0.12, 0.1), M.azul, 0.8, 0.99, 0.27);       // tornillo de banco
  add(caja(2.0, 1.0, 0.04), M.gris, 0, 1.5, -0.36);                                                                                                                                  // tablero perforado
  for (let k = 0; k < 7; k++) { add(caja(0.04, 0.3 + (k % 3) * 0.1, 0.03), k % 2 ? M.rojo : M.acero, -0.8 + k * 0.27, 1.55, -0.33); add(caja(0.1, 0.05, 0.03), M.amarillo, -0.8 + k * 0.27, 1.3, -0.33); }   // herramientas colgadas
  add(caja(0.3, 0.1, 0.2), M.negro, -0.4, 0.99, 0.1); add(cil(0.05, 0.05, 0.14, 8), M.acero, -0.4, 1.09, 0.1);
  return fusionar(g);
}
function dobladora() {
  const { g, M, add } = nuevo();
  add(caja(1.7, 0.7, 0.9, 0.03), M.gris, 0, 0.35, 0); add(caja(1.7, 0.12, 0.45), M.acero, 0, 0.76, 0.1); add(caja(1.7, 0.1, 0.25), M.verde, 0, 0.96, -0.05).rotation.x = -0.2;
  add(caja(1.7, 0.14, 0.12), M.verde, 0, 0.82, 0.38).rotation.x = 0.5; for (const x of [-0.85, 0.85]) add(caja(0.12, 1.1, 0.5), M.verde, x, 0.55, -0.1);
  for (const x of [-0.6, 0.6]) add(cil(0.08, 0.08, 0.3, 12), M.negro, x, 1.2, -0.4);
  return fusionar(g);
}
function prensa() {
  const { g, M, add } = nuevo(), E = 0.9;
  for (const x of [-0.55, 0.55]) add(caja(0.14, 1.9, 0.5), M.azul, x, 0.95, 0); add(caja(1.3, 0.2, 0.55), M.azul, 0, 1.8, 0); add(caja(1.4, 0.16, 0.6), M.acero, 0, 0.18, 0);                       // columnas, travesaño y base
  add(caja(0.9, 0.1, 0.5), M.gris, 0, 0.85, 0); add(cil(0.12, 0.12, 0.7, 14), M.rojo, 0, 1.35, 0); add(cil(0.05, 0.05, 0.5, 10), M.cromo, 0, 0.95, 0); add(caja(0.2, 0.1, 0.2), M.negro, 0, 0.72, 0);
  add(cil(0.07, 0.07, 0.04, 14).rotateX(Math.PI / 2), M.blanco, 0.45, 1.6, 0.3); tubo({ add }, [0.55, 0.5, 0.3], [0.9, 0.7, 0.3], 0.02, M.negro); tubo({ add }, [0.9, 0.7, 0.3], [0.9, 1.3, 0.3], 0.03, M.negro);   // manómetro y bomba
  return fusionar(g);
}
function compresor() {
  const { g, M, add } = nuevo();
  add(cil(0.28, 0.28, 1.2, 16).rotateZ(Math.PI / 2), M.verde, 0, 0.7, 0); add(caja(0.5, 0.45, 0.5, 0.04), M.negro, 0.8, 0.95, 0); add(cil(0.14, 0.14, 0.3, 12), M.gris, 0.8, 1.3, 0);
  tubo({ add }, [-0.7, 0.4, 0.3], [-0.7, 0.95, 0.3], 0.03, M.negro); for (const x of [-0.55, 0.55]) add(caja(0.06, 0.4, 0.5), M.gris, x, 0.35, 0);
  rueda({ add }, 0.75, 0.15, 0.3, 0.15, 0.08, M); rueda({ add }, 0.75, 0.15, -0.3, 0.15, 0.08, M); add(cil(0.04, 0.04, 0.5, 8).rotateZ(Math.PI / 2), M.negro, -0.9, 0.5, 0);
  return fusionar(g);
}
function extintorCarro() {
  const { g, M, add } = nuevo();
  add(cil(0.12, 0.12, 0.85, 14), M.rojo, 0, 0.78, 0); add(cil(0.04, 0.05, 0.14, 8), M.negro, 0, 1.28, 0); add(caja(0.18, 0.04, 0.06), M.negro, 0.06, 1.34, 0);
  add(caja(0.34, 0.05, 0.3), M.gris, 0, 0.3, 0); tubo({ add }, [0, 0.3, -0.12], [0, 1.0, -0.14], 0.02, M.gris); rueda({ add }, -0.19, 0.12, 0, 0.12, 0.05, M); rueda({ add }, 0.19, 0.12, 0, 0.12, 0.05, M);
  return fusionar(g);
}
function cono() { const { g, M, add } = nuevo(); add(caja(0.42, 0.04, 0.42), M.negro, 0, 0.02, 0); add(new THREE.ConeGeometry(0.17, 0.66, 14), M.naranja, 0, 0.36, 0); add(cil(0.1, 0.12, 0.14, 14), M.blanco, 0, 0.36, 0); return fusionar(g); }
function cuna() {
  const { g, M, add } = nuevo(), sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.3, 0); sh.lineTo(0, 0.13); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }); geo.translate(-0.1, 0, -0.1).rotateY(Math.PI / 2); add(geo, M.amarillo);
  add(caja(0.18, 0.012, 0.03), M.negro, 0, 0.06, 0.1); return fusionar(g);
}
function escalera() {
  const { g, M, add } = nuevo();
  for (const s of [-1, 1]) { tubo({ add }, [s * 0.28, 0, 0.5], [s * 0.28, 1.5, 0], 0.02, M.amarillo); tubo({ add }, [s * 0.28, 0, -0.5], [s * 0.28, 1.5, 0], 0.02, M.acero); }
  for (let k = 1; k <= 5; k++) add(caja(0.58, 0.03, 0.14), M.acero, 0, k * 0.28, 0.5 - k * 0.0833 - 0.01 * k); add(caja(0.62, 0.05, 0.3), M.amarillo, 0, 1.5, 0);
  return fusionar(g);
}
function gpu() {
  const { g, M, add } = nuevo();
  add(caja(0.8, 0.8, 1.5, 0.05), M.amarillo, 0, 0.7, 0); add(caja(0.82, 0.12, 1.52, 0.03), M.negro, 0, 0.32, 0); add(caja(0.5, 0.25, 0.04), M.pantalla, 0, 0.95, 0.77);
  add(cil(0.07, 0.07, 0.4, 10).rotateX(Math.PI / 2), M.negro, 0.2, 0.55, 0.9); add(new THREE.TorusGeometry(0.16, 0.025, 6, 12), M.negro, -0.2, 0.55, 0.78); tubo({ add }, [0, 0.4, -0.75], [0, 0.9, -1.15], 0.02, M.negro);
  for (const x of [-0.36, 0.36]) rueda({ add }, x, 0.2, -0.5, 0.2, 0.1, M); rueda({ add }, 0, 0.1, 0.65, 0.1, 0.07, M);
  return fusionar(g);
}
/** Camión cisterna de combustible de aviación (~8,5 m). */
function cisterna() {
  const { g, M, add } = nuevo();
  add(caja(2.3, 0.35, 8.2, 0.05), M.negro, 0, 0.62, 0);                                                                                    // chasis
  add(cil(1.0, 1.0, 5.3, 28).rotateX(Math.PI / 2).scale(1.05, 1, 1), M.blanco, 0, 1.78, -1.2); add(cil(1.02, 1.02, 0.5, 28).rotateX(Math.PI / 2).scale(1.05, 1, 1), M.rojo, 0, 1.78, -1.2);   // tanque con franja
  add(cil(1.02, 1.02, 0.3, 28).rotateX(Math.PI / 2).scale(1.05, 1, 1), M.azul, 0, 1.78, 0.9); add(caja(0.9, 0.15, 4.4), M.acero, 0, 2.86, -1.2);          // pasarela
  add(caja(2.2, 1.7, 1.8, 0.1), M.blanco, 0, 1.6, 3.2); add(caja(2.0, 0.8, 0.06), M.vidrio, 0, 2.0, 4.12); add(caja(2.25, 0.4, 0.2, 0.05), M.rojo, 0, 0.95, 4.1);   // cabina
  [-1, 1].forEach(s => { add(caja(0.3, 0.2, 0.08), M.luz, s * 0.8, 1.0, 4.22); rueda({ add }, s * 1.05, 0.5, 3.4, 0.5, 0.3, M); [-0.4, -1.7, -3.0].forEach(z => rueda({ add }, s * 1.05, 0.5, z, 0.5, 0.3, M)); });
  add(cil(0.1, 0.1, 1.0, 10), M.acero, 0.5, 2.95, -2.7); add(cil(0.06, 0.06, 2.4, 8).rotateZ(Math.PI / 2), M.negro, 0.0, 0.95, -4.15); add(new THREE.TorusGeometry(0.28, 0.07, 8, 14).rotateY(Math.PI / 2), M.negro, 1.2, 0.95, -3.5);   // boca de carga, manguera
  add(cil(0.06, 0.06, 0.2, 10), M.luz, 0, 2.5, 3.9); add(caja(0.8, 0.5, 0.04), M.rojo, 0, 1.3, -4.1);
  return fusionar(g);
}

const FABRICAS = { remolcador, tractor, barraRemolque, gato, plataforma, bancoMotor, carroHerramientas, bancoTrabajo, dobladora, prensa, compresor, extintorCarro, cono, cuna, escalera, gpu, cisterna };
/** Crea un equipo por nombre (ver FABRICAS). */
export const crearEquipo = tipo => FABRICAS[tipo]();
