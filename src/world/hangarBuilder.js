import * as THREE from 'three';
import gsap from 'gsap';
import { Materials as M } from '../look/materials.js';
import { PARAMS as P, EQUIPOS } from '../medidas.js';
import { SITIO as S, FLOOR_HEIGHT, KIND_INFO } from '../model/program.js';
import { InstanceBatcher } from './instancing.js';
import { banderaColombia, banderaBarranquilla, etiqueta } from './banderas.js';
import { crearMuros } from './muros.js';
import { construirBloque } from './bloqueBuilder.js';
import { crearAeronave } from './aeronaves.js';
import { crearEquipo } from './equipos.js';

const { H: Hg, L, PL } = S;
const fmt = n => Math.round(n).toLocaleString('es-CO');

/**
 * Hangar, plataforma de aeronaves, bloques de formación/apoyo y administración. Mismo contrato que `buildArchitecturalComplex` de Sena-valley:
 * `floorGroups[0..1]` (solo su y es el desplazamiento de la vista explotada), `roofLowGroup`, `roofGroup`, `interactiveObjects`.
 * Además expone `aeronaves` y `moverAeronave(id, afuera)` para sacar o guardar cada aeronave por su carril.
 */
export function buildHangarComplex(scene) {
  const rootGroup = new THREE.Group(); rootGroup.name = 'HangarComplex'; scene.add(rootGroup);
  const grupo = (nombre, padre = rootGroup) => { const g = new THREE.Group(); g.name = nombre; padre.add(g); return g; };
  const floorGroups = [grupo('Nivel1'), grupo('Nivel2')];
  floorGroups.forEach((g, i) => { g.userData.floorLevel = i + 1; });
  const [g1, g2] = floorGroups;
  const roofLowGroup = grupo('CubiertaBloqueApoyo'), roofGroup = grupo('CubiertaBloqueFormacion'), hangarRoofGroup = grupo('CubiertaHangar');
  const labelsGroup = grupo('Etiquetas'), cotasGroup = grupo('Cotas'), smsGroup = grupo('FranjasSMS');
  const interactiveObjects = [], b1 = new InstanceBatcher(), b2 = new InstanceBatcher();

  // Caja en coordenadas de planta (x ancho, z fondo, y altura); la lleva al mundo.
  const caja = (padre, x, z, w, d, y, h, mat, { sombra = true, nombre = '' } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x + w / 2 + S.ox, y + h / 2, z + d / 2 + S.oz); m.castShadow = sombra; m.receiveShadow = true; m.name = nombre; padre.add(m); return m;
  };
  // Losa caminable (cara superior en yTop) con huecos opcionales: se parte en celdas y se omiten las que caen en un hueco.
  const losa = (padre, rects, huecos, yTop, mat, nombre) => rects.forEach(r => {
    const cortes = (a, b, ks) => [...new Set([a, b, ...huecos.flatMap(h => ks.map(k => h[k])).filter(v => v > a + 1e-6 && v < b - 1e-6)])].sort((p, q) => p - q);
    const xs = cortes(r.x0, r.x1, ['x0', 'x1']), zs = cortes(r.z0, r.z1, ['z0', 'z1']);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      if (huecos.some(h => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1)) continue;
      caja(padre, xs[i], zs[j], xs[i + 1] - xs[i], zs[j + 1] - zs[j], yTop - 0.2, 0.2, mat, { sombra: false, nombre }).userData.floorArea = true;
    }
  });
  const hitbox = (padre, x, z, w, d, y, h, data) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x + w / 2 + S.ox, y + h / 2, z + d / 2 + S.oz); m.userData = data; m.name = 'Hitbox'; padre.add(m); interactiveObjects.push(m); return m;
  };

  const { xEd, xH, xD, zEd, zFr } = S, hAlt = Hg.alturaLibre, nv1 = FLOOR_HEIGHT;
  const stats = { puertas: 0, escaleras: 0, ascensores: 0 };
  const { muro, aabb, puerta: puerta0 } = crearMuros(b1);
  const puerta = o => { stats.puertas++; puerta0(o); };

  // ── Bloques: apoyo y técnicas (izq.), formación con administración encima (der.) ──
  const ctx1 = { g: g1, b: b1, caja, losa, hitbox, stats }, ctx2 = { g: g2, b: b2, caja, losa, hitbox, stats };
  construirBloque({ ...ctx1, techo: roofLowGroup }, L.izq.pisos[0], { x0: xEd, y0: 0, piso: 1 });
  construirBloque(ctx1, L.der.pisos[0], { x0: xD, y0: 0, piso: 1 });
  construirBloque({ ...ctx2, techo: roofGroup }, L.der.pisos[1], { x0: xD, y0: nv1, piso: 2 });

  // ── Hangar: envolvente con puertas peatonales, pasos a los bloques y portón de hojas apiladas ──
  const acero = M.structuralSteelWhite, ciego = M.whiteStucco, vi = Hg.ventanal.inf, vs = Hg.ventanal.sup, pila = P.pilaHojas, pt = Hg.puerta;
  losa(g1, [{ x0: xH, x1: xD, z0: zEd, z1: zFr }], [], 0.02, M.warmConcrete, 'Piso hangar');
  const pasos = L.der.pisos[0].aberturasHangar.map(a => ({ c: zEd + (a.z0 + a.z1) / 2, w: a.z1 - a.z0, yb: 0, yt: a.alto }));
  const puertasPeatonales = [Hg.ancho * 0.17, Hg.ancho * 0.5, Hg.ancho * 0.83].map(x => ({ c: xH + x, w: 1.0, yb: 0, yt: 2.1 }));
  muro(acero, { eje: 'x', c: zEd, a0: xH, a1: xD, h: hAlt, esp: 0.25, ab: puertasPeatonales });
  puertasPeatonales.forEach(o => puerta({ eje: 'x', c: zEd, a: o.c, w: 1.0, hacia: 1, esp: 0.25 }));                // salidas peatonales y de emergencia
  muro(acero, { eje: 'z', c: xH, a0: zEd, a1: zFr, h: hAlt, esp: 0.25 });                                              // muro izquierdo: ciego hacia formación
  muro(ciego, { eje: 'z', c: xD, a0: zEd, a1: zFr, h: vi, esp: 0.25, ab: pasos });                                   // derecho: pasos a técnicas y apoyo…
  aabb(M.lowEGlass, xD - 0.1, xD + 0.1, vi, vs, zEd, zFr);                                                           // …y ventanal corrido para la administración
  for (let z = zEd; z <= zFr + 0.01; z += 4) aabb(M.darkAluminumMullion, xD - 0.15, xD + 0.15, vi, vs, z - 0.05, z + 0.05);
  muro(acero, { eje: 'z', c: xD, a0: zEd, a1: zFr, y: vs, h: hAlt - vs, esp: 0.25 });
  const jambaAb = [{ c: 0, w: 1.0, yb: 0, yt: 2.1 }];
  [[xH, xH + pila], [xD - pila, xD]].forEach(([a0, a1]) => {
    muro(acero, { eje: 'x', c: zFr, a0, a1, h: hAlt, esp: 0.25, ab: [{ ...jambaAb[0], c: (a0 + a1) / 2 }] });
    puerta({ eje: 'x', c: zFr, a: (a0 + a1) / 2, w: 1.0, hacia: 1, esp: 0.25 });
    [0.35, 0.55].forEach((dz, k) => aabb(M.stainlessSteel, a0 + 0.2 + k * 0.2, a1 - 0.2, 0.1, pt.alto, zFr + dz, zFr + dz + 0.1));   // hojas del portón apiladas
  });
  aabb(acero, xH + pila, xD - pila, pt.alto, hAlt, zFr - 0.125, zFr + 0.125);                                          // dintel del portón
  aabb(M.darkAluminumMullion, xH + pila, xD - pila, pt.alto + 0.1, pt.alto + 0.3, zFr + 0.1, zFr + 0.25);               // riel
  aabb(M.senaGreen, xH, xH + pila, 0.85, 0.97, zFr + 0.12, zFr + 0.18); aabb(M.senaGreen, xD - pila, xD, 0.85, 0.97, zFr + 0.12, zFr + 0.18);   // friso institucional: solo sobre las jambas (el vano debe quedar libre)
  for (let z = zEd + 8; z < zFr - 1; z += 8) [xH + 0.15, xD - 0.45].forEach(x => aabb(M.stainlessSteel, x, x + 0.35, 0, hAlt, z, z + 0.35));
  for (let x = xH + 8.8; x < xD - 1; x += 8.8) aabb(M.stainlessSteel, x, x + 0.35, 0, hAlt, zEd + 0.1, zEd + 0.45);
  { const rise = 4, g = new THREE.BufferGeometry(), x0 = xH - 0.4, x1 = xD + 0.4, xm = (xH + xD) / 2, z0 = zEd - 0.4, z1 = zFr + 0.6, y0 = hAlt;     // cubierta a dos aguas
    const pts = [[x0, y0, z0], [xm, y0 + rise, z0], [xm, y0 + rise, z1], [x0, y0, z1], [x1, y0, z0], [x1, y0, z1]].map(([x, y, z]) => [x + S.ox, y, z + S.oz]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setIndex([0, 3, 2, 0, 2, 1, 1, 2, 5, 1, 5, 4]); g.computeVertexNormals();
    const techo = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xdde3e8, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }));
    techo.castShadow = techo.receiveShadow = true; hangarRoofGroup.add(techo); hangarRoofGroup.visible = false; }
  hitbox(g1, xH, zEd, Hg.ancho, Hg.fondo, -0.2, 0.17, { name: 'Hangar', type: KIND_INFO.hangar.label, floorLevel: 1, code: `${Hg.ancho} × ${Hg.fondo} m`,
    description: `${KIND_INFO.hangar.description} Área ${fmt(Hg.area)} m², altura libre ${hAlt} m, portón ${pt.ancho} × ${pt.alto} m.` });

  // ── Taller: dobladoras, prensas, compresor, banco de prueba de motor, bancos de trabajo y carros de herramientas (ubicación referencial) ──
  const obstaculos = [];
  const poner = (tipo, x, z, ry = 0, y = 0) => { const e = crearEquipo(tipo); e.position.set(xH + x + S.ox, y, zEd + z + S.oz); e.rotation.y = ry; g1.add(e); obstaculos.push(e); return e; };
  caja(g1, xH, zEd, Hg.ancho, Hg.taller.fondo, 0.02, 0.04, M.safetyYellow, { sombra: false });
  [6, 9.2, 12.4].forEach(x => poner('dobladora', x, 1.0)); [18, 21.2, 24.4].forEach(x => poner('prensa', x, 0.9));
  poner('compresor', 29.5, 1.0); poner('bancoMotor', 40, 2.7); poner('extintorCarro', 47.5, 1.3);
  [54, 57.2, 60.4, 63.6, 68, 71.2].forEach((x, i) => { poner('bancoTrabajo', x, 0.95); if (i % 2 === 0) poner('carroHerramientas', x + 1.5, 2.1, Math.PI); });
  hitbox(g1, xH, zEd, Hg.ancho, Hg.taller.fondo, 0, 2, { name: 'Taller de conformado', type: KIND_INFO.taller.label, floorLevel: 1, description: KIND_INFO.taller.description });

  // ── Banderas en el muro posterior ──
  const fl = Hg.banderas, fx = xH + Hg.ancho / 2, bw = fl.ancho;
  [[banderaColombia(), -(bw + fl.separacion) / 2, 'Colombia'], [banderaBarranquilla(), (bw + fl.separacion) / 2, 'Barranquilla']].forEach(([tex, dx, nombre]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, fl.y1 - fl.y0), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(fx + dx + S.ox, (fl.y0 + fl.y1) / 2, zEd + 0.15 + S.oz); m.name = `Bandera ${nombre}`; g1.add(m);
  });

  // ── Aeronaves: franja SMS dentro y fuera, carril de remolque y movimiento ──
  const aeronaves = {};
  for (const a of Hg.aeronaves) {
    const puesto = PL.puestos.find(p => p.id === a.id), dentro = zEd + a.z + S.oz, fuera = zEd + puesto.z + S.oz;
    const afuera = a.id === 'c206';                                          // la Cessna 206 aparece sacada a operar
    const grupoA = crearAeronave(a); grupoA.position.set(xH + a.x + S.ox, 0, afuera ? fuera : dentro); g1.add(grupoA);
    anilloSMS(xH + a.x, zEd + a.z, a, smsGroup);                 // la franja SMS va solo dentro del hangar; afuera hay una pista
    for (let z = zEd + a.carril.z0 + 1; z < zFr - 1; z += 2.4) [a.carril.x0, a.carril.x1].forEach(x => aabb(M.roadStripeWhite, xH + x - 0.06, xH + x + 0.06, 0.04, 0.05, z, z + 1.2));   // carril de remolque
    const hb = new THREE.Mesh(new THREE.BoxGeometry(a.ancho, a.alto, a.largo), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.y = a.alto / 2; grupoA.add(hb); interactiveObjects.push(hb); hb.name = 'Hitbox';
    const info = { name: a.nombre, type: a.tipo === 'H' ? 'Helicóptero' : 'Avión', floorLevel: 1, code: `${a.ancho} × ${a.largo} m`, aeronave: a.id,
      description: `${a.tipo === 'H' ? 'Diámetro del rotor' : 'Envergadura'} ${a.ancho} m, largo ${a.largo} m${a.tipo === 'H' ? ' (con rotores girando)' : ''}, altura ${a.alto} m. Zona SMS de ${P.franjaSMS} m${a.tipoZona === 'circulo' ? ' (circular)' : ''}. Capacidad ${a.pax} personas, peso vacío ${fmt(a.vacio)} kg, PMT ${fmt(a.pmt)} kg, carga útil ${fmt(a.cargaUtil)} kg, combustible ${fmt(a.combustible)} L.` };
    Object.defineProperty(info, 'entrada', { enumerable: true, get: () => { const p = grupoA.getWorldPosition(new THREE.Vector3()); return [p.x, p.z + a.largo / 2 + 5]; } });   // dónde para el recorrido a pie
    hb.userData = info;
    aeronaves[a.id] = { grupo: grupoA, dentro, fuera, afuera, nombre: a.nombre }; obstaculos.push(grupoA);
  }
  /** Saca (afuera=true) o guarda una aeronave: se remolca en línea recta por su carril, sin tocar las demás. */
  const moverAeronave = (id, afuera, duracion = 6) => {
    const A = aeronaves[id]; if (!A || A.afuera === afuera) return;
    A.afuera = afuera; gsap.killTweensOf(A.grupo.position); if (A.calzos) A.calzos.visible = false;
    gsap.to(A.grupo.position, { z: afuera ? A.fuera : A.dentro, duration: duracion, ease: 'power2.inOut', onComplete: () => { if (A.calzos) A.calzos.visible = !afuera; } });
  };
  const moverTodas = afuera => Object.keys(aeronaves).forEach(id => moverAeronave(id, afuera));

  // ── Equipos de apoyo en los PASILLOS entre zonas (nunca dentro de un carril de salida): remolcador, tractor, barra, plataformas, gatos y conos ──
  const pasilloX = i => { const a = Hg.aeronaves[i], c = Hg.aeronaves[i + 1]; return (a.x + a.zona.ancho / 2 + c.x - c.zona.ancho / 2) / 2; };
  const zCola = Hg.zBack + 3;                                        // a la altura de las colas
  poner('barraRemolque', pasilloX(0), Hg.fondo - 7); poner('plataforma', pasilloX(0), zCola, Math.PI / 2 * 0);
  poner('tractor', pasilloX(1), Hg.fondo - 5.5); poner('plataforma', pasilloX(1), zCola);
  poner('remolcador', pasilloX(2), Hg.fondo - 4.5); poner('extintorCarro', pasilloX(2) + 0.9, Hg.fondo - 2.4);
  [zCola + 2, zCola + 4.4, zCola + 6.8].forEach(z => poner('gato', pasilloX(2), z));
  [[-1.1, zCola - 1.5], [1.1, zCola - 1.5], [-1.1, zCola + 8.3], [1.1, zCola + 8.3]].forEach(([dx, z]) => poner('cono', pasilloX(2) + dx, z));
  // calzos en las ruedas principales: se retiran antes de remolcar y vuelven al estacionar (grupo `retirable`)
  const RUEDAS = { c206: { x: 1.34, z: 0.12, R: 0.3 }, c210: { x: 1.22, z: 0.12, R: 0.3 }, tc685: { x: 3.0, z: 0.3, R: 0.38 } };
  for (const a of Hg.aeronaves) {
    const r = RUEDAS[a.id]; if (!r) continue;
    const calzos = new THREE.Group(); calzos.userData.retirable = true; g1.add(calzos);
    for (const sx of [-1, 1]) for (const dz of [-1, 1]) { const e = crearEquipo('cuna'); e.position.set(xH + a.x + sx * r.x + S.ox, 0, zEd + a.z + r.z + dz * (r.R + 0.16) + S.oz); e.rotation.y = dz > 0 ? Math.PI : 0; calzos.add(e); }
    aeronaves[a.id].calzos = calzos; calzos.visible = !aeronaves[a.id].afuera;
  }

  // ── Cotas ──
  const cota = (a, b, txt) => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0] + S.ox, a[1], a[2] + S.oz), new THREE.Vector3(b[0] + S.ox, b[1], b[2] + S.oz)]);
    cotasGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd62839, depthTest: false })));
    const s = etiqueta(txt, { alto: 1.8, fondo: '#d62839' }); s.position.set((a[0] + b[0]) / 2 + S.ox, (a[1] + b[1]) / 2 + 1.2, (a[2] + b[2]) / 2 + S.oz); cotasGroup.add(s);
  };
  cota([xH, 0.3, zEd - 2.5], [xD, 0.3, zEd - 2.5], `Hangar ${Hg.ancho} m`);
  cota([xD + L.anchoDer + 2, 0.3, zEd], [xD + L.anchoDer + 2, 0.3, zFr], `Hangar ${Hg.fondo} m`);
  cota([xH - 2, 0, zEd], [xH - 2, hAlt, zEd], `Altura libre ${hAlt} m`);
  cota([xEd - 3, 0.3, zFr], [xEd - 3, 0.3, S.zPlat], `Plataforma ${PL.fondo} m`);
  cota([0, 0.3, L.fondo + 2], [L.ancho, 0.3, L.fondo + 2], `Predio ${L.ancho} m`);
  cota([L.ancho + 2, 0.3, 0], [L.ancho + 2, 0.3, L.fondo], `Predio ${L.fondo} m · ${(L.area / 10000).toFixed(2)} ha`);

  b1.flush(g1, { castShadow: true, receiveShadow: true }); b2.flush(g2, { castShadow: true, receiveShadow: true });
  // Obstáculos del recorrido a pie: muros, vidrios, marcos y columnas (mallas instanciadas), más aeronaves y equipos. Los peldaños y el mobiliario no estorban.
  const MUROS = new Set([M.whiteStucco, M.structuralSteelWhite, M.lowEGlass, M.darkAluminumMullion, M.stainlessSteel, M.warmConcrete]);
  [g1, g2].forEach(g => g.children.forEach(o => { if (o.isInstancedMesh && MUROS.has(o.material)) obstaculos.push(o); }));
  cotasGroup.visible = false;   // las cotas rojas se activan en Ajustes
  rootGroup.userData = { labelsGroup, cotasGroup, smsGroup, hangarRoofGroup };
  return { rootGroup, floorGroups, roofLowGroup, roofGroup, hangarRoofGroup, labelsGroup, cotasGroup, smsGroup, interactiveObjects,
    aeronaves, moverAeronave, moverTodas, stats, obstaculos, floor1Group: g1, floor2Group: g2 };
}

