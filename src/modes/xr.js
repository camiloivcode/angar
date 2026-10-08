import * as THREE from 'three';
import { LocomotionEnvironment, LocomotionSystem } from '@iwsdk/core';
import { XR_SPAWNS, spawnById } from '../model/spawns.js';
import { createFloorMenu, createInspectorCard } from '../ui/spatialPanels.js';
import { setupTabletop } from './tabletop.js';

const NEAR_DESKTOP = 0.5, NEAR_XR = 0.05;

/**
 * VR / realidad mixta sobre IWSDK. IWSDK aporta sesión, mandos, teleport y giro; aquí solo se
 * declara qué es caminable, dónde aparece el usuario y qué se ajusta al entrar a las gafas.
 * El render lo dirige main.js (el composer en escritorio, renderer.render en XR).
 */
export function setupXR(world, { urbanism, building, environment, onTourAction }) {
  const { renderer, camera, player } = world;
  const tabletop = setupTabletop(world, { urbanism, building, environment });

  // Proxy invisible de superficies caminables: terreno y losas, no los árboles ni la fachada.
  const walkable = new THREE.Group();
  walkable.name = 'XR_Walkable';
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  [urbanism, building.rootGroup].forEach(root => {
    root.updateMatrixWorld(true);
    root.traverse(obj => {
      if (!obj.isMesh || !(obj.userData.walkable || obj.userData.floorArea)) return;
      const proxy = new THREE.Mesh(obj.geometry, hidden);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(obj.matrixWorld);
      walkable.add(proxy);
    });
  });
  // persistent: si no, IWSDK la cuelga del nivel activo y la descarta junto con él.
  const walkableEntity = world.createTransformEntity(walkable, { persistent: true }).addComponent(LocomotionEnvironment);

  // IWSDK cuelga la cámara de `world.player`. En escritorio el jugador debe quedarse en el ORIGEN: si no, la cámara (que se mueve en
  // coordenadas del mundo con OrbitControls o el modo a pie) aparece desplazada del edificio. Solo en VR se coloca en un punto de aparición.
  // El motor de locomoción corre en un worker y empieza a caer en cuanto se inicializa; por eso se reubica al registrarse el suelo y se rescata si cae.
  const RESCUE_Y = -20, ORIGEN = new THREE.Vector3(0, 0.3, 0);
  let spawnId = 'plataforma', placed = false;
  const origen = () => {
    const locomotion = world.getSystem(LocomotionSystem);
    if (!locomotion) return false;
    locomotion.setPlayerPosition(ORIGEN); player.rotation.set(0, 0, 0);
    return true;
  };
  const place = id => {
    const spawn = spawnById(id), locomotion = world.getSystem(LocomotionSystem);
    if (!spawn || !locomotion) return false;
    if (!renderer.xr.isPresenting) return origen();   // fuera de VR el recorrido lo hace la cámara, no el jugador
    spawnId = id;
    locomotion.setPlayerPosition(new THREE.Vector3(...spawn.pos));   // mueve el motor, no solo la malla
    player.rotation.y = spawn.yaw;
    return true;
  };

  /** Llamar cada frame: coloca al jugador cuando el suelo ya está en el motor y lo rescata si cae. */
  function update() {
    const vr = renderer.xr.isPresenting;
    if (!placed) placed = walkableEntity.getValue(LocomotionEnvironment, '_initialized') && (vr ? place(spawnId) : origen());
    else if (player.position.y < RESCUE_Y || (!vr && Math.hypot(player.position.x, player.position.z) > 0.05)) { if (vr) place(spawnId); else origen(); }
    if (summonAt && performance.now() >= summonAt) { summonAt = 0; menu.summon(); }
    if (pendingCard && performance.now() >= pendingCard.at) { card.showInFront(pendingCard.data); pendingCard = null; }
  }

  const teleportTo = place;

  // Paneles espaciales: menú de destinos (se invoca con el agarre izquierdo) y ficha de espacio (gatillo derecho).
  const card = createInspectorCard(world);
  const TOUR_ITEMS = [
    { id: 'tour:start', label: '▶ Recorrido guiado' },
    { id: 'tour:prev', label: '◀ Parada anterior' },
    { id: 'tour:next', label: '▶ Parada siguiente' },
  ];
  const menu = createFloorMenu(world, [...TOUR_ITEMS, ...XR_SPAWNS], id => {
    if (id.startsWith('tour:')) { onTourAction?.(id.slice(5)); return; }
    card.hide();
    place(id);
  });
  const raycaster = new THREE.Raycaster();
  raycaster.far = 50;
  function inspectWithRightRay() {
    const ray = world.playerSpaceEntities.raySpaces.right.object3D;
    ray.updateWorldMatrix(true, false);
    raycaster.set(new THREE.Vector3().setFromMatrixPosition(ray.matrixWorld),
      new THREE.Vector3(0, 0, -1).transformDirection(ray.matrixWorld));
    if (tabletop.active) return;
    if (menu.group.visible && raycaster.intersectObject(menu.group, true).length) return;   // el clic era para el menú
    const hit = raycaster.intersectObjects(building.interactiveObjects, true).find(h => h.object.userData?.name);
    if (hit) card.show(hit.object.userData, hit.point);
    else card.hide();
  }
  for (const index of [0, 1]) {
    const controller = renderer.xr.getController(index);
    controller.addEventListener('selectstart', e => { if (e.data?.handedness === 'right') inspectWithRightRay(); });
    controller.addEventListener('squeezestart', e => {
      if (e.data?.handedness === 'left') { if (tabletop.active) tabletop.place(); else menu.summon(); }
      else if (e.data?.handedness === 'right' && !tabletop.active) onTourAction?.('next');
    });
  }
  // Parada del recorrido: se mueve al jugador y, un instante después (la pose se actualiza en el worker), se muestra el texto.
  let pendingCard = null;
  function showStop(stop, index, total) {
    place(stop.spawn);
    pendingCard = { at: performance.now() + 400, data: {
      type: `Recorrido · parada ${index + 1} de ${total}`, name: stop.title, description: stop.text,
      dimensions: stop.facts[0], area: stop.facts[1], capacity: stop.facts[2] } };
  }
  function hideStop() { pendingCard = null; card.hide(); }
  let summonAt = 0;   // la pose de la cabeza no es válida en el primer frame de la sesión

  // `transmission` obliga a three a un pase extra a pantalla completa por ojo: inviable en Quest (y rompe el
  // framebuffer del emulador). En XR el vidrio pasa a transparencia simple y se restaura al salir.
  const glass = new Map();
  function setCheapGlass(on) {
    if (on) world.scene.traverse(o => {
      for (const m of [].concat(o.material ?? [])) {
        if (m.transmission > 0 && !glass.has(m)) glass.set(m, { transmission: m.transmission, opacity: m.opacity, transparent: m.transparent });
      }
    });
    for (const [m, orig] of glass) {
      m.transmission = on ? 0 : orig.transmission;
      m.opacity = on ? Math.min(orig.opacity, 0.3) : orig.opacity;
      m.transparent = on || orig.transparent;
      m.needsUpdate = true;
    }
  }

  let shadowAuto;
  /** Llamar al cambiar el estado de la sesión inmersiva. */
  function setPresenting(presenting) {
    document.body.classList.toggle('in-vr-mode', presenting);
    camera.near = presenting ? NEAR_XR : NEAR_DESKTOP;
    camera.updateProjectionMatrix();
    setCheapGlass(presenting);
    if (presenting) {
      renderer.xr.setFoveation?.(1);   // Quest: prioriza la nitidez central
      shadowAuto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;   // sombras estáticas para sostener 72 FPS
      renderer.shadowMap.needsUpdate = true;
      // Sesión mixta (passthrough): maqueta sobre la mesa. Sesión VR: recorrido a escala 1:1.
      const blend = renderer.xr.getSession()?.environmentBlendMode;
      if (blend && blend !== 'opaque') tabletop.enter();
      else { place('plataforma'); summonAt = performance.now() + 1500; }
    } else {
      origen();   // de vuelta en escritorio: el jugador vuelve al origen
      tabletop.exit();
      summonAt = 0;
      menu.hide();
      card.hide();
      if (shadowAuto !== undefined) renderer.shadowMap.autoUpdate = shadowAuto;
    }
  }

  /** Enlaza un botón del HUD con una sesión inmersiva: VR (`immersive-vr`) o maqueta mixta (`immersive-ar`). */
  async function bindButton(button, label, { mode = 'immersive-vr', idle = 'Modo VR', hint = '' } = {}) {
    if (!button) return;
    const supported = await navigator.xr?.isSessionSupported?.(mode).catch(() => false);
    button.classList.toggle('vr-ready', !!supported);
    button.classList.toggle('vr-unsupported', !supported);
    button.title = supported ? hint : 'WebXR no detectado. Abre este enlace en Meta Quest Browser (HTTPS o localhost con adb reverse).';
    if (label) label.textContent = idle;
    button.addEventListener('click', () => {
      if (renderer.xr.isPresenting) world.exitXR();
      else if (supported) world.launchXR({ sessionMode: mode });
    });
    world.visibilityState.subscribe(state => {
      if (label && supported) label.textContent = state === 'non-immersive' ? idle : 'Salir';
    });
  }

  return { teleportTo, update, setPresenting, bindButton, walkable, showStop, hideStop };
}
