// Construye el hangar y el predio sin navegador (document simulado) y comprueba invariantes de la geometría.
import assert from 'node:assert/strict';
import * as THREE from 'three';

const context = new Proxy(() => {}, {
  get: (target, key) => key === 'measureText' ? () => ({ width: 100 }) : key in target ? target[key] : context,
  set: (target, key, value) => { target[key] = value; return true; },
  apply: () => context,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const { buildHangarComplex } = await import('../src/world/hangarBuilder.js');
const { buildPredio } = await import('../src/world/predioBuilder.js');
const { SITIO: S } = await import('../src/model/program.js');
const scene = new THREE.Scene();
const building = buildHangarComplex(scene), predio = buildPredio(scene);
scene.updateMatrixWorld(true);

const salas = building.interactiveObjects.filter(o => o.userData.tipo && o.userData.tipo !== 'nucleo');
const esperadas = S.L.der.pisos[0].recintos.length + S.L.der.pisos[1].recintos.length + S.L.izq.pisos[0].recintos.length;
assert.equal(salas.length, esperadas, 'cada recinto del programa tiene su hitbox');
const vacios = salas.filter(o => !(o.userData.muebles >= 6));
assert.deepEqual(vacios.map(o => `${o.userData.name}: ${o.userData.muebles}`), [], 'recintos sin mobiliario');
assert.ok(building.stats.puertas >= esperadas, `puertas ${building.stats.puertas} < recintos ${esperadas}`);
assert.equal(building.stats.escaleras, 1); assert.equal(building.stats.ascensores, 1);
assert.ok(building.interactiveObjects.filter(o => o.userData.tipo === 'nucleo').length === 2, 'núcleo en ambos pisos');

// Aeronaves: la Cessna 206 aparece afuera; cualquiera puede salir o entrar por su cuenta sin tocar las demás.
const A = building.aeronaves;
assert.equal(Object.keys(A).length, 4);
assert.deepEqual(Object.entries(A).filter(([, a]) => a.afuera).map(([id]) => id), ['c206']);
const antes = Object.fromEntries(Object.entries(A).map(([id, a]) => [id, a.grupo.position.z]));
building.moverAeronave('c210', true, 0.01);
assert.equal(A.c210.afuera, true);
assert.ok(['tc685', 'bell206', 'c206'].every(id => A[id].grupo.position.z === antes[id]), 'mover una no mueve las demás');
building.moverTodas(false); assert.ok(Object.values(A).every(a => !a.afuera));

// Cada modelo cabe en su huella (rectángulo ancho × largo) y el Bell, dentro de su círculo de radio largo/2.
for (const a of S.H.aeronaves) {
  const g = building.aeronaves[a.id].grupo; g.updateMatrixWorld(true);
  const c = g.getWorldPosition(new THREE.Vector3()), box = new THREE.Box3(), pts = [], t = 0.3;
  g.traverse(o => { if (o.isMesh && o.name !== 'Hitbox') { box.expandByObject(o, true); const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 5) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); } });
  if (a.tipoZona === 'circulo') {
    const r = Math.max(...pts.map(p => Math.hypot(p.x - c.x, p.z - c.z)));
    assert.ok(r <= a.largo / 2 + t, `${a.nombre}: sobresale del círculo (${r.toFixed(2)} > ${(a.largo / 2).toFixed(2)})`);
  } else {
    assert.ok(box.max.x - c.x <= a.ancho / 2 + t && c.x - box.min.x <= a.ancho / 2 + t, `${a.nombre}: sobresale de la envergadura`);
    assert.ok(box.max.z - c.z <= a.largo / 2 + t && c.z - box.min.z <= a.largo / 2 + t, `${a.nombre}: sobresale del largo`);
  }
  assert.ok(box.max.y <= a.alto + 0.3 && box.min.y >= -0.05, `${a.nombre}: altura ${box.max.y.toFixed(2)} vs ${a.alto}`);
}

// Suelo caminable: terreno, plataforma, losas de hangar y bloques, y el 2º piso a su cota.
const pisos = []; scene.traverse(o => { if (o.userData.floorArea && o.name !== 'Rampa escalera') pisos.push(o); });
const cotas = [...new Set(pisos.map(o => +(o.position.y + (o.geometry.parameters.height / 2)).toFixed(2)))].sort();
assert.deepEqual(cotas, [0.02, S.L.der.pisos[1] && 3.8], 'losas a 0,02 m (piso 1) y 3,8 m (piso 2)');

