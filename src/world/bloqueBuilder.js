import * as THREE from 'three';
import { Materials as M } from '../look/materials.js';
import { SITIO as S, FLOOR_HEIGHT as H, kindInfo } from '../model/program.js';
import { crearMuros } from './muros.js';
import { makeKit } from './kit.js';
import { amoblar } from './interiores.js';
import { crearEquipo } from './equipos.js';

const fmt = n => Math.round(n).toLocaleString('es-CO');
const cuenta = b => { let n = 0; b.buckets.forEach(k => { n += k.matrices.length; }); return n; };
const pisoDe = tipo => tipo.startsWith('lab-') || tipo === 'informatica' ? M.antistaticFloor : tipo === 'aula' ? M.woodParquet
  : ['multiple', 'oficina', 'coordinacion', 'direccion', 'juntas', 'recepcion'].includes(tipo) ? M.carpetGrey : ['banos', 'aseo'].includes(tipo) ? M.paverPlazaPBR : null;

/**
 * Levanta un piso de un bloque a partir de su distribución (bloques.js): muros con puertas y ventanas, corredores, núcleo de escaleras,
 * mobiliario por recinto, hitboxes y rótulos. `x0` es la x de planta del borde occidental del bloque.
 * ctx: { g, b, caja, losa, hitbox, techo } del constructor del hangar.
 */
