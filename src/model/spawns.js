import { SITIO as S, FLOOR_HEIGHT, mundo } from './program.js';

// Puntos de aparición y paradas del recorrido (metros, mundo). Cada uno lleva un FOCO (lo que se quiere mostrar): la cámara se coloca en un punto
// desde el que se aprecia bien, a la `altura` indicada, y mira al foco (yaw y cabeceo). `zona` es la parte de la estructura donde debe quedar.
const en = (id, label, x, z, nivel, { foco, altura = 1.65, zona }) => {
  const p = mundo(x, z), f = mundo(foco[0], foco[2]), y = (nivel - 1) * FLOOR_HEIGHT;
  return { id, label, zona, nivel, pos: [p.x, y, p.z], yaw: Math.atan2(-(f.x - p.x), -(f.z - p.z)), foco: [f.x, foco[1], f.z], altura };
};
const { H, L } = S, cx = S.xH + H.ancho / 2, izq = L.izq.pisos[0], der = L.der.pisos;
const aula = izq.recintos.find(r => /Aula convencional 1/.test(r.nombre));
const zCorr = (d, i) => S.zEd + (d.corredores[i].z0 + d.corredores[i].z1) / 2, eq = der[0].recintos.find(r => r.tipo === 'equipos-tierra');
const ax = S.xEd + aula.puerta.x;

export const XR_SPAWNS = Object.freeze([
  en('plataforma', 'Plataforma y pista', cx - 6, S.zFr + 27.5, 1, { foco: [cx, 2.0, S.zFr + 4], altura: 3.0, zona: 'exterior' }),        // desde el borde de la plataforma, algo elevado
  en('porton', 'Portón del hangar', cx + 2, S.zFr + 11, 1, { foco: [cx - 6, 2.2, S.zEd + 14], zona: 'exterior' }),                          // frente al portón, mirando hacia adentro
  en('hangar', 'Interior del hangar', S.xH + 2.2, S.zFr - 3.2, 1, { foco: [cx + 6, 1.4, S.zEd + 17], altura: 4.2, zona: 'hangar' }),      // esquina delantera, a vista de las cuatro aeronaves
  en('taller', 'Taller y banderas', cx, S.zEd + 8.4, 1, { foco: [cx, 4.0, S.zEd + 0.6], altura: 2.6, zona: 'hangar' }),                    // pasillo del taller, algo elevado, frente al muro de las banderas
  en('equipos', 'Equipos de tierra', S.xD - 6, S.zEd + 4.5, 1, { foco: [S.xD + 6, 1.3, S.zEd + 4.5], zona: 'hangar' }),                    // desde el hangar, a través del portón de 4 m
  en('formacion', 'Aula de formación', ax, S.zEd + aula.z0 + 0.75, 1, { foco: [ax, 1.5, S.zEd + aula.z1 - 0.4], zona: 'izq' }),            // dentro del aula, junto a la puerta, frente al tablero
  en('admin', 'Administración (2º piso)', S.xD + 1.8, zCorr(der[1], 0), 2, { foco: [S.xD - 17, 1.8, S.zEd + 22], zona: 'der' }),          // junto al ventanal, con el hangar a la vista
]);

export const spawnById = id => XR_SPAWNS.find(s => s.id === id);
