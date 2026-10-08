import * as THREE from 'three';
import { Materials as M } from '../look/materials.js';
import { PARAMS as P } from '../medidas.js';
import { SITIO as S } from '../model/program.js';
import { InstanceBatcher, seededRandom } from './instancing.js';
import { buildTrees } from './trees.js';
import { buildCarFleet, buildMotos } from './cars.js';
import { crearEquipo } from './equipos.js';

const { L, H, PL } = S;

/** Terreno del predio: lote, plataforma, andén, parqueo, reserva para el 2º hangar, arbolado y alumbrado. Mismo contrato que `buildCampusTerrain`. */
export function buildPredio(scene) {
  const group = new THREE.Group(); group.name = 'PredioUrbanismo'; scene.add(group);
  const random = seededRandom(11);

  // El mundo es el predio centrado; (x, z) en planta → mundo.
  const wx = x => x + S.ox, wz = z => z + S.oz;
  const plano = (x, z, w, d, mat, y = 0.02, nombre = '') => {
    const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.set(wx(x + w / 2), y, wz(z + d / 2)); m.receiveShadow = true; m.name = nombre; group.add(m); return m;
  };

  // Terreno base (caminable) y contexto exterior
  const base = plano(0, 0, L.ancho, L.fondo, M.grassPBR, -0.05, 'Lote'); base.userData.walkable = true;
  const exterior = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9cbb74, roughness: 0.95, envMapIntensity: 0.1 }));
  exterior.position.y = -0.2; exterior.receiveShadow = true; exterior.userData.hideInTabletop = true; group.add(exterior);

  // Plataforma (concreto) con línea de rodaje amarilla desde el portón, y andenes peatonales
  const pl = plano(S.xH - 3, S.zFr, PL.ancho, PL.fondo, M.warmConcrete, 0.02, 'Plataforma'); pl.userData.walkable = true;
  plano(S.xEd, S.zFr, L.anchoIzq, P.andenPeatonal, M.paverPlazaPBR, 0.02, 'Anden').userData.walkable = true;
  plano(S.xD, S.zFr, L.anchoDer, P.andenPeatonal, M.paverPlazaPBR, 0.02, 'Anden').userData.walkable = true;
  // Una sola pista de rodaje frente al portón: por ella salen, se mueven y se estacionan las aeronaves (sin franjas SMS afuera).
  const zPista = S.zFr + 3, pista = plano(S.xH - 3, zPista, PL.ancho, H.profZona, M.asphaltPBR, 0.03, 'Pista'); pista.userData.walkable = true;
  const marcas = new InstanceBatcher(), cx = S.xH + H.ancho / 2;
  for (let x = S.xH - 2; x < S.xH + H.ancho + 2; x += 4) marcas.box(M.roadStripeYellow, [wx(x + 1), 0.06, wz(zPista + H.profZona / 2)], [2, 0.01, 0.2]);   // eje
  [zPista + 0.3, zPista + H.profZona - 0.3].forEach(z => marcas.box(M.roadStripeWhite, [wx(S.xH + H.ancho / 2), 0.06, wz(z)], [PL.ancho - 1, 0.01, 0.15]));        // bordes
  for (let x = S.xH - 3; x < S.xH + H.ancho + 3; x += 3) {
    marcas.box(M.safetyYellow, [wx(x + 0.75), 0.05, wz(S.zFr + PL.fondo)], [1.5, 0.01, 0.2]);                                   // borde de plataforma
    marcas.box(M.roadStripeYellow, [wx(x + 0.75), 0.05, wz(S.zEd + PL.servicioZ + 3)], [1.5, 0.01, 0.15]);                       // calle de servicio (remolcador y tractor)
  }
  marcas.flush(group, { castShadow: false, receiveShadow: true });

  // Reserva para un 2º hangar (zona verde con arbolado) y parqueo
  const zRes = P.retiro;
  plano(S.xH, zRes, L.expansion.ancho, L.expansion.fondo, M.greenRoof, 0.02, 'Reserva 2º hangar');
  const marco = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L.expansion.ancho, 0.1, L.expansion.fondo)), new THREE.LineBasicMaterial({ color: 0xf2b705 }));
  marco.position.set(wx(S.xH + L.expansion.ancho / 2), 0.08, wz(zRes + L.expansion.fondo / 2)); group.add(marco);

  const xP = S.xD, wP = L.parqueo.ancho;
  plano(xP, zRes, wP, L.franjaTrasera.fondo, M.asphaltPBR, 0.02, 'Parqueo').userData.walkable = true;
  const rayas = new InstanceBatcher(), coches = [];
  const cols = Math.floor(wP / 2.5), x0 = xP + (wP - cols * 2.5) / 2;
  // cuatro filas de plazas de 5 m: dos bancos espalda con espalda separados por calles de 6 m (64 plazas)
  [[0, 1], [11, -1], [16, 1], [27, -1]].forEach(([dz, dir]) => {
    const zf = zRes + dz;
    for (let i = 0; i <= cols; i++) rayas.box(M.roadStripeWhite, [wx(x0 + i * 2.5), 0.04, wz(zf + 2.5)], [0.08, 0.01, 5]);
    for (let i = 0; i < cols; i++) if (random() < 0.45) coches.push({ x: wx(x0 + i * 2.5 + 1.25), z: wz(zf + 2.5), rotY: dir > 0 ? 0 : Math.PI });
  });
  rayas.flush(group, { castShadow: false, receiveShadow: true });
  buildCarFleet(group, coches);
  // Motos: bahía detrás del bloque de apoyo
  { const xM = S.xEd + 1, wM = L.anchoIzq - 2, motos = [];
    if (wM >= 10) {
      plano(xM, zRes + 1, wM, 14, M.asphaltPBR, 0.02, 'Motos').userData.walkable = true;
      const filasM = [[zRes + 3.2, 0], [zRes + 9.6, Math.PI]], porFila = Math.floor((wM - 1.5) / 1.05);
      filasM.forEach(([z, ry]) => { for (let i = 0; i < porFila; i++) if (random() < 0.7) motos.push({ x: wx(xM + 1.2 + i * 1.05), z: wz(z), rotY: ry }); });
      for (let i = 0; i <= porFila; i++) filasM.forEach(([z]) => rayas.box(M.roadStripeWhite, [wx(xM + 0.7 + i * 1.05), 0.04, wz(z)], [0.06, 0.01, 2.2]));
    }
    rayas.flush(group, { castShadow: false, receiveShadow: true }); buildMotos(group, motos); }

  // Cerramiento del lote: muro bajo con friso verde institucional
  const borde = new InstanceBatcher(), g = 0.4;
  borde.box(M.curbStone, [wx(L.ancho / 2), 0.35, wz(0)], [L.ancho, 0.7, g]); borde.box(M.curbStone, [wx(L.ancho / 2), 0.35, wz(L.fondo)], [L.ancho, 0.7, g]);
  borde.box(M.curbStone, [wx(0), 0.35, wz(L.fondo / 2)], [g, 0.7, L.fondo]); borde.box(M.curbStone, [wx(L.ancho), 0.35, wz(L.fondo / 2)], [g, 0.7, L.fondo]);
  // Alumbrado: postes con luminaria emisiva a lo largo de la plataforma y el parqueo
  const postes = [];
  for (let x = S.xH - 3; x <= S.xD + 3.1; x += 12) postes.push([x, S.zFr + PL.fondo - 1]);
  for (let x = xP + 6; x < xP + wP; x += 14) postes.push([x, zRes + L.franjaTrasera.fondo / 2]);
  for (let z = S.zFr + 6; z < L.fondo - 2; z += 12) postes.push([2, z], [L.ancho - 2, z]);
  postes.push([S.xH - 2, S.zFr + 6], [S.xD + 2, S.zFr + 6]);   // flanquean el portón, fuera de los carriles de salida
  postes.forEach(([x, z]) => {
    borde.cylinder(M.darkAluminumMullion, [wx(x), 3.75, wz(z)], [0.09, 7.5, 0.09]);
    borde.box(M.darkCharcoal, [wx(x), 7.5, wz(z)], [0.9, 0.12, 0.3]);
    borde.box(M.interiorLightFixture, [wx(x), 7.42, wz(z)], [0.75, 0.03, 0.22]);
  });
  borde.flush(group, { castShadow: true, receiveShadow: true });

  // Cono de viento en la esquina de la plataforma (la manga se mece en `userData.tick`)
  const cv = PL.conoViento, mastil = new THREE.Group(); mastil.position.set(wx(S.xH + cv.x), 0, wz(S.zEd + cv.z)); group.add(mastil);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 6, 8), M.darkAluminumMullion); poste.position.y = 3; poste.castShadow = true; mastil.add(poste);
  const manga = new THREE.Group(); manga.position.y = 5.8; mastil.add(manga);
  for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - k * 0.1, 0.42 - k * 0.1, 0.55, 14, 1, true), k % 2 ? M.laminateWhite : M.senaOrange); c.rotation.z = Math.PI / 2; c.position.x = 0.4 + k * 0.55; c.material = c.material.clone(); c.material.side = THREE.DoubleSide; c.castShadow = true; manga.add(c); }
  group.userData.tick = t => { manga.rotation.y = Math.sin(t * 0.4) * 0.5 + 0.3; manga.rotation.z = -0.15 + Math.sin(t * 1.7) * 0.06; };

  // Servicio de plataforma: cisterna de combustible, unidad de energía de tierra y extintor en la calle de servicio; conos en el borde de la pista
  { const zLane = S.zEd + PL.servicioZ + 3.4, poner = (tipo, x, z, ry = 0) => { const e = crearEquipo(tipo); e.position.set(wx(x), 0, wz(z)); e.rotation.y = ry; e.userData.obstaculo = true; group.add(e); return e; };
    poner('cisterna', S.xH + 12, zLane, Math.PI / 2); poner('gpu', S.xH + 30, zLane, Math.PI / 2); poner('extintorCarro', S.xH + 34, zLane); poner('remolcador', S.xH + 42, zLane + 0.5, Math.PI / 2); poner('barraRemolque', S.xH + 46, zLane + 0.5, Math.PI / 2);
    for (let x = S.xH - 2; x < S.xD + 3; x += 11) poner('cono', x, S.zEd + PL.servicioZ - 0.4); }

  // Portería al frente del lote
  [-1, 1].forEach(s => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.9), M.whiteStucco); m.position.set(wx(cx) + s * 6, 1.8, wz(L.fondo)); m.castShadow = true; group.add(m); });

  // Arbolado: perímetro, reserva y frente de bloques (determinista)
  const arboles = [], tipos = ['saman', 'ficus', 'guayacan_yellow', 'guayacan_pink'];
  const t = (x, z, esc = 0.8) => arboles.push({ x: wx(x), z: wz(z), s: esc + random() * 0.4, type: tipos[Math.floor(random() * tipos.length)] });
  for (let x = 4; x < L.ancho - 3; x += 7) t(x + random() * 2, 2.4);
  for (let z = 6; z < S.zFr + PL.fondo - 4; z += 8) { t(2.4, z); t(L.ancho - 2.4, z); }
  for (let x = S.xH + 3; x < S.xH + L.expansion.ancho - 2; x += 6) for (let z = zRes + 4; z < zRes + L.expansion.fondo - 2; z += 7) t(x + random() * 2, z + random() * 2, 1);
  for (let x = S.xEd; x < S.xH - 4; x += 6) t(x + 2, S.zFr + 2.5, 0.7);
  const veg = new THREE.Group(); veg.name = 'vegetationGroup'; veg.userData.role = 'vegetation'; group.add(veg);
  buildTrees(veg, arboles);
  group.vegetationGroup = veg;
  group.userData.obstaculos = []; group.traverse(o => { if (o.userData.obstaculo) group.userData.obstaculos.push(o); });
  return group;
}
