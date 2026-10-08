import * as THREE from 'three';
import gsap from 'gsap';
import { crearEquipo } from '../world/equipos.js';
import { SITIO as S } from '../model/program.js';

/**
 * Demostración de maniobra: cada aeronave sale sola por su carril (una, dos y luego todas) arrastrada por un tractor o remolcador,
 * con la cámara siguiéndola, y vuelve al hangar sin que ninguna otra se mueva. Es el argumento central del diseño del hangar.
 */
export function crearDemo({ building, scene, camera, controls, animateCamera, caption, onEnd, reduced = () => false }) {
  const A = building.aeronaves, aeroDe = id => S.H.aeronaves.find(q => q.id === id);
  let tl = null, convoyes = [], activa = false, zRef = null, sigue = null;

  /** Vehículo de arrastre + barra de remolque, delante del morro; sigue a su aeronave en cada cuadro. */
  function convoy(id) {
    const a = aeroDe(id), g = new THREE.Group(), veh = crearEquipo(id === 'tc685' ? 'tractor' : 'remolcador'), barra = crearEquipo('barraRemolque');
    veh.position.z = 4.7; barra.position.z = 0.4; g.add(veh, barra); g.userData = { id, off: a.largo / 2 + 0.3 }; g.scale.setScalar(0.001); scene.add(g);
    convoyes.push(g); sincronizar(g); return g;
  }
  const sincronizar = c => { const p = A[c.userData.id].grupo.position; c.position.set(p.x, 0, p.z + c.userData.off); };
  const quitar = c => { scene.remove(c); convoyes = convoyes.filter(x => x !== c); };
  function seguir() {
    convoyes.forEach(sincronizar);
    if (sigue !== null) { const z = A[sigue].grupo.position.z, dz = z - zRef; zRef = z; camera.position.z += dz; controls.target.z += dz; }   // la cámara acompaña a la aeronave
  }

  /** Un paso: texto, vehículos que aparecen, salida o regreso de `ids` y espera a que terminen. */
  function paso(n, total, titulo, texto, ids, afuera, dur) {
    const D = reduced() ? 0.6 : dur, xs = ids.map(id => S.xH + aeroDe(id).x + S.ox), zs = ids.map(id => S.zEd + aeroDe(id).z + S.oz);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, ancho = Math.max(...xs) - Math.min(...xs), zc = afuera ? zs[0] : S.zFr + 14 + S.oz;
    let cs = [];
    tl.call(() => {
      caption(`Demostración · paso ${n} de ${total}`, titulo, texto);
      const z0 = S.zFr + 4 + S.oz;                                              // vista desde el portón hacia las aeronaves que se mueven
      animateCamera([cx + 16 + ancho * 0.4, 8 + ancho * 0.12, z0 + 18], [cx, 1.5, (afuera ? z0 : zc) - 2], reduced() ? 0 : 1.4);
      cs = ids.map(convoy); cs.forEach(c => gsap.to(c.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.6)' }));
    });
    tl.to({}, { duration: reduced() ? 0.2 : 1.6 });
    tl.call(() => { sigue = ids[0]; zRef = A[ids[0]].grupo.position.z; ids.forEach(id => building.moverAeronave(id, afuera, D)); });
    tl.to({}, { duration: D + 0.5 });
    tl.call(() => { sigue = null; cs.forEach(c => gsap.to(c.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, onComplete: () => quitar(c) })); });
    tl.to({}, { duration: 0.8 });
  }

  function start() {
    if (activa) return;
    activa = true; tl = gsap.timeline({ onComplete: stop }); gsap.ticker.add(seguir);
    const N = 5;
    tl.call(() => { caption('Demostración', 'Salida independiente de las aeronaves', 'Cada aeronave tiene su carril recto hasta el portón y su zona SMS de 3 m: puede salir sola, de a dos o todas a la vez.'); building.moverTodas(false, reduced() ? 0.3 : 1.2); });
    tl.to({}, { duration: reduced() ? 0.5 : 2.4 });
    paso(1, N, 'Una sola: el Turbo Commander', 'El Turbo Commander sale por su carril, arrastrado por el tractor. Las demás aeronaves no se mueven.', ['tc685'], true, 7);
    paso(2, N, 'Dos a la vez', 'El Bell 206 y el Cessna 210 salen al mismo tiempo, cada uno por su carril y sin cruzarse.', ['bell206', 'c210'], true, 7);
    paso(3, N, 'Todas afuera', 'La Cessna 206 completa la fila: las cuatro aeronaves quedan sobre la pista de rodaje.', ['c206'], true, 6);
    paso(4, N, 'Regreso al hangar', 'Las cuatro vuelven por sus carriles, cada una a su zona marcada.', ['tc685', 'bell206', 'c206', 'c210'], false, 8);
    tl.call(() => caption('Demostración', 'Maniobra completa', 'Ninguna aeronave se movió por otra: el hangar de 88 × 32 m y la pista permiten sacar cualquiera en cualquier momento.'));
    tl.to({}, { duration: reduced() ? 0.5 : 3 });
  }

  function stop() {
    if (!activa) return;
    activa = false; sigue = null; tl?.kill(); tl = null; gsap.ticker.remove(seguir);
    [...convoyes].forEach(quitar); Object.keys(A).forEach(id => gsap.killTweensOf(A[id].grupo.position));
    onEnd?.();
  }

  return { start, stop, get active() { return activa; } };
}
