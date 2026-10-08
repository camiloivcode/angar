import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Materials } from '../look/materials.js';
import { seededRandom } from './instancing.js';

// Árboles por especie: cada una con su tronco, copa exterior y copa interior (tres InstancedMesh).
// Los colores de las copas salen del color por instancia (el material de follaje es blanco).

/** Copa de blobs orgánicos: icosaedros perturbados con UV esféricas. */
function canopyGeometry(blobs, seed) {
  const random = seededRandom(seed);
  const parts = blobs.map(([x, y, z, radius]) => {
    const blob = mergeVertices(new THREE.IcosahedronGeometry(radius, 2), 1e-4);
    const position = blob.attributes.position;
    const uv = blob.attributes.uv;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      const len = v.length();
      if (uv) {
        uv.setXY(i, (0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2)) * 2,
          (0.5 - Math.asin(Math.max(-1, Math.min(1, v.y / Math.max(0.001, len)))) / Math.PI) * 2);
      }
      v.multiplyScalar(1 + (random() - 0.5) * 0.28);
      position.setXYZ(i, v.x + x, v.y * 0.92 + y, v.z + z);
    }
    blob.computeVertexNormals();
    return blob;
  });
  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Cilindro cónico entre dos puntos. */
function limb(from, to, rFrom, rTo, segments = 6) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const geometry = new THREE.CylinderGeometry(rTo, rFrom, length, segments);
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  geometry.translate(from.x, from.y, from.z);
  return geometry;
}

/** Tronco cónico con ensanche de raíz y ramas que suben hacia la copa. */
function trunkGeometry({ height, r0, r1, branches = [] }) {
  const flare = new THREE.CylinderGeometry(r0, r0 * 1.7, 0.4, 8);
  flare.translate(0, 0.2, 0);
  const parts = [limb(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0, height, 0), r0, r1, 8), flare];
  for (const [x, y, z, r] of branches) {
    parts.push(limb(new THREE.Vector3(0, height * 0.65, 0), new THREE.Vector3(x, y, z), r, r * 0.45));
  }
  return mergeGeometries(parts, false);
}

/** Tronco de palma ligeramente curvo, hecho de tramos; devuelve también la posición de la corona. */
function palmTrunk(height, lean) {
  const parts = [];
  const steps = 6;
  let prev = new THREE.Vector3(0, 0.2, 0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const next = new THREE.Vector3(lean * t * t, 0.2 + height * t, 0);
    parts.push(limb(prev, next, 0.27 - 0.1 * ((i - 1) / steps), 0.27 - 0.1 * t, 7));
    prev = next;
  }
  const flare = new THREE.CylinderGeometry(0.27, 0.45, 0.4, 8);
  flare.translate(0, 0.2, 0);
  parts.push(flare);
  return { geometry: mergeGeometries(parts, false), top: prev };
}

/** Fronda: tira de triángulos con arco y ancho que crece y se cierra, apoyada en el origen. */
function frondGeometry(length, width) {
  const rows = 7;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(t * 1.05, 1)), 0.7) + 0.03;
    const x = length * t, y = 0.55 * t - 1.0 * t * t;   // sube y luego cuelga
    positions.push(x, y, -w / 2, x, y, w / 2);
    uvs.push(t * 2, 0, t * 2, 1);
    if (i < rows) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Corona de palma: fronda por cada dirección, con ligera variación de largo y elevación. */
