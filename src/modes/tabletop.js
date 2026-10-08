import * as THREE from 'three';

export const TABLE_SCALE = 1 / 250;   // el lote de 200 m mide 0,80 m sobre la mesa
const DISTANCE = 0.8, TABLE_DROP = 0.6;

/**
 * Maqueta en realidad mixta: el predio a escala sobre una mesa, con el passthrough de fondo. Reutiliza los
 * mismos objetos (no se clonan): al entrar se cuelgan de `stage`, que se escala y se coloca delante del usuario.
 */
export function setupTabletop(world, { urbanism, building, environment }) {
  const { scene } = world;
  const stage = new THREE.Group();
  stage.name = 'MR_Tabletop';
  stage.visible = false;
  scene.add(stage);

  const moved = [urbanism, building.rootGroup];
  const originalParent = new Map();
  let hidden = [];
  let saved = null;
  let active = false;

  /** Coloca la maqueta delante del usuario, con la fachada de acceso (sur) hacia él. */
  function place() {
    const head = world.playerSpaceEntities.head.object3D.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3();
    world.camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    stage.position.set(head.x + dir.x * DISTANCE, head.y - TABLE_DROP, head.z + dir.z * DISTANCE);
    stage.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);   // el +Z del predio apunta hacia el usuario
  }

  function enter() {
    if (active) return;
    active = true;
    for (const object of moved) { originalParent.set(object, object.parent); stage.add(object); }
    hidden = [];
    stage.traverse(o => { if (o.userData.hideInTabletop && o.visible) { o.visible = false; hidden.push(o); } });
    saved = { fog: scene.fog, sky: environment.sky.visible, night: environment.nightLights.visible, shadow: environment.dirLight.castShadow };
    scene.fog = null;                         // la niebla está calibrada para 600 m, no para una mesa
    environment.sky.visible = false;          // el fondo es el passthrough
    environment.nightLights.visible = false;  // luces puntuales en coordenadas del lote real
    environment.dirLight.castShadow = false;  // su cámara de sombras cubre 320 m: inútil a esta escala
    stage.scale.setScalar(TABLE_SCALE);
    stage.visible = true;
    place();
  }

  function exit() {
    if (!active) return;
    active = false;
    for (const object of moved) originalParent.get(object)?.add(object);
    hidden.forEach(o => { o.visible = true; });
    hidden = [];
    if (saved) {
      scene.fog = saved.fog;
      environment.sky.visible = saved.sky;
      environment.nightLights.visible = saved.night;
      environment.dirLight.castShadow = saved.shadow;
    }
    stage.visible = false;
    stage.scale.setScalar(1);
  }

  return { enter, exit, place, get active() { return active; } };
}
