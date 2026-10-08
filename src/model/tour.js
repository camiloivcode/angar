import { KIND_INFO, FLOOR_HEIGHT, SITIO } from './program.js';
import { spawnById } from './spawns.js';

const { H, L, PL } = SITIO;
const fmt = n => Math.round(n).toLocaleString('es-CO');
// Recorrido guiado: una parada por lugar clave. `facts` llena los tres datos de la tarjeta.
const STOPS = [
  { spawn: 'plataforma', title: 'Plataforma y pista de rodaje', text: `${KIND_INFO.plataforma.description} Fondo de ${PL.fondo} m, con un círculo de giro de ${PL.giro.toFixed(1)} m para el avión mayor.`,
    facts: [`${PL.fondo} m de fondo`, 'Una sola pista', 'Cono de viento'] },
  { spawn: 'porton', title: 'Portón del hangar', text: `Portón corredizo de ${H.puerta.ancho} × ${H.puerta.alto} m, con las hojas apiladas en los extremos. Cada aeronave sale en línea recta por su carril, sola o con otras.`,
    facts: [`${H.puerta.ancho} × ${H.puerta.alto} m`, 'Salida independiente', 'Puertas peatonales'] },
  { spawn: 'hangar', title: 'Hangar', text: KIND_INFO.hangar.description,
    facts: [`${H.ancho} × ${H.fondo} m`, `${fmt(H.area)} m²`, `Altura libre ${H.alturaLibre} m`] },
  { spawn: 'taller', title: 'Taller y banderas', text: `${KIND_INFO.taller.description} En el muro posterior cuelgan las banderas de Colombia y de Barranquilla.`,
    facts: ['6 m de fondo', 'Dobladoras, prensas y banco de motor', 'Colombia · Barranquilla'] },
  { spawn: 'equipos', title: 'Equipos de tierra y áreas técnicas', text: `${KIND_INFO['equipos-tierra'].description} Junto a él, el almacén aeronáutico y la zona cero (cuarentena de componentes), también con puerta directa al hangar, en el piso 1 del bloque administrativo.`,
    facts: ['Portón al hangar', 'Remolcador AeroTow T2', 'Zona cero en cuarentena'] },
  { spawn: 'formacion', title: 'Ambientes de formación', text: `${KIND_INFO.aula.description} Estás dentro de un aula: siete ambientes convencionales, informática, aula múltiple y cinco laboratorios, en tres crujías con dos corredores, en el bloque izquierdo.`,
    facts: ['25 aprendices por ambiente', '14 recintos de formación', 'Muro ciego hacia el hangar'] },
  { spawn: 'admin', title: 'Administración', text: KIND_INFO.admin.description,
    facts: ['2º piso', 'Ventanal al hangar', `${L.der.pisos[1].recintos.reduce((s, r) => s + (r.puestos || 0), 0)} puestos`] },
];

/** Posición, foco, altura de cámara y nivel de una parada, en el formato de `pedestrianControls.goToPlace`. */
export function placeFor(spawnId) {
  const sp = spawnById(spawnId), [fx, fy, fz] = sp.foco;
  return { position: { x: sp.pos[0], z: sp.pos[2] }, look: { x: fx, z: fz }, mirarY: fy, altura: sp.altura, y: sp.pos[1],
    floorLevel: sp.pos[1] >= 2 ? Math.round(sp.pos[1] / FLOOR_HEIGHT) + 1 : null };
}

export const TOUR = Object.freeze(STOPS.map(stop => Object.freeze({ ...stop, ...placeFor(stop.spawn) })));

/** Estado del recorrido; `onStop(stop, index)` se llama al llegar a cada parada y `onEnd()` al terminar. */
export function createTour(stops, { onStop, onEnd } = {}) {
  let index = -1;
  const go = i => {
    if (i < 0 || i >= stops.length) return false;
    index = i;
    onStop?.(stops[i], i);
    return true;
  };
  return {
    start: () => go(0),
    next: () => (index < 0 ? go(0) : go(index + 1)),
    prev: () => index > 0 && go(index - 1),
    stop() { if (index < 0) return; index = -1; onEnd?.(); },
    get active() { return index >= 0; },
    get index() { return index; },
    get length() { return stops.length; },
  };
}