function palmCrown(count, length, width, top, seed) {
  const random = seededRandom(seed);
  const parts = [];
  for (let k = 0; k < count; k++) {
    const g = frondGeometry(length * (0.85 + random() * 0.3), width);
    g.rotateZ((random() - 0.3) * 0.5);
    g.rotateY((k / count) * Math.PI * 2 + random() * 0.3);
    g.translate(top.x, top.y, top.z);
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

const palm = (() => {
  const { geometry, top } = palmTrunk(7.6, 0.7);
  return { trunk: geometry, outer: palmCrown(11, 3.0, 0.62, top, 5), inner: palmCrown(8, 2.1, 0.5, top.clone().setY(top.y + 0.15), 9) };
})();

const SPECIES = {
  saman: {   // sombrilla ancha y baja
    trunk: trunkGeometry({ height: 4.3, r0: 0.42, r1: 0.26, branches: [[-2.3, 5.3, 0.4, 0.2], [2.2, 5.4, -0.5, 0.2], [0.2, 5.6, 2.0, 0.18]] }),
    outer: canopyGeometry([[0, 6.0, 0, 3.1], [-3.0, 5.4, 0.9, 2.3], [3.0, 5.6, -0.9, 2.4], [0.6, 6.9, 0.3, 2.1], [-1.0, 5.2, -2.4, 2.1]], 11),
    inner: canopyGeometry([[0.4, 6.7, 0.2, 2.0], [-2.2, 5.9, 0.6, 1.5], [2.4, 6.0, -0.5, 1.5]], 23),
  },
  ficus: {   // domo denso
    trunk: trunkGeometry({ height: 3.0, r0: 0.45, r1: 0.3, branches: [[-1.3, 4.0, 0.3, 0.2], [1.2, 4.1, -0.3, 0.2]] }),
    outer: canopyGeometry([[0, 4.6, 0, 2.6], [-1.7, 3.9, 0.6, 1.9], [1.7, 4.1, -0.6, 2.0], [0.2, 5.6, 0.3, 1.7]], 31),
    inner: canopyGeometry([[0.4, 5.3, 0.2, 1.6], [-1.3, 4.5, 0.4, 1.2]], 37),
  },
  guayacan: {   // esbelto y aireado, de flor amarilla o rosada
    trunk: trunkGeometry({ height: 4.6, r0: 0.26, r1: 0.15, branches: [[-1.1, 5.5, 0.2, 0.1], [1.0, 5.7, -0.3, 0.1]] }),
    outer: canopyGeometry([[0, 6.0, 0, 1.9], [-1.3, 5.4, 0.5, 1.4], [1.2, 5.6, -0.5, 1.45], [0.2, 6.8, 0.2, 1.2]], 41),
    inner: canopyGeometry([[0.3, 6.4, 0, 1.1], [-0.9, 5.7, 0.3, 0.9]], 43),
  },
  palm,
};

const speciesOf = type => (type === 'guayacan_yellow' || type === 'guayacan_pink' ? 'guayacan' : type);

/** Color de copa exterior e interior por especie, con variación sutil por árbol. */
function foliageColors(type, random, outer, inner) {
  const shift = (random() - 0.5) * 0.06, light = random() * 0.05;
  switch (type) {
    case 'guayacan_yellow': outer.setHex(0xf5b800); inner.setHex(0xffd54f); break;
    case 'guayacan_pink': outer.setHex(0xd95f8b); inner.setHex(0xf492b4); break;
    case 'palm': outer.setHSL(0.27 + shift, 0.55, 0.28 + light); inner.setHSL(0.26 + shift, 0.6, 0.38 + light); break;
    case 'saman': outer.setHSL(0.30 + shift, 0.55, 0.19 + light); inner.setHSL(0.29 + shift, 0.5, 0.28 + light); break;
    default: outer.setHSL(0.28 + shift, 0.55, 0.22 + light); inner.setHSL(0.30 + shift, 0.55, 0.30 + light);
  }
}

/**
 * Coloca los árboles de `treeData` ({ x, z, s, type }) como instancias, agrupados por especie.
 * Determinista: la variación (giro, escala, inclinación, tono) sale de un generador con semilla.
 */
export function buildTrees(group, treeData, seed = 77) {
  const random = seededRandom(seed);
  const dummy = new THREE.Object3D();
  const outer = new THREE.Color(), inner = new THREE.Color();

  for (const [name, geometries] of Object.entries(SPECIES)) {
    const trees = treeData.filter(t => speciesOf(t.type) === name);
    if (!trees.length) continue;
    const trunks = new THREE.InstancedMesh(geometries.trunk, Materials.treeTrunkRealistic, trees.length);
    const foliage = new THREE.InstancedMesh(geometries.outer, Materials.foliageDeepGreen, trees.length);
    const innerFoliage = new THREE.InstancedMesh(geometries.inner, Materials.foliageBrightGreen, trees.length);
    trees.forEach((tree, i) => {
      const lean = name === 'palm' ? 0.05 : 0.035;
      dummy.position.set(tree.x, 0, tree.z);
      dummy.rotation.set((random() - 0.5) * lean * 2, random() * Math.PI * 2, (random() - 0.5) * lean * 2);
      dummy.scale.set(tree.s * (0.92 + random() * 0.16), tree.s * (0.88 + random() * 0.24), tree.s * (0.92 + random() * 0.16));
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      foliage.setMatrixAt(i, dummy.matrix);
      innerFoliage.setMatrixAt(i, dummy.matrix);
      foliageColors(tree.type, random, outer, inner);
      foliage.setColorAt(i, outer);
      innerFoliage.setColorAt(i, inner);
    });
    for (const mesh of [trunks, foliage, innerFoliage]) {
      mesh.name = `Trees_${name}`;
      mesh.castShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    foliage.receiveShadow = true;
    group.add(trunks, foliage, innerFoliage);
  }
}