// Franja SMS pintada: anillo de franjas amarillas y negras alrededor de la huella (rectángulo) o del círculo del helicóptero.
function anilloSMS(cx, cz, a, padre) {
  const z = a.zona, c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#f2b705'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1e2228'; g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 0); g.lineTo(0, 64); g.fill(); g.beginPath(); g.moveTo(64, 32); g.lineTo(32, 64); g.lineTo(64, 64); g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
  let mesh;
  if (z.tipo === 'circulo') { mesh = new THREE.Mesh(new THREE.RingGeometry(z.r0, z.r1, 72), mat); t.repeat.set(z.r1 * 2 / 1.5, z.r1 * 2 / 1.5); mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx + S.ox, 0.04, cz + S.oz); }
  else {
    const sh = new THREE.Shape(), hole = new THREE.Path(), rect = (p, x0, z0, ww, dd) => { p.moveTo(x0, z0); p.lineTo(x0 + ww, z0); p.lineTo(x0 + ww, z0 + dd); p.lineTo(x0, z0 + dd); p.closePath(); };
    rect(sh, cx - z.ancho / 2, cz - z.fondo / 2, z.ancho, z.fondo); rect(hole, cx - a.ancho / 2, cz - a.largo / 2, a.ancho, a.largo); sh.holes.push(hole);
    t.repeat.set(1 / 1.5, 1 / 1.5); mesh = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); mesh.rotation.x = Math.PI / 2; mesh.position.set(S.ox, 0.04, S.oz);   // plano XZ: shape.y → z
  }
  mesh.name = 'Franja SMS'; padre.add(mesh);
}