export function construirBloque(ctx, d, { x0, y0, piso }) {
  const { g, b, caja, losa, hitbox, techo, stats } = ctx;
  const { muro, aabb, puerta: puerta0 } = crearMuros(b);
  // El kit de mobiliario trabaja en coordenadas de planta, igual que el resto: este adaptador las lleva al mundo.
  const bPlan = { buckets: b.buckets, box: (m, p, sz, r) => b.box(m, [p[0] + S.ox, p[1], p[2] + S.oz], sz, r), cylinder: (m, p, sz, r) => b.cylinder(m, [p[0] + S.ox, p[1], p[2] + S.oz], sz, r) };
  const kit = makeKit(bPlan, y0);
  const puerta = o => { stats.puertas++; puerta0(o); };
  const X = x => x0 + x, Z = z => S.zEd + z, W = d.W, D = d.D, nuc = d.nucleo, cortina = piso === 2;
  const lejos = d.lejano === 'e' ? X(W) : X(0), haciaFuera = d.lejano === 'e' ? 1 : -1;
  const muroHangar = d.ladoHangar === 'der' ? X(W) : X(0), haciaCuarto = d.ladoHangar === 'der' ? -1 : 1;

  // ── Pisos: losa corrida (el 2º piso con huecos de escalera y ascensor) ──
  const sx0 = nuc ? X(nuc.x0) + 0.6 : 0, zs = nuc ? Z(nuc.z1) - 0.5 : 0, escalera = nuc && { x0: sx0 - 0.05, x1: sx0 + 1.55, z0: zs - 5.6, z1: Z(nuc.z1) };
  const ascensor = nuc && { x0: X(nuc.x0) + 3.2, x1: X(nuc.x0) + 5.4, z0: Z(nuc.z0) + 0.4, z1: Z(nuc.z0) + 2.6 };
  if (piso === 1) losa(g, [{ x0: X(0), x1: X(W), z0: Z(0), z1: Z(D) }], [], 0.02, M.travertineFloor, 'Piso bloque');
  else losa(g, [{ x0: X(0), x1: X(W), z0: Z(0), z1: Z(D) }], nuc ? [escalera, ascensor] : [], y0, M.travertineFloor, 'Piso 2');

  // ── Muros a lo largo de x: fachadas y paredes de corredor ──
  d.crujias.forEach((cr, i) => ['n', 's'].forEach(lado => {
    const zc = lado === 'n' ? cr.z0 : cr.z1, ext = (lado === 'n' && i === 0) || (lado === 's' && i === d.n - 1);
    const ab = [];
    if (!(ext && cortina)) {
      d.recintos.filter(r => r.crujia === i && r.lado === lado).forEach(r => ab.push({ c: X(r.puerta.x), w: r.puerta.ancho + 0.1, yb: 0, yt: 2.1 }));
      d.ventanas.filter(v => v.crujia === i && v.pared === lado).forEach(v => ab.push({ c: X(v.c), w: v.w, yb: v.yb, yt: v.yt, vidrio: true }));
      if (nuc && i === nuc.crujia) nuc.puertas.filter(p => p.lado === lado).forEach(p => ab.push({ c: X(p.x), w: 1.9, yb: 0, yt: 2.1 }));
    } else ab.push({ c: X(W / 2), w: W - 0.8, yb: 0.9, yt: 3.2, vidrio: true });
    muro(M.whiteStucco, { eje: 'x', c: Z(zc), a0: X(0), a1: X(W), y: y0, h: H, esp: ext ? 0.3 : 0.15, ab });
    if (ext && cortina) for (let x = 0; x <= W + 0.01; x += 3) aabb(M.darkAluminumMullion, X(Math.min(x, W)) - 0.06, X(Math.min(x, W)) + 0.06, y0, y0 + H, Z(zc) - 0.18, Z(zc) + 0.18);
    if (ext && !cortina) aabb(M.timberSlat, X(0), X(W), y0 + H - 0.7, y0 + H, Z(zc) - 0.18, Z(zc) + 0.18);   // friso de madera
  }));
  if (nuc) nuc.puertas.forEach(p => puerta({ eje: 'x', c: Z(p.lado === 'n' ? nuc.z0 : nuc.z1), a: X(p.x), w: 1.8, hacia: p.lado === 'n' ? -1 : 1, y: y0, doble: true }));

  // ── Muros entre recintos de una misma crujía ──
  d.crujias.forEach((cr, i) => {
    const xs = new Set();
    d.recintos.filter(r => r.crujia === i).forEach(r => { xs.add(+r.x0.toFixed(3)); xs.add(+r.x1.toFixed(3)); });
    if (nuc && i === nuc.crujia) { xs.add(+nuc.x0.toFixed(3)); xs.add(+nuc.x1.toFixed(3)); }
    xs.forEach(x => { if (x > 0.01 && x < W - 0.01) muro(M.whiteStucco, { eje: 'z', c: X(x), a0: Z(cr.z0), a1: Z(cr.z1), y: y0, h: H, esp: 0.15 }); });
  });

  // ── Cabecera lejana: fachada, ventanas y accesos de los corredores ──
  const abF = [];
  if (cortina) abF.push({ c: Z(D / 2), w: D - 0.8, yb: 0.9, yt: 3.2, vidrio: true });
  else {
    d.ventanas.filter(v => v.pared === d.lejano).forEach(v => abF.push({ c: Z(v.c), w: v.w, yb: v.yb, yt: v.yt, vidrio: true }));
    d.corredores.forEach(c => abF.push({ c: Z((c.z0 + c.z1) / 2), w: 2.3, yb: 0, yt: 2.4 }));
  }
  muro(M.whiteStucco, { eje: 'z', c: lejos, a0: Z(0), a1: Z(D), y: y0, h: H, esp: 0.3, ab: abF });
  if (cortina) for (let z = 0; z <= D + 0.01; z += 3) aabb(M.darkAluminumMullion, lejos - 0.18, lejos + 0.18, y0, y0 + H, Z(Math.min(z, D)) - 0.06, Z(Math.min(z, D)) + 0.06);
  else {
    aabb(M.timberSlat, lejos - 0.18, lejos + 0.18, y0 + H - 0.7, y0 + H, Z(0), Z(D));
    d.corredores.forEach(c => {
      const zc = Z((c.z0 + c.z1) / 2);
      puerta({ eje: 'z', c: lejos, a: zc, w: 2.2, hacia: haciaFuera, esp: 0.3, y: y0, doble: true, vidrio: true });
      aabb(M.darkAluminumMullion, Math.min(lejos, lejos + haciaFuera * 2.6), Math.max(lejos, lejos + haciaFuera * 2.6), y0 + 2.7, y0 + 2.78, zc - 2, zc + 2);   // alero
      aabb(M.senaGreen, lejos - 0.2, lejos + 0.2, y0 + 2.55, y0 + 2.7, zc - 0.5, zc + 0.5);                                                              // letrero de salida
    });
  }

  // ── Puertas de los recintos hacia el corredor, y pasos al hangar ──
  d.recintos.forEach(r => puerta({ eje: 'x', c: Z(r.lado === 's' ? r.z1 : r.z0), a: X(r.puerta.x), w: r.puerta.ancho, hacia: r.lado === 's' ? -1 : 1, y: y0, doble: r.puerta.ancho >= 1.8 }));
  d.recintos.filter(r => r.puertaHangar).forEach(r => puerta({ eje: 'z', c: muroHangar, a: Z(r.puertaHangar.z), w: r.puertaHangar.ancho, hacia: haciaCuarto, esp: 0.25, y: y0, doble: r.puertaHangar.ancho >= 1.8 }));
  d.corredores.filter(c => c.alHangar).forEach(c => puerta({ eje: 'z', c: muroHangar, a: Z((c.z0 + c.z1) / 2), w: 1.8, hacia: haciaCuarto, esp: 0.25, y: y0, doble: true }));

  // ── Corredores: luminarias y señalización ──
  d.corredores.forEach(c => { for (let x = 2; x < W; x += 4) kit.luz(X(x), Z((c.z0 + c.z1) / 2), 1.2, 0.2); });

  // ── Recintos: piso propio, mobiliario, luces, hitbox y rótulo ──
  d.recintos.forEach(r => {
    const info = kindInfo(r.tipo), mat = pisoDe(r.tipo);
    if (mat) caja(g, X(r.x0) + 0.08, Z(r.z0) + 0.08, r.ancho - 0.16, r.fondo - 0.16, y0, 0.03, mat, { sombra: false });
    const antes = cuenta(b);
    amoblar(kit, { x0: X(r.x0), x1: X(r.x1), z0: Z(r.z0), z1: Z(r.z1), lado: r.lado, tipo: r.tipo, cap: r.cap, puestos: r.puestos, ladoHangar: d.ladoHangar });
    if (r.tipo === 'equipos-tierra') {   // máquinas reales (no cajas): remolcador, tractor, plataformas, gatos y carro de herramientas; el centro queda libre hasta el portón al hangar
      const z0 = Z(r.z0), z1 = Z(r.z1), lejos = d.ladoHangar === 'der' ? X(r.x0) : X(r.x1), sg = d.ladoHangar === 'der' ? 1 : -1, ry = sg * Math.PI / 2;   // sg: de la pared lejana hacia el hangar
      const poner = (tipo, dx, z, giro = ry) => { const e = crearEquipo(tipo); e.position.set(lejos + sg * dx + S.ox, 0, z + S.oz); e.rotation.y = giro; e.userData.obstaculo = true; g.add(e); };
      poner('tractor', 2.4, z0 + 1.5); poner('remolcador', 2.2, z1 - 1.2); poner('barraRemolque', 4.9, z1 - 1.0);
      [4.9, 7.5].forEach(dx => poner('plataforma', dx, z0 + 1.15)); [6.0, 7.2, 8.4].forEach(dx => poner('gato', dx, z1 - 1.2, 0));
      poner('carroHerramientas', r.ancho - 0.8, z1 - 0.5, Math.PI); poner('escalera', 0.6, (z0 + z1) / 2);
    }
    const cx = X((r.x0 + r.x1) / 2), cz = Z((r.z0 + r.z1) / 2);
    [-0.3, 0.3].forEach(k => kit.luz(cx, cz + k * r.fondo, Math.min(1.6, r.ancho - 0.6), 0.2));
    const extra = r.cap && r.tipo !== 'cafeteria' ? ` Capacidad ${r.cap} personas.` : r.puestos ? ` ${r.puestos} puestos.` : '';
    hitbox(g, X(r.x0), Z(r.z0), r.ancho, r.fondo, y0, H, { name: r.nombre, type: info.label, floorLevel: piso, code: info.zone, muebles: cuenta(b) - antes, tipo: r.tipo,
      description: `${info.description} Área ${fmt(r.m2)} m² (programa ${fmt(r.m2Neto)} m²).${extra}` });
  });

  // ── Núcleo de circulación vertical: escalera de un tramo (20 peldaños), ascensor de vidrio y barandas ──
  if (nuc) {
    const nz0 = Z(nuc.z0), nz1 = Z(nuc.z1), nx0 = X(nuc.x0), rise = H / 20;
    if (piso === 1) {
      stats.escaleras++; stats.ascensores++;
      for (let k = 0; k < 20; k++) aabb(M.travertineFloor, sx0, sx0 + 1.5, 0, (k + 1) * rise, zs - 0.28 * (k + 1), zs - 0.28 * k);   // peldaños (no son obstáculo: la rampa invisible sube al caminante)
      { const q = [[sx0, 0.02, zs], [sx0 + 1.5, 0.02, zs], [sx0 + 1.5, H, zs - 5.6], [sx0, H, zs - 5.6]].map(([x, y, z]) => [x + S.ox, y, z + S.oz]);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(q.flat(), 3)); geo.setIndex([0, 1, 2, 0, 2, 3, 2, 1, 0, 3, 2, 0]); geo.computeVertexNormals();
        const rampa = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false })); rampa.name = 'Rampa escalera'; rampa.userData.floorArea = true; g.add(rampa); }
      aabb(M.warmConcrete, sx0 - 0.1, sx0, 0, H, zs - 5.6, zs);                                                        // zócalo de apoyo (zanca)
      const [a0, a1, c0, c1] = [ascensor.x0, ascensor.x1, ascensor.z0, ascensor.z1];
      [[a0, a1, c0, c0 + 0.04], [a0, a1, c1 - 0.04, c1], [a0, a0 + 0.04, c0, c1], [a1 - 0.04, a1, c0, c1]].forEach(([p, q, r, s]) => aabb(M.lowEGlass, p, q, 0, 2 * H, r, s));
      [[a0, c0], [a1, c0], [a0, c1], [a1, c1]].forEach(([x, z]) => aabb(M.darkAluminumMullion, x - 0.05, x + 0.05, 0, 2 * H, z - 0.05, z + 0.05));
      aabb(M.stainlessSteel, a0 + 0.1, a1 - 0.1, 0.02, 0.12, c0 + 0.1, c1 - 0.1);                                      // cabina
      aabb(M.stainlessSteel, a0 + 0.35, a1 - 0.35, 0, 2.1, c1 - 0.02, c1 + 0.04);                                        // puerta del ascensor
    } else {
      [escalera.x0, escalera.x1].forEach(x => { aabb(M.stainlessSteel, x - 0.025, x + 0.025, y0, y0 + 1.0, escalera.z0 + 0.05, escalera.z1 - 0.1); aabb(M.stainlessSteel, x - 0.04, x + 0.04, y0 + 0.98, y0 + 1.02, escalera.z0 + 0.05, escalera.z1 - 0.1); });
    }
    hitbox(g, nx0, nz0, nuc.x1 - nuc.x0, nz1 - nz0, y0, H, { name: 'Escaleras y ascensor', type: kindInfo('nucleo').label, floorLevel: piso, code: `Piso ${piso}`, muebles: 1, tipo: 'nucleo', description: kindInfo('nucleo').description });
  }

  // ── Cubierta plana con borde de madera ──
  if (techo) {
    caja(techo, X(0), Z(0), W, D, y0 + H, 0.3, M.gravelRoof);
    [[X(0), Z(0), W, 0.4], [X(0), Z(D) - 0.4, W, 0.4]].forEach(([x, z, w, dd]) => caja(techo, x, z, w, dd, y0 + H + 0.3, 0.5, M.timberSlat));
    [[X(0), Z(0), 0.4, D], [X(W) - 0.4, Z(0), 0.4, D]].forEach(([x, z, w, dd]) => caja(techo, x, z, w, dd, y0 + H + 0.3, 0.5, M.timberSlat));
  }
}
