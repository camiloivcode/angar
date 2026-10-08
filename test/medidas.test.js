import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS as P, AERONAVES, EQUIPOS, layoutHangar, layoutPlataforma } from '../src/medidas.js';

// Distancia entre zonas SMS ({x, z, zona}): rectángulos o círculos (radio exterior r1).
const caja = q => ({ x0: q.x - q.zona.ancho / 2, x1: q.x + q.zona.ancho / 2, z0: q.z - q.zona.fondo / 2, z1: q.z + q.zona.fondo / 2 });
const dRect = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
function distancia(p, q) {
  const cp = p.zona.tipo === 'circulo', cq = q.zona.tipo === 'circulo';
  if (cp && cq) return Math.hypot(p.x - q.x, p.z - q.z) - p.zona.r1 - q.zona.r1;
  if (cp || cq) { const [c, r] = cp ? [p, q] : [q, p]; const b = caja(r); return Math.hypot(Math.max(0, b.x0 - c.x, c.x - b.x1), Math.max(0, b.z0 - c.z, c.z - b.z1)) - c.zona.r1; }
  return dRect(caja(p), caja(q));
}
const dentro = (q, ancho, z0, z1, m) => { const b = q.zona.tipo === 'circulo' ? { x0: q.x - q.zona.r1, x1: q.x + q.zona.r1, z0: q.z - q.zona.r1, z1: q.z + q.zona.r1 } : caja(q);
  return b.x0 >= m - 1e-9 && b.x1 <= ancho - m + 1e-9 && b.z0 >= z0 - 1e-9 && b.z1 <= z1 + 1e-9; };

test('hangar: una fila, cifras y zonas SMS', () => {
  const h = layoutHangar();
  assert.deepEqual([h.ancho, h.fondo, h.alturaLibre, h.puerta.ancho, h.puerta.alto], [88, 32, 8, 79, 6.5]);
  assert.equal(P.franjaSMS, 3);
  const bell = h.aeronaves.find(a => a.id === 'bell206');
  assert.equal(bell.zona.tipo, 'circulo');                                   // el helicóptero tiene franja circular
  assert.ok(Math.abs(bell.zona.r0 * 2 - AERONAVES.bell206.largo) < 1e-9 && Math.abs(bell.zona.r1 - bell.zona.r0 - 3) < 1e-9);
  h.aeronaves.forEach((a, i) => {
    assert.ok(dentro(a, h.ancho, h.zBack, h.fondo - P.pasilloSMS, P.pasilloSMS), `${a.nombre} fuera del hangar o sin pasillo a muros`);
    h.aeronaves.slice(i + 1).forEach(b => assert.ok(distancia(a, b) >= P.pasilloSMS - 1e-9, `${a.nombre} / ${b.nombre}: pasillo < 3 m (${distancia(a, b).toFixed(2)})`));
  });
  assert.ok(h.ventanal.sup < h.alturaLibre);
  assert.ok(h.banderas.y0 >= AERONAVES.tc685.alto + 0.5 && h.banderas.y1 < h.alturaLibre);
});

test('cada aeronave sale sola por el portón: carril recto sin cruzar otras zonas', () => {
  const h = layoutHangar(), { puerta: pt } = h;
  h.aeronaves.forEach(a => {
    assert.ok(a.carril.x0 >= pt.x0 + P.holguraJamba - 1e-9 && a.carril.x1 <= pt.x0 + pt.ancho - P.holguraJamba + 1e-9, `${a.nombre}: roza la jamba`);
    const barrido = { zona: { tipo: 'rect', ancho: a.carril.x1 - a.carril.x0, fondo: h.fondo - a.carril.z0 + 40 }, x: (a.carril.x0 + a.carril.x1) / 2, z: a.carril.z0 + (h.fondo - a.carril.z0 + 40) / 2 };
    h.aeronaves.filter(b => b !== a).forEach(b => assert.ok(distancia(barrido, b) > 0, `${a.nombre} cruza la zona de ${b.nombre}`));
  });
  assert.ok(pt.alto >= AERONAVES.tc685.alto + P.holguraAltura);
});

test('plataforma: un puesto exterior por aeronave y calle de servicio', () => {
  const h = layoutHangar(), pl = layoutPlataforma(h);
  assert.equal(pl.puestos.length, 4);
  pl.puestos.forEach((s, i) => {
    assert.ok(Math.abs(s.x - h.aeronaves[i].x) < 1e-9, 'el puesto queda frente a su carril');
    assert.ok(dentro(s, h.ancho, h.fondo + P.pasilloSMS, h.fondo + pl.fondo, 0), `${s.id}: fuera de la plataforma`);
    pl.puestos.slice(i + 1).forEach(t => assert.ok(distancia(s, t) >= P.pasilloSMS - 1e-9));
  });
  assert.ok(pl.fondo >= pl.giro && pl.fondo >= h.fondo * 0 + P.pasilloSMS + h.profZona + P.carrilServicio, 'cabe el giro y la calle de servicio');
});

test('el remolcador arrastra la aeronave más pesada', () => {
  assert.ok(EQUIPOS.remolcador.capacidadKg >= Math.max(...Object.values(AERONAVES).map(a => a.pmt)));
});
