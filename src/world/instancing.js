import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 18);

/**
 * Collects boxes and cylinders and emits one InstancedMesh per (shape, material).
 * Geometry is a unit shape scaled per instance, so a whole wing level's furniture,
 * partitions and sun fins cost a handful of draw calls instead of hundreds.
 */
export class InstanceBatcher {
  constructor() {
    this.buckets = new Map();
    this.dummy = new THREE.Object3D();
  }

  box(material, position, size, rotation = [0, 0, 0]) {
    this.add('box', material, position, size, rotation);
  }

  /** Cylinder standing along Y: `size` is [radius, height, radius]. */
  cylinder(material, position, size, rotation = [0, 0, 0]) {
    this.add('cylinder', material, position, size, rotation);
  }

  add(shape, material, position, size, rotation) {
    const key = shape + ':' + material.uuid;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { shape, material, matrices: [] };
      this.buckets.set(key, bucket);
    }
    this.dummy.position.fromArray(position);
    this.dummy.scale.fromArray(size);
    this.dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
    this.dummy.updateMatrix();
    bucket.matrices.push(this.dummy.matrix.clone());
  }

  flush(group, { castShadow = true, receiveShadow = false } = {}) {
    for (const { shape, material, matrices } of this.buckets.values()) {
      const mesh = new THREE.InstancedMesh(shape === 'box' ? unitBox : unitCylinder, material, matrices.length);
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    this.buckets.clear();
  }
}

/** Deterministic generator so landscaping looks identical on every load and in tests. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashString = text => [...text].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

const tuftGeometry = new THREE.ConeGeometry(0.2, 1, 5).translate(0, 0.5, 0);
const shrubGeometry = new THREE.IcosahedronGeometry(0.5, 0);
const GREENS = [0x5c9a3a, 0x6fae45, 0x4f8a34, 0x86b84f, 0x9cc25a, 0x3f7d33];

/**
 * Scatters grass tufts and low shrubs over rectangles of a roof or deck (coordinates local to `group`).
 * `avoid` lists rectangles to keep clear, such as pavilion decks and paths.
 */
export function scatterPlants(group, { rects, y, density = 3, avoid = [], seed = 1, material, palette = GREENS }) {
  const random = seededRandom(seed);
  const tufts = [];
  const shrubs = [];
  const blocked = (x, z) => avoid.some(area => x > area.x0 && x < area.x1 && z > area.z0 && z < area.z1);
  for (const rect of rects) {
    const count = Math.round((rect.x1 - rect.x0) * (rect.z1 - rect.z0) * density);
    for (let i = 0; i < count; i++) {
      const x = rect.x0 + random() * (rect.x1 - rect.x0);
      const z = rect.z0 + random() * (rect.z1 - rect.z0);
      if (blocked(x, z)) continue;
      const plant = { x, z, scale: 0.6 + random() * 0.9, color: palette[Math.floor(random() * palette.length)], turn: random() * Math.PI };
      (random() < 0.8 ? tufts : shrubs).push(plant);
    }
  }
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const build = (list, geometry, heightScale, lift) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((plant, index) => {
      dummy.position.set(plant.x, y + lift * plant.scale, plant.z);
      dummy.rotation.set(0, plant.turn, 0);
      dummy.scale.set(plant.scale, plant.scale * heightScale, plant.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color.setHex(plant.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };
  build(tufts, tuftGeometry, 1.3, 0);
  build(shrubs, shrubGeometry, 0.8, 0.22);
}
