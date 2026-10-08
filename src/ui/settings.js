// Acciones de los interruptores de Ajustes; también las usa el panel de desarrollo (?dev).

/** Sombras del sol y del renderer; las usan el interruptor de Ajustes y el panel de desarrollo. */
export function setShadows({ renderer, environment, roots }, show) {
  renderer.shadowMap.enabled = show;
  environment.dirLight.castShadow = show;
  roots.forEach(root => root.traverse(child => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => { material.needsUpdate = true; });
  }));
}

/** Muestra u oculta solo la vegetación (el terreno y las vías se quedan). */
export function setVegetation(urbanismRoot, show) {
  urbanismRoot.traverse(child => {
    if (child.userData.role === 'vegetation' || child.name === 'vegetationGroup') child.visible = show;
  });
}