// ── Salida de las aeronaves: ningún elemento fijo en el barrido de cada una (cuerpo, alas y cola) hasta su puesto exterior ──
{
  for (const A_ of Object.values(building.aeronaves)) A_.grupo.position.z = A_.dentro;
  scene.updateMatrixWorld(true);
  const grupos = new Map(Object.entries(building.aeronaves).map(([id, A_]) => [A_.grupo, id]));
  const dueno = o => { for (let n = o; n; n = n.parent) if (grupos.has(n)) return grupos.get(n); return null; };
  const retirable = o => { for (let n = o; n; n = n.parent) if (n.userData.retirable) return true; return false; };   // calzos: se retiran antes de remolcar
  const cajas = [], m4 = new THREE.Matrix4(), b = new THREE.Box3();
  scene.traverse(o => {
    if (!o.isMesh || o.name === 'Hitbox' || o.material?.visible === false || o.userData.floorArea || o.userData.walkable || retirable(o)) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const meter = box => { if (box.max.y > 0.1) cajas.push({ box: box.clone(), o, dueno: dueno(o) }); };
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); meter(b.copy(g.boundingBox).applyMatrix4(m4.premultiply(o.matrixWorld))); }
    else meter(b.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
  });
  for (const a of S.H.aeronaves) {
    const propio = new THREE.Box3(); cajas.filter(c => c.dueno === a.id).forEach(c => propio.union(c.box));
    const puesto = S.PL.puestos.find(q => q.id === a.id), zFin = S.zEd + puesto.z + S.oz + a.largo / 2 + 0.3;
    const barrido = new THREE.Box3(new THREE.Vector3(propio.min.x - 0.1, 0.1, propio.min.z), new THREE.Vector3(propio.max.x + 0.1, propio.max.y, zFin));
    const choques = cajas.filter(c => c.dueno !== a.id && c.box.intersectsBox(barrido));
    const nombres = [...new Set(choques.map(c => `${c.o.name || c.o.parent?.name || c.o.material?.type} @ x=${((c.box.min.x + c.box.max.x) / 2).toFixed(1)} z=${((c.box.min.z + c.box.max.z) / 2).toFixed(1)} h=${c.box.max.y.toFixed(1)}${c.dueno ? ' [' + c.dueno + ']' : ''}`))];
    assert.deepEqual(nombres.slice(0, 40), [], `${a.nombre}: algo estorba su salida al exterior (${choques.length} piezas)`);
  }
}

// ── Recorrido a pie: aparición válida, colisiones, puertas y escalera (mismo código que el visor, sin navegador) ──
globalThis.window = { addEventListener() {} };
const { PedestrianControls } = await import('../src/modes/pedestrianControls.js');
const { XR_SPAWNS } = await import('../src/model/spawns.js');
const { FLOOR_HEIGHT } = await import('../src/model/program.js');
scene.updateMatrixWorld(true);
const camera = new THREE.PerspectiveCamera();
const pc = new PedestrianControls({ camera, renderer: {}, scene, orbitControls: { enabled: true, target: new THREE.Vector3(), update() {} },
  walkableSurfaces: [predio, building.rootGroup], obstaculos: [...building.obstaculos, ...predio.userData.obstaculos] });
