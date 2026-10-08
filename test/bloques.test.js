import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS as P } from '../src/medidas.js';
import { layoutPredio } from '../src/predio.js';

const L = layoutPredio();
const area = d => d.recintos.reduce((s, r) => s + r.ancho * r.fondo, 0) + d.corredores.reduce((s, c) => s + (c.z1 - c.z0) * d.W, 0)
  + (d.nucleo ? (d.nucleo.x1 - d.nucleo.x0) * (d.nucleo.z1 - d.nucleo.z0) : 0);

test('los bloques se cubren exactamente: sin espacio vacío', () => {
  [...L.izq.pisos, ...L.der.pisos].forEach(d => assert.ok(Math.abs(area(d) - d.W * d.D) < 1e-6, `área cubierta ${area(d)} ≠ ${d.W * d.D}`));
  L.der.pisos.forEach(d => assert.equal(d.W, L.der.W));                       // formación y administración comparten huella
  L.izq.pisos.concat(L.der.pisos).forEach(d => d.recintos.forEach(r => assert.ok(r.m2 >= r.m2Neto - 1e-6, `${r.nombre} quedó más chico que su programa`)));
});

test('conteo del programa', () => {
  assert.deepEqual([L.izq.pisos[0].recintos.length, L.der.pisos[0].recintos.length, L.der.pisos[1].recintos.length], [16, 13, 13]);
  const aulas = L.izq.pisos[0].recintos.filter(r => /aula|informática|laboratorio/i.test(r.nombre));
  assert.equal(aulas.length, 14);                                             // 7 aulas + informática + múltiple + 5 laboratorios
});

test('cada recinto tiene su puerta al corredor y ventanas dentro de su muro', () => {
  [...L.izq.pisos, ...L.der.pisos].forEach(d => {
    d.recintos.forEach(r => {
      assert.ok(r.puerta.x - r.puerta.ancho / 2 >= r.x0 + 0.1 && r.puerta.x + r.puerta.ancho / 2 <= r.x1 - 0.1, `${r.nombre}: puerta fuera del recinto`);
      assert.ok(d.crujias.length === 3 && (r.lado === 's') === (r.crujia === 0));
    });
    d.ventanas.forEach(v => assert.ok(v.w > 0 && v.yt > v.yb));
  });
});

test('formación (izq.) sin vista ni puertas al hangar; técnicas (der., piso 1) con puerta directa', () => {
  const f = L.izq.pisos[0], [t, a] = L.der.pisos;
  assert.ok(f.recintos.every(r => !r.puertaHangar && !r.vistaHangar) && f.aberturasHangar.length === 0 && f.corredores.every(c => !c.alHangar));
  assert.equal(t.recintos.filter(r => r.puertaHangar).length, 3);            // equipos de tierra, almacén y cuarentena
  assert.ok(t.corredores.every(c => c.alHangar) && t.aberturasHangar.length === 3 + 2);
  assert.ok(a.recintos.filter(r => r.vistaHangar).length >= 3, 'administración mira al hangar');
  assert.ok(a.recintos.filter(r => r.vistaHangar).every(r => r.x0 < 1e-6), 'las oficinas con vista tocan el muro del hangar');
});

test('administración: 150 personas, núcleo con escalera sobre el mismo punto, baños en cada bloque', () => {
  const [t, a] = L.der.pisos;
  assert.ok(a.recintos.reduce((s, r) => s + (r.puestos || 0), 0) >= P.personalOficinaSimultaneo);
  assert.deepEqual(t.nucleo, a.nucleo);
  assert.ok(L.izq.pisos[0].nucleo === null);
  [L.izq.pisos[0], t, a].forEach(d => assert.ok(d.recintos.some(r => r.tipo === 'banos')));
});

test('predio: edificios y reserva caben', () => {
  assert.ok(L.edificios.ancho <= L.ancho - 2 * P.retiro && L.franjaTrasera.ancho <= L.ancho - 2 * P.retiro);
  assert.ok(L.area > L.hangar.area);
});
