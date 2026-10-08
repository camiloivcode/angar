// Programa de recintos y su distribución en planta: crujías de ~9 m a ambos lados de corredores, núcleo de escaleras y recintos que
// llenan el bloque sin dejar huecos. Coordenadas locales del bloque: x desde su borde occidental, z desde el borde posterior (norte).
import { PARAMS } from './medidas.js';

const DOBLES = new Set(['multiple', 'lab-electricidad', 'lab-avionica', 'lab-instrumentos', 'lab-hidraulica', 'lab-compuestos', 'equipos-tierra', 'almacen', 'cafeteria', 'biblioteca', 'juntas']);

export function programaFormacion(p = PARAMS) {
  const m = p.m2Persona, lab = (nombre, tipo) => ({ nombre, tipo, cap: 25, m2: 25 * m.laboratorio });
  return [
    ...Array.from({ length: 7 }, (_, k) => ({ nombre: `Aula convencional ${k + 1}`, tipo: 'aula', cap: 25, m2: 25 * m.aula })),
    { nombre: 'Sala de informática', tipo: 'informatica', cap: 25, m2: 25 * m.informatica },
    { nombre: 'Aula múltiple', tipo: 'multiple', cap: 125, m2: 125 * m.multiple },
    lab('Laboratorio de electricidad', 'lab-electricidad'), lab('Laboratorio de aviónica', 'lab-avionica'), lab('Laboratorio de instrumentos', 'lab-instrumentos'),
    lab('Laboratorio de hidráulica y neumática', 'lab-hidraulica'), lab('Laboratorio de materiales compuestos', 'lab-compuestos'),
    { nombre: 'Baños mujeres', tipo: 'banos', m2: 30 }, { nombre: 'Baños hombres', tipo: 'banos', m2: 30 },
  ];
}

// Piso 2 del bloque administrativo: 150 personas simultáneas en oficinas (puestos + sillas de sala) a ~6 m² por persona.
export function programaAdminPiso2() {
  return [
    { nombre: 'Dirección', tipo: 'direccion', puestos: 2, m2: 24, crujia: 1, vistaHangar: true },
    ...Array.from({ length: 3 }, (_, k) => ({ nombre: `Coordinación ${k + 1}`, tipo: 'coordinacion', puestos: 6, m2: 36 })),
    { nombre: 'Sala de juntas', tipo: 'juntas', puestos: 14, m2: 50, crujia: 0, vistaHangar: true },
    { nombre: 'Cafetín', tipo: 'cafetin', puestos: 12, m2: 24 },
    ...Array.from({ length: 5 }, (_, k) => ({ nombre: `Oficina abierta ${k + 1}`, tipo: 'oficina', puestos: 21, m2: 126, ...(k === 0 ? { crujia: 2, vistaHangar: true } : {}) })),
    { nombre: 'Baños mujeres', tipo: 'banos', m2: 18 }, { nombre: 'Baños hombres', tipo: 'banos', m2: 18 },
  ];
}

// Piso 1 del bloque administrativo: recepción, archivo, áreas técnicas (con puerta directa al hangar) y apoyo y bienestar.
export function programaAdminPiso1(p = PARAMS) {
  return [
    { nombre: 'Equipos de tierra', tipo: 'equipos-tierra', m2: 80, crujia: 0, aHangar: 4.0 },
    { nombre: 'Almacén aeronáutico', tipo: 'almacen', m2: 80, crujia: 1, aHangar: 1.8 },
    { nombre: 'Zona cero (cuarentena de componentes)', tipo: 'cuarentena', m2: 50, crujia: 2, aHangar: 1.0 },
    { nombre: 'Cuarto de bombas y compresores', tipo: 'bombas', m2: 30 },
    { nombre: 'Recepción y espera', tipo: 'recepcion', puestos: 3, m2: 36 },
    { nombre: 'Archivo', tipo: 'archivo', puestos: 0, m2: 36 },
    { nombre: 'Enfermería', tipo: 'enfermeria', m2: 30 },
    { nombre: 'Sala de instructores', tipo: 'instructores', puestos: 8, m2: 60 },
    { nombre: 'Cafetería (2 turnos)', tipo: 'cafeteria', cap: 150, m2: 150 * p.m2Persona.cafeteria },
    { nombre: 'Biblioteca', tipo: 'biblioteca', m2: 100 },
    { nombre: 'Cuarto de aseo', tipo: 'aseo', m2: 15 },
    { nombre: 'Baños mujeres', tipo: 'banos', m2: 15 }, { nombre: 'Baños hombres', tipo: 'banos', m2: 15 },
  ];
}

