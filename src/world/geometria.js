import * as THREE from 'three';

const RAD = Math.PI / 180;

/** Interpola estaciones [z, ancho, alto, yc, exponente] con spline suave y devuelve muestras y una función z→t. */
export function muestrear(est, n) {
  const A = new THREE.CatmullRomCurve3(est.map(s => new THREE.Vector3(s[0], s[1], s[2])), false, 'centripetal');
  const B = new THREE.CatmullRomCurve3(est.map(s => new THREE.Vector3(s[3], s[4] ?? 2, 0)), false, 'centripetal');
  const filas = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, a = A.getPoint(t), b = B.getPoint(t); return { t, z: a.x, w: Math.max(a.y, 0.001), h: Math.max(a.z, 0.001), yc: b.x, e: Math.max(1.6, b.y) }; });
  const tz = z => { let lo = 0, hi = n; const asc = filas[0].z < filas[n].z; while (hi - lo > 1) { const m = (lo + hi) >> 1; if ((filas[m].z < z) === asc) lo = m; else hi = m; } const a = filas[lo], b = filas[Math.min(lo + 1, n)]; return a.t + (b.t - a.t) * (b.z === a.z ? 0 : (z - a.z) / (b.z - a.z)); };
  return { filas, tz };
}

/** Superficie de sección elíptica (o más cuadrada con exponente>2) a lo largo de z. φ=0 arriba, crece hacia +x (babor). */
export function loft(est, { n = 90, m = 36, phi0 = 0, phi1 = 360, escala = 1, cerrar = true } = {}) {
  const { filas, tz } = muestrear(est, n), pos = [], uv = [], idx = [], cols = m + 1;
  for (const f of filas) for (let j = 0; j <= m; j++) {
    const phi = (phi0 + (phi1 - phi0) * j / m) * RAD, s = Math.sin(phi), c = Math.cos(phi), k = 2 / f.e;
    pos.push(Math.sign(s) * Math.abs(s) ** k * f.w / 2 * escala, Math.sign(c) * Math.abs(c) ** k * f.h / 2 * escala + f.yc, f.z);
    uv.push((phi0 + (phi1 - phi0) * j / m) / 360, 1 - f.t);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * cols + j, b = a + cols; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  if (cerrar) for (const [i, inv] of [[0, false], [n, true]]) {
    const c = pos.length / 3; let sx = 0, sy = 0; for (let j = 0; j < cols; j++) { sx += pos[(i * cols + j) * 3]; sy += pos[(i * cols + j) * 3 + 1]; }
    pos.push(sx / cols, sy / cols, filas[i].z); uv.push(0.5, 1 - filas[i].t);
    for (let j = 0; j < m; j++) { const a = i * cols + j; idx.push(...(inv ? [c, a + 1, a] : [c, a, a + 1])); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); orientar(g, v => new THREE.Vector3(v.x, v.y - filas[Math.floor(n / 2)].yc, 0));
  return { geo: g, tz, filas };
}

/** Si las normales miran hacia adentro (según `fuera(v)`), invierte el orden de los triángulos. */
export function orientar(g, fuera) {
  const p = g.attributes.position, nrm = g.attributes.normal; let suma = 0;
  for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 40))) suma += new THREE.Vector3().fromBufferAttribute(nrm, i).dot(fuera(new THREE.Vector3().fromBufferAttribute(p, i)).normalize());
  if (suma < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
}