const poner = (x, y, z, yaw = 0) => { pc.active = true; pc.currentFloorElevation = y; camera.position.set(x, y + 1.65, z); pc.yaw = yaw; pc.velocity.set(0, 0, 0); pc.keys.forward = false; };
const caminar = (seg, dt = 0.05) => { pc.keys.forward = true; for (let t = 0; t < seg; t += dt) pc.update(dt); pc.keys.forward = false; };
// Cada parada del recorrido: dentro de la zona que muestra, sobre suelo a su cota, sin pared a menos de 0,45 m, fuera de las zonas SMS
// y con vista libre (sin muros ni columnas) hasta lo que se quiere mostrar. Se parte con todas las aeronaves dentro.
const { Materials: Mat } = await import('../src/look/materials.js');
const muros = building.obstaculos.filter(o => o.isInstancedMesh && o.material !== Mat.lowEGlass);   // el vidrio no tapa la vista
const rayo = new THREE.Raycaster();
const zonas = {
  hangar: [S.xH, S.xD, S.zEd, S.zFr], izq: [S.xEd, S.xEd + S.L.anchoIzq, S.zEd, S.zFr], der: [S.xD, S.xD + S.L.anchoDer, S.zEd, S.zFr],
  exterior: [0, S.L.ancho, S.zFr, S.L.fondo],
};
for (const sp of XR_SPAWNS) {
  const [x, y, z] = sp.pos; poner(x, y, z, sp.yaw);
  const px = x - S.ox, pz = z - S.oz, [x0, x1, z0, z1] = zonas[sp.zona];
  assert.ok(px > x0 + 0.3 && px < x1 - 0.3 && pz > z0 + 0.3 && pz < z1 - 0.3, `${sp.id}: fuera de su zona (${sp.zona}) en planta (${px.toFixed(1)}, ${pz.toFixed(1)})`);
  const g = pc.getGroundHeightAt(x, z, y);
  assert.ok(g !== null && Math.abs(g - y) < 0.12, `${sp.id}: sin suelo a su cota (suelo ${g}, esperado ${y})`);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; assert.equal(pc.golpe(x, z, Math.cos(a), Math.sin(a), 0.45), null, `${sp.id}: queda pegado a un obstáculo (${k * 45}°)`); }
  const [fx, fy, fz] = sp.foco, dx = fx - x, dz = fz - z, dist = Math.hypot(dx, dz);
  assert.ok(dist > 2.5, `${sp.id}: el foco está demasiado cerca`);
  const ojo = new THREE.Vector3(x, y + sp.altura, z), objetivo = new THREE.Vector3(fx, fy, fz), dir = objetivo.clone().sub(ojo);
  rayo.set(ojo, dir.clone().normalize()); rayo.far = dir.length() - 0.3;
  const tapa = rayo.intersectObjects(muros, false)[0];
  assert.equal(tapa, undefined, `${sp.id}: un muro o columna tapa la vista al foco (a ${tapa?.distance.toFixed(1)} m)`);
  if (sp.zona === 'hangar') for (const a of S.H.aeronaves) {   // fuera de las zonas SMS pintadas en el piso
    const cx_ = S.xH + a.x, cz_ = S.zEd + a.z, dentroZona = a.zona.tipo === 'circulo' ? Math.hypot(px - cx_, pz - cz_) < a.zona.r1 : Math.abs(px - cx_) < a.zona.ancho / 2 && Math.abs(pz - cz_) < a.zona.fondo / 2;
    assert.ok(!dentroZona, `${sp.id}: está dentro de la zona SMS de ${a.nombre}`);
  }
}
{ // no atraviesa el muro del hangar caminando hacia el este desde el interior
  const e = S.xD + S.ox; poner(S.xD - 6 + S.ox, 0, S.zFr - 3 + S.oz, -Math.PI / 2); caminar(4);
  assert.ok(camera.position.x < e - 0.2 && camera.position.x > e - 1.2, `atravesó el muro este del hangar (x=${camera.position.x.toFixed(2)}, muro=${e.toFixed(2)})`);
}
for (const A_ of Object.values(building.aeronaves)) A_.grupo.position.z = A_.dentro;   // las 4 dentro del hangar
scene.updateMatrixWorld(true);
for (const a of S.H.aeronaves) { // de frente contra cada aeronave: se detiene antes de entrar en ella
  const cx = S.xH + a.x + S.ox, cz = S.zEd + a.z + S.oz, zIni = cz + a.largo / 2 + 4; poner(cx, 0, zIni, 0); caminar(3);
  assert.ok(camera.position.z > cz - 1.5 && camera.position.z < zIni - 0.5, `${a.nombre}: no se detuvo (z=${camera.position.z.toFixed(2)}, centro=${cz.toFixed(2)})`);
}
{ // entra por la puerta de un aula (del corredor al recinto) sin quedar trabado
  const d = S.L.izq.pisos[0], r = d.recintos.find(q => /Aula convencional 1/.test(q.nombre)), x = S.xEd + r.puerta.x + S.ox;
  const zPuerta = S.zEd + (r.lado === 's' ? r.z1 : r.z0) + S.oz, haciaCuarto = r.lado === 's' ? -1 : 1;
  poner(x, 0, zPuerta - haciaCuarto * 1.2, haciaCuarto < 0 ? 0 : Math.PI); caminar(1.2);
  const dentro = haciaCuarto < 0 ? camera.position.z < zPuerta - 0.5 : camera.position.z > zPuerta + 0.5;
  assert.ok(dentro, `no logró entrar por la puerta de ${r.nombre} (z=${camera.position.z.toFixed(2)}, puerta=${zPuerta.toFixed(2)})`);
}
{ // sube la escalera de un tramo hasta el 2º piso
  const nuc = S.L.der.pisos[0].nucleo, sx = S.xD + nuc.x0 + 0.6 + 0.75 + S.ox, zs = S.zEd + nuc.z1 - 0.5 + S.oz;
  poner(sx, 0, zs - 0.1, 0); caminar(2.4);   // arranca dentro del núcleo, al pie de la escalera (se entra por su puerta al corredor)
  assert.ok(Math.abs(pc.currentFloorElevation - FLOOR_HEIGHT) < 0.15, `no subió al piso 2 (cota ${pc.currentFloorElevation.toFixed(2)})`);
}
let meshes = 0; scene.traverse(o => { if (o.isMesh) meshes++; });
console.log({ meshes, recintos: salas.length, puertas: building.stats.puertas, interactivos: building.interactiveObjects.length, muebles: salas.map(o => o.userData.muebles).sort((a, b) => a - b).slice(0, 3) });