// Reparto "peor ajuste": coloca cada recinto en la crujía con más holgura, para que todas queden parejas y ninguna vacía.
function asignar(items, n, W, nucleo, nucC) {
  const cap = Array.from({ length: n }, (_, i) => W - (i === nucC ? nucleo : 0)), grupos = Array.from({ length: n }, () => []);
  for (const r of items.filter(r => r.crujia !== undefined)) { cap[r.crujia] -= r.len; grupos[r.crujia].push(r); }
  if (cap.some(c => c < -1e-9)) return null;
  for (const r of items.filter(r => r.crujia === undefined).sort((a, b) => b.len - a.len)) {
    const i = cap.indexOf(Math.max(...cap));
    if (cap[i] < r.len - 1e-9) return null;
    cap[i] -= r.len; grupos[i].push(r);
  }
  return grupos.every(g => g.length) ? grupos : null;
}

/**
 * Distribuye `rooms` en un bloque de profundidad D. `ladoHangar` ('der' | 'izq') es el lado donde está el hangar.
 * Cada recinto recibe puerta al corredor, ventanas y, si aplica, puerta al hangar; el núcleo (escalera) ocupa el extremo lejano de la crujía central.
 */
export function distribuirBloque(rooms, { D, ladoHangar, nucleoAncho = 0, Wmin = 0, corredorAlHangar = false, p = PARAMS }) {
  const corr = p.corredor, n = Math.max(1, Math.round((D + corr) / (p.profCrujia + corr)));
  const prof = (D - (n - 1) * corr) / n, nucC = nucleoAncho ? Math.floor(n / 2) : -1;
  const items = rooms.map(r => ({ ...r, len: r.m2 / prof }));
  let W = Math.max(Wmin, Math.ceil((items.reduce((s, r) => s + r.len, 0) + nucleoAncho) / n)), grupos;
  while (!(grupos = asignar(items, n, W, nucleoAncho, nucC))) W += 0.5;
  const crujZ = i => i * (prof + corr), espejo = (u0, u1) => ladoHangar === 'der' ? [W - u1, W - u0] : [u0, u1];
  const recintos = [], ventanas = [], aberturasHangar = [];
  const lejano = ladoHangar === 'der' ? 'o' : 'e';   // pared del extremo lejano al hangar
  grupos.forEach((g, i) => {
    const Lc = W - (i === nucC ? nucleoAncho : 0), f = Lc / g.reduce((s, r) => s + r.len, 0);
    g.sort((a, b) => (b.vistaHangar || b.aHangar ? 1 : 0) - (a.vistaHangar || a.aHangar ? 1 : 0));   // los de contacto con el hangar, primero
    let u = 0;
    g.forEach((r, k) => {
      const ancho = r.len * f, [x0, x1] = espejo(u, u + ancho), z0 = crujZ(i), cx = (x0 + x1) / 2, lado = i === 0 ? 's' : 'n';
      const pa = DOBLES.has(r.tipo) ? 1.8 : ancho < 2.4 ? 0.9 : 1.0;
      const rec = { ...r, x0, x1, z0, z1: z0 + prof, ancho, fondo: prof, m2: ancho * prof, m2Neto: r.m2, crujia: i, lado, puerta: { x: cx, ancho: pa } };
      delete rec.len;
      if (r.aHangar) { rec.puertaHangar = { z: z0 + prof / 2, ancho: r.aHangar }; aberturasHangar.push({ z0: z0 + prof / 2 - r.aHangar / 2, z1: z0 + prof / 2 + r.aHangar / 2, alto: r.aHangar > 3 ? 3.4 : 2.2 }); }
      // ventanas: fachada exterior (crujías de borde), extremo lejano y luz prestada desde el corredor
      if (ancho >= 1.8 && r.tipo !== 'banos' && r.tipo !== 'aseo') {
        if (i === 0) ventanas.push({ crujia: i, pared: 'n', c: cx, w: Math.min(2.4, ancho - 1.0), yb: 0.9, yt: 2.2 });
        if (i === n - 1) ventanas.push({ crujia: i, pared: 's', c: cx, w: Math.min(2.4, ancho - 1.0), yb: 0.9, yt: 2.2 });
      } else if (i === 0 || i === n - 1) ventanas.push({ crujia: i, pared: i === 0 ? 'n' : 's', c: cx, w: 0.6, yb: 1.7, yt: 2.2 });
      if (k === g.length - 1 && i !== nucC) ventanas.push({ crujia: i, pared: lejano, c: z0 + prof / 2, w: 2.0, yb: 0.9, yt: 2.2 });
      const ladoV = pa / 2 + 0.3 + 0.6 <= ancho / 2 - 0.2 ? 1 : -1;
      if (ancho >= 3.4) ventanas.push({ crujia: i, pared: lado, c: cx + ladoV * (pa / 2 + 0.3 + 0.6), w: 1.2, yb: 1.0, yt: 2.2, luzPrestada: true });
      recintos.push(rec);
      u += ancho;
    });
  });
  const corredores = Array.from({ length: n - 1 }, (_, k) => ({ z0: crujZ(k) + prof, z1: crujZ(k + 1), x0: 0, x1: W,
    alHangar: corredorAlHangar, accesoExterior: true }));
  corredores.forEach(c => { if (corredorAlHangar) aberturasHangar.push({ z0: (c.z0 + c.z1) / 2 - 0.9, z1: (c.z0 + c.z1) / 2 + 0.9, alto: 2.2 }); });
  let nucleo = null;
  if (nucC >= 0) { const [x0, x1] = espejo(W - nucleoAncho, W); nucleo = { x0, x1, z0: crujZ(nucC), z1: crujZ(nucC) + prof, crujia: nucC, puertas: [{ lado: 'n', x: (x0 + x1) / 2 }, { lado: 's', x: (x0 + x1) / 2 }] }; }
  return { W, D, prof, n, corredor: corr, crujias: Array.from({ length: n }, (_, i) => ({ z0: crujZ(i), z1: crujZ(i) + prof })), corredores, recintos,
    ventanas, nucleo, aberturasHangar, ladoHangar, lejano, netoTotal: rooms.reduce((s, r) => s + r.m2, 0) };
}

/** Bloque izquierdo: ambientes de formación (un piso). El muro del lado del hangar es ciego: sin puertas ni vista al hangar. */
export function bloqueFormacion(D, p = PARAMS) {
  const a = distribuirBloque(programaFormacion(p), { D, ladoHangar: 'der', p });
  return { W: a.W, D, pisos: [a] };
}

/** Bloque derecho: oficinas administrativas. Piso 1 con técnicas (puerta al hangar) y apoyo; piso 2 con oficinas y ventanal al hangar. Comparten huella y núcleo. */
export function bloqueAdmin(D, p = PARAMS) {
  const o = { D, ladoHangar: 'izq', nucleoAncho: p.nucleoAncho, p };
  let W = 0, a, b;
  do { W = Math.max(W, (a = distribuirBloque(programaAdminPiso1(p), { ...o, corredorAlHangar: true, Wmin: W })).W, (b = distribuirBloque(programaAdminPiso2(), { ...o, Wmin: W })).W); }
  while (a.W !== W || b.W !== W);
  return { W, D, pisos: [a, b] };
}
