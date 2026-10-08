import GUI from 'lil-gui';
import * as THREE from 'three';
import { setShadows, setVegetation } from './settings.js';

/** Panel técnico de lil-gui: solo con `?dev` en la URL. */
export function setupProfessionalGUI({ renderer, environment, hotspotsManager,
  setFloorMode, setAutoRotate, state, buildingRoot, urbanismRoot }) {
  const gui = new GUI({ title: 'Ajustes de desarrollo' });
  const lighting = gui.addFolder('Iluminación y entorno');
  lighting.add(state, 'exposure', 0.4, 1.6, 0.02).name('Exposición').listen()
    .onChange(value => { renderer.toneMappingExposure = value; });
  lighting.add(state, 'sunIntensity', 0, 3, 0.05).name('Intensidad solar').listen()
    .onChange(value => { environment.dirLight.intensity = value; });
  lighting.add(state, 'shadows').name('Sombras').listen().onChange(show => setShadows({ renderer, environment, roots: [buildingRoot, urbanismRoot] }, show));

  const clay = new THREE.MeshStandardMaterial({ color: 0xdfdfdf, roughness: 0.8 });
  const xray = new THREE.MeshPhysicalMaterial({ color: 0x59c7d6, transparent: true,
    opacity: 0.2, roughness: 0.4, depthWrite: false });
  const originals = new Map();
  buildingRoot.traverse(child => {
    // Keep invisible selection volumes invisible in every material mode.
    if (child.isMesh && child.material && child.material.visible !== false && !child.userData.isHitbox) {
      originals.set(child, child.material);
    }
  });
  const model = gui.addFolder('Modelo y niveles');
  model.add(state, 'renderStyle', ['Fotorrealista PBR', 'Maqueta Blanca (Clay)', 'Rayos X (Estructura)'])
    .name('Acabado').onChange(style => {
      originals.forEach((original, mesh) => {
        mesh.material = style === 'Maqueta Blanca (Clay)' ? clay : style === 'Rayos X (Estructura)' ? xray : original;
      });
    });
  model.add(state, 'floor', { 'Conjunto completo': 'all', 'Vista explotada': 'exploded',
    'Hasta piso 5': '5', 'Hasta piso 4': '4', 'Hasta piso 3': '3', 'Hasta piso 2': '2', 'Piso 1': '1' }).name('Nivel').listen().onChange(setFloorMode);
  const layers = gui.addFolder('Capas y navegación');
  layers.add(state, 'showHotspots').name('Etiquetas 3D').onChange(show => hotspotsManager.setVisibility(show));
  layers.add(state, 'showTrees').name('Arbolado').listen().onChange(show => setVegetation(urbanismRoot, show));
  layers.add(state, 'autoRotate').name('Rotación automática').listen().onChange(setAutoRotate);
  model.close();
  layers.close();
  return gui;
}
