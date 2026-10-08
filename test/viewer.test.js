import test from 'node:test';
import assert from 'node:assert/strict';
import { floorLayout } from '../src/model/viewerState.js';
import { TOUR } from '../src/model/tour.js';
import { XR_SPAWNS } from '../src/model/spawns.js';
import { SITIO, LEVELS } from '../src/model/program.js';

test('pisos: 2 niveles + dos cubiertas; el corte en 1 oculta el 2º piso', () => {
  assert.equal(floorLayout('all').length, LEVELS + 2);
  const [n1, n2] = floorLayout('1');
  assert.ok(n1.visible && !n2.visible);
  assert.equal(floorLayout('3'), null);
});

test('recorrido y spawns caen dentro del predio y la administración está en el nivel 2', () => {
  const { L } = SITIO;
  XR_SPAWNS.forEach(s => assert.ok(Math.abs(s.pos[0]) <= L.ancho / 2 && Math.abs(s.pos[2]) <= L.fondo / 2, s.id));
  assert.equal(TOUR.find(t => t.spawn === 'admin').floorLevel, 2);
  assert.equal(TOUR.length, 7);
});
