import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { buildPredio } from './world/predioBuilder.js';
import { buildHangarComplex } from './world/hangarBuilder.js';
import { SITIO, FLOOR_HEIGHT, mundo } from './model/program.js';
import { PARAMS } from './medidas.js';
import { EnvironmentManager } from './look/environment.js';
import { setupPostprocessing } from './look/postprocessing.js';
import { HotspotsManager } from './ui/hotspots.js';
import { setShadows, setVegetation } from './ui/settings.js';
import { isWorldVisible, floorLayout } from './model/viewerState.js';
import { World, VisibilityState } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { setupXR } from './modes/xr.js';
import { TOUR, createTour, placeFor } from './model/tour.js';
import { XR_SPAWNS } from './model/spawns.js';
import { crearDemo } from './modes/demo.js';
import { PedestrianControls } from './modes/pedestrianControls.js';
import { Materials } from './look/materials.js';
import { LOOK, applyStylizedLook, stylizePostprocessing, useStylizedLook } from './look/stylized.js';
import {
  createIcons, Route, Footprints, Glasses, Layers, Box, Building2, Camera, MapPin, Search, X,
  House, Settings2, CircleHelp, ChevronUp, ChevronDown, Orbit, Plane, Play
} from 'lucide';

const icons = { Route, Footprints, Glasses, Layers, Box, Building2, Camera, MapPin, Search, X, House, Settings2, CircleHelp, ChevronUp, ChevronDown, Orbit, Plane, Play };

const $ = id => document.getElementById(id);
// ?dpr=0.5 reduce la resolución (pruebas sin GPU); por defecto, la del dispositivo con tope 2.
// Solo en desarrollo: ?sinrender omite el dibujado (pruebas de lógica sin GPU).
const SIN_RENDER = import.meta.env.DEV && new URLSearchParams(location.search).has('sinrender');
const pixelRatio = () => Number(new URLSearchParams(location.search).get('dpr')) || Math.min(devicePixelRatio, 2);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function showError(message) {
  $('loading-state').classList.add('hidden');
  $('render-error-message').textContent = message;
  $('render-error').classList.remove('hidden');
}
$('btn-retry').addEventListener('click', () => location.reload());
requestAnimationFrame(() => requestAnimationFrame(() => {
  init().catch(error => {
    console.error(error);
    showError('No fue posible iniciar el visor 3D. Comprueba que WebGL 2 y la aceleración gráfica estén disponibles en tu navegador.');
  });
}));

async function init() {
  // IWSDK crea renderer, escena y cámara (bajo world.player) y gestiona la sesión XR.
  // El passthrough exige un lienzo con alfa, y IWSDK lo decide al crear el mundo según el modo de sesión.
  // Solo en Quest (o con ?mr): en escritorio el lienzo sigue opaco. Las sesiones se piden siempre con su modo explícito.
  const mixedCapable = /OculusBrowser|Quest/i.test(navigator.userAgent) || new URLSearchParams(location.search).has('mr');
  const options = mixedCapable && projectOptions.xr
    ? { ...projectOptions, xr: { ...projectOptions.xr, sessionMode: 'immersive-ar' } }
    : projectOptions;
  const world = await World.create($('canvas-container'), options);
  const { scene, camera, renderer } = world;
  renderer.setPixelRatio(pixelRatio());
  const stylized = useStylizedLook();
  if (stylized) applyStylizedLook(Materials);   // antes de construir: los builders comparten estos materiales
  renderer.toneMapping = stylized ? LOOK.toneMapping : THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The scene is static between interactions, so shadows are re-rendered only while something changes.
  renderer.shadowMap.autoUpdate = false;
  let shadowUntil = performance.now() + 4000, shadowsWereEnabled = true;
  const refreshShadows = (ms = 1500) => { shadowUntil = Math.max(shadowUntil, performance.now() + ms); };
  renderer.domElement.setAttribute('aria-label', 'Modelo tridimensional del hangar y el predio del CIAC');
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.08;
  controls.minDistance = 6;
  controls.maxDistance = 320;
  controls.autoRotateSpeed = 0.5;
  controls.zoomSpeed = 0.8;
  const postprocessing = setupPostprocessing(renderer, scene, camera);
  if (stylized) stylizePostprocessing(postprocessing);
  const environment = new EnvironmentManager(scene, renderer);
  const urbanism = buildPredio(scene);
  const building = buildHangarComplex(scene);
  const typing = event => event.target instanceof Element && event.target.closest('input, textarea, dialog');
  const xr = setupXR(world, { urbanism, building, environment, onTourAction: action => tour[action]?.() });
  xr.bindButton($('btn-vr-mode'), $('vr-btn-label'), { idle: 'VR', hint: 'Entrar en Realidad Virtual a escala humana 1:1' });
  xr.bindButton($('btn-mr-mode'), $('mr-btn-label'), { mode: 'immersive-ar', idle: 'Maqueta', hint: 'Ver el predio como maqueta sobre tu mesa (realidad mixta)' });

  const rotulosAereos = [];
  const pedestrianControls = new PedestrianControls({
    camera,
    renderer,
    scene,
    orbitControls: controls,
    walkableSurfaces: [urbanism, building.rootGroup],
    obstaculos: [...building.obstaculos, ...urbanism.userData.obstaculos],
    interactiveObjects: building.interactiveObjects,
    onModeChange: (active) => {
      $('pedestrian-hud')?.classList.toggle('hidden', !active);
      $('btn-pedestrian-mode')?.classList.toggle('active', active);
      $('btn-pedestrian-mode')?.setAttribute('aria-pressed', String(active));
      $('pedestrian-hud')?.classList.remove('moving');
      if (!active) { $('tp-menu')?.classList.add('hidden'); setHelp(false); }
      hotspots.setVisibility(!active && state.showHotspots);
      rotulosAereos.forEach(o => { o.visible = !active; });   // rótulos de zona: solo en vista aérea (a pie se verían a través de los muros)
      if (active) {
        markCamera(null);
        clearSelection();
      }
    },
    onFloorChangeNeeded: (level) => {
      setFloorMode(String(level));
    },
    onMove: () => $('pedestrian-hud')?.classList.add('moving'),
    onBoundary: () => showPadToast('Límite del recorrido: el lindero del predio'),
    onFlyChange: flying => {
      $('pedestrian-hud')?.classList.toggle('flying', flying);
      const badge = $('pedestrian-mode-label');
      if (badge) badge.textContent = flying ? 'Volando' : 'A pie';
      showPadToast(flying ? 'Modo vuelo · Espacio sube, Shift baja' : 'Aterrizaste');
    }
  });

  // Menú "Ir a…": teletransporte a lugares fijos (clic, tecla T o Select del mando)
  const cxH = SITIO.xH + SITIO.H.ancho / 2;
  const PLACES = [
    ...XR_SPAWNS.map(spawn => ({ name: spawn.label, ...placeFor(spawn.id) })),
    { name: 'Parqueo y reserva', position: mundo(SITIO.xH + SITIO.L.expansion.ancho + 14, SITIO.zEd - 20), look: mundo(SITIO.xH + SITIO.L.expansion.ancho + 14, SITIO.zEd - 34) },
  ];
  const tpMenu = $('tp-menu');
  const tpButtons = PLACES.map(place => {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = place.name;
    btn.addEventListener('click', () => { pedestrianControls.goToPlace(place); setTpMenu(false); });
    li.appendChild(btn);
    tpMenu?.appendChild(li);
    return btn;
  });
  let tpIndex = 0;
  function setTpMenu(open) {
    if (!tpMenu) return;
    tpMenu.classList.toggle('hidden', !open);
    $('btn-tp-menu')?.setAttribute('aria-expanded', String(open));
    if (open) focusTpItem(0);
  }
  function focusTpItem(i) {
    tpIndex = (i + tpButtons.length) % tpButtons.length;
    tpButtons.forEach((b, n) => b.classList.toggle('focused', n === tpIndex));
    tpButtons[tpIndex]?.focus({ preventScroll: true });
  }
  const tpOpen = () => tpMenu && !tpMenu.classList.contains('hidden');
  $('btn-tp-menu')?.addEventListener('click', () => setTpMenu(!tpOpen()));
  window.addEventListener('keydown', event => {
    if (!pedestrianControls.active || typing(event)) return;
    if (event.code === 'KeyT') setTpMenu(!tpOpen());
    else if (event.code === 'Escape' && tpOpen()) { setTpMenu(false); event.stopImmediatePropagation(); }
  }, true);
  // Mando: Select abre/cierra, cruceta ↑/↓ elige, A va, B cierra el menú (devuelve true = consumido)
  pedestrianControls.onPadButton = i => {
    if (i === 8) { setTpMenu(!tpOpen()); return true; }
    if (!tpOpen()) return false;
    if (i === 12) focusTpItem(tpIndex - 2 >= 0 ? tpIndex - 2 : tpIndex);
    else if (i === 13) focusTpItem(tpIndex + 2 < tpButtons.length ? tpIndex + 2 : tpIndex);
    else if (i === 0) tpButtons[tpIndex].click();
    else if (i === 1) setTpMenu(false);
    return true;
  };

  // Mando: la ayuda cambia a sus controles y se avisa al conectarlo
  let padToastTimer;
  function showPadToast(text) {
    const toast = $('pad-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(padToastTimer);
    padToastTimer = setTimeout(() => toast.classList.add('hidden'), 4500);
  }
  window.addEventListener('gamepadconnected', () => {
    $('pedestrian-hud')?.setAttribute('data-input', 'pad');
    showPadToast('Mando conectado · Presiona Start para recorrer a pie');
  });
  window.addEventListener('gamepaddisconnected', () => {
    $('pedestrian-hud')?.setAttribute('data-input', 'keyboard');
    showPadToast('Mando desconectado');
  });
  window.addEventListener('keydown', () => $('pedestrian-hud')?.setAttribute('data-input', 'keyboard'));

  window.THREE = THREE;
  window.camera = camera;
  window.scene = scene;
  window.building = building;
  window.pedestrianControls = pedestrianControls;
  window.composer = postprocessing.composer;

  // Order matches floorLayout(): floors 1..5, the low roof (cúpula y barras) and the top roof.
  const levelGroups = [...building.floorGroups, building.roofLowGroup, building.roofGroup];
  const state = {
    floor: 'all', autoRotate: false, showHotspots: true, showTrees: true,
    renderStyle: 'Fotorrealista PBR', exposure: 1.0, shadows: true,
    timeOfDay: environment.timeOfDay, preset: environment.currentPreset,
    sunIntensity: environment.dirLight.intensity,
  };
  let selected = null, selectionBox = null, cameraTween = null, targetTween = null, contextLost = false;
  const Lp = SITIO.L, m3 = (x, y, z) => { const p = mundo(x, z); return [p.x, y, p.z]; };
  const presets = {
    general: { pos: m3(Lp.ancho * 0.9, 88, Lp.fondo + 72), target: m3(Lp.ancho * 0.5, 0, Lp.fondo * 0.5) },
    plataforma: { pos: m3(cxH, 24, SITIO.zPlat + 42), target: m3(cxH, 3, SITIO.zFr + 4) },
    hangar: { pos: m3(cxH + 46, 42, SITIO.zFr + 58), target: m3(cxH, 0, SITIO.zEd + 14) },
    admin: { pos: m3(SITIO.xD + 14, FLOOR_HEIGHT + 1.7, SITIO.zEd + 11.7), target: m3(SITIO.xH + 30, FLOOR_HEIGHT - 1.5, SITIO.zEd + 16) },
    formacion: { pos: m3(SITIO.xEd - 34, 38, SITIO.zFr + 44), target: m3(SITIO.xEd + Lp.anchoIzq / 2, 0, SITIO.zEd + SITIO.H.fondo * 0.5) },
    parqueo: { pos: m3(Lp.ancho * 0.62, 48, -26), target: m3(Lp.ancho * 0.62, 0, 22) },
    top: { pos: m3(Lp.ancho * 0.5, 300, Lp.fondo * 0.5 + 0.01), target: m3(Lp.ancho * 0.5, 0, Lp.fondo * 0.5) },
  };
  /** Resalta "Inicio" mientras la cámara está en la vista general. */
  function markCamera(key) {
    $('btn-reset-cam')?.classList.toggle('active', key === 'general');
  }
  function setAutoRotate(value) {
    state.autoRotate = value;
    controls.autoRotate = value;
    $('check-auto-rotate').checked = value;
    if (value) markCamera(null);
  }
  function animateCamera(position, target, duration = 1.2) {
    cameraTween?.kill();
    targetTween?.kill();
    setAutoRotate(false);
    if (pedestrianControls?.active) {
      pedestrianControls.active = false;
      controls.enabled = true;
      $('pedestrian-hud')?.classList.add('hidden');
      $('btn-pedestrian-mode')?.classList.remove('active');
    }
    if (duration === 0 || reducedMotion.matches) {
      camera.position.fromArray(position);
      controls.target.fromArray(target);
      controls.update();
    } else {
      const timing = { duration, ease: 'power3.inOut', overwrite: true };
      cameraTween = gsap.to(camera.position, { x: position[0], y: position[1], z: position[2], ...timing });
      targetTween = gsap.to(controls.target, { x: target[0], y: target[1], z: target[2], ...timing });
    }
  }
  let currentView = 'general';
  function selectCamera(key, immediate = false) {
    currentView = key;
    if (key === 'pedestrian') {
      markCamera('pedestrian');
      pedestrianControls.enterPedestrianMode();
      return;
    }
    if (pedestrianControls.active) {
      pedestrianControls.exitPedestrianMode();
    }
    const preset = presets[key];
    if (!preset) return;
    const position = [...preset.pos];
    if (key === 'general' || key === 'top') {
      const factor = Math.max(1, 0.92 / camera.aspect);
      position.forEach((value, i) => { position[i] = value * factor; });
    }
    markCamera(key);
    animateCamera(position, preset.target, immediate ? 0 : 1.2);
  }
  function clearSelection() {
    selected = null;
    if (selectionBox) {
      scene.remove(selectionBox);
      selectionBox.geometry.dispose();
      selectionBox.material.dispose();
      selectionBox = null;
    }
    $('inspector-card').classList.add('hidden');
  }
  function showInspector(data, object = null) {
    clearSelection();
    $('inspector-tag').textContent = data.type || 'Espacio del predio';
    $('inspector-title').textContent = data.name;
    $('inspector-desc').textContent = data.description || '';
    $('inspector-card').classList.remove('hidden');
    if (object) {
      selected = object;
      selectionBox = new THREE.BoxHelper(object, 0x87d348);
      selectionBox.material.depthTest = false;
      selectionBox.material.transparent = true;
      selectionBox.material.opacity = 0.7;
      selectionBox.renderOrder = 100;
      scene.add(selectionBox);
      $('btn-teleport-space')?.classList.remove('hidden');
      etiquetaManiobra(object.userData.aeronave);
    } else {
      $('btn-teleport-space')?.classList.add('hidden');
      etiquetaManiobra(null);
    }
  }
  // Sacar o guardar la aeronave seleccionada por su carril (también desde Ajustes: todas a la vez).
  function etiquetaManiobra(id) {
    const boton = $('btn-maniobra'); if (!boton) return;
    boton.classList.toggle('hidden', !id); boton.dataset.id = id || '';
    if (id) boton.querySelector('span').textContent = building.aeronaves[id].afuera ? 'Guardar en el hangar' : 'Sacar al exterior';
  }
  const hotspots = new HotspotsManager(scene, camera, spot => {
    markCamera(null);
    if (spot.id === 'admin') setFloorMode('all');
    animateCamera(spot.cameraPos, spot.cameraTarget);
    showInspector({ name: spot.name, type: spot.type, dimensions: spot.dimensions,
      area: spot.area, capacity: spot.cap, description: `${spot.desc} Área: ${spot.area}. ${spot.cap}.` });
  }, { building });
  function setFloorMode(mode) {
    const layout = floorLayout(mode);
    if (!layout) return;
    state.floor = mode;
    clearSelection();
    levelGroups.forEach((group, index) => {
      gsap.killTweensOf(group.position);
      group.visible = layout[index].visible;
      gsap.to(group.position, { y: layout[index].y, duration: reducedMotion.matches ? 0 : 0.7, ease: 'power3.inOut', overwrite: true,
        onUpdate: () => refreshShadows(400) });
    });
    document.querySelectorAll('.floor-btn').forEach(button => {
      const active = button.dataset.floor === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    hotspots.setFloorMode(mode);
  }
  // Recorrido guiado: la misma lista de paradas mueve la cámara a pie (escritorio) o al jugador (VR).
  const tour = createTour(TOUR, {
    onStop(stop, index) {
      if (renderer.xr.isPresenting) { xr.showStop(stop, index, TOUR.length); return; }
      clearSelection();
      pedestrianControls.goToPlace(stop);
      $('inspector-tag').textContent = `Recorrido · parada ${index + 1} de ${TOUR.length}`;
      $('inspector-title').textContent = stop.title;
      $('inspector-desc').textContent = stop.text;
      $('inspector-card').classList.remove('hidden');
      $('btn-teleport-space')?.classList.add('hidden');
      $('btn-maniobra')?.classList.add('hidden');
      $('tour-actions').classList.remove('hidden');
      $('btn-tour-prev').disabled = index === 0;
      $('btn-tour-next').disabled = index === TOUR.length - 1;
      $('btn-tour').classList.add('active');
      $('btn-tour').setAttribute('aria-pressed', 'true');
    },
    onEnd() {
      xr.hideStop();
      $('tour-actions').classList.add('hidden');
      $('inspector-card').classList.add('hidden');
      $('btn-tour').classList.remove('active');
      $('btn-tour').setAttribute('aria-pressed', 'false');
    }
  });
  // Demostración de maniobra: aeronaves que salen solas, de a dos y todas, con la cámara siguiéndolas. Usa la tarjeta como rótulo.
  const demo = crearDemo({ building, scene, camera, controls, reduced: () => reducedMotion.matches,
    animateCamera: (pos, target, duration) => { markCamera(null); animateCamera(pos, target, duration); },
    caption: (tag, title, text) => {
      clearSelection(); $('inspector-tag').textContent = tag; $('inspector-title').textContent = title; $('inspector-desc').textContent = text;
      $('inspector-card').classList.remove('hidden'); $('btn-teleport-space')?.classList.add('hidden'); $('btn-maniobra')?.classList.add('hidden');
      $('tour-actions').classList.remove('hidden'); $('btn-tour-prev').classList.add('hidden'); $('btn-tour-next').classList.add('hidden');
      $('btn-demo').classList.add('active'); $('btn-demo').setAttribute('aria-pressed', 'true');
    },
    onEnd: () => {
      $('tour-actions').classList.add('hidden'); $('btn-tour-prev').classList.remove('hidden'); $('btn-tour-next').classList.remove('hidden'); $('inspector-card').classList.add('hidden');
      $('btn-demo').classList.remove('active'); $('btn-demo').setAttribute('aria-pressed', 'false');
    } });
  $('btn-demo').addEventListener('click', () => (demo.active ? demo.stop() : (tour.active && tour.stop(), demo.start())));
  $('btn-tour-end').addEventListener('click', () => { if (demo.active) demo.stop(); });
  $('btn-tour').addEventListener('click', () => (tour.active ? tour.stop() : tour.start()));
  $('btn-tour-prev').addEventListener('click', () => tour.prev());
  $('btn-tour-next').addEventListener('click', () => tour.next());
  $('btn-tour-end').addEventListener('click', () => tour.stop());
  $('btn-close-inspector').addEventListener('click', () => tour.stop());
  // Panel técnico de lil-gui: solo con ?dev.
  // Se carga bajo demanda: lil-gui no viaja en el bundle normal.
  const gui = new URLSearchParams(location.search).has('dev')
    ? (await import('./ui/guiController.js')).setupProfessionalGUI({ renderer, environment, hotspotsManager: hotspots,
      setFloorMode, setAutoRotate, state, buildingRoot: building.rootGroup, urbanismRoot: urbanism })
    : null;
  environment.subscribe(({ timeOfDay, mode }) => {
    refreshShadows();
    state.timeOfDay = timeOfDay;
    state.preset = mode;
    state.sunIntensity = environment.dirLight.intensity;
  });
  document.querySelectorAll('.floor-btn').forEach(button => button.addEventListener('click', () => setFloorMode(button.dataset.floor)));
  $('btn-reset-cam').addEventListener('click', () => selectCamera('general'));
  $('btn-close-inspector').addEventListener('click', clearSelection);

  // Ajustes: interruptores simples.
  $('check-auto-rotate').addEventListener('change', event => setAutoRotate(event.target.checked));
  $('check-trees').addEventListener('change', event => { state.showTrees = event.target.checked; setVegetation(urbanism, state.showTrees); });
  $('check-shadows').addEventListener('change', event => {
    state.shadows = event.target.checked;
    setShadows({ renderer, environment, roots: [building.rootGroup, urbanism] }, state.shadows);
  });
  $('check-hotspots').addEventListener('change', event => {
    state.showHotspots = event.target.checked;
    hotspots.setVisibility(state.showHotspots && !pedestrianControls.active);
  });

  $('btn-maniobra')?.addEventListener('click', event => {
    const id = event.currentTarget.dataset.id; if (!id) return;
    building.moverAeronave(id, !building.aeronaves[id].afuera); etiquetaManiobra(id);
  });
  $('btn-sacar-todas')?.addEventListener('click', () => building.moverTodas(true));
  $('btn-guardar-todas')?.addEventListener('click', () => building.moverTodas(false));
  $('check-hangar-roof').addEventListener('change', event => { building.hangarRoofGroup.visible = event.target.checked; refreshShadows(); });
  $('check-cotas').addEventListener('change', event => { building.cotasGroup.visible = event.target.checked; });
  $('check-sms').addEventListener('change', event => { building.smsGroup.visible = event.target.checked; refreshShadows(); });
  // Los rótulos de recintos y aeronaves solo se ven de cerca (si no, tapan la vista aérea).
  const rotulosCerca = [];
  building.rootGroup.traverse(o => { if (o.userData.cerca) rotulosCerca.push(o); });
  rotulosAereos.push(...[building.rootGroup, urbanism].flatMap(r => { const l = []; r.traverse(o => { if (o.userData.aerea) l.push(o); }); return l; }));
  let frame = 0;
  const actualizarRotulos = () => {
    if (++frame % 8) return;
    rotulosCerca.forEach(o => { o.visible = state.showHotspots && camera.position.distanceTo(o.getWorldPosition(rotuloPos)) < 55; });
  };
  const rotuloPos = new THREE.Vector3();

  // El botón del dock se resalta mientras su popover está abierto.
  [['pop-floors', 'btn-floors'], ['pop-settings', 'btn-settings']].forEach(([pop, button]) =>
    $(pop).addEventListener('toggle', event => $(button).classList.toggle('active', event.newState === 'open')));

  // Ayuda del recorrido a pie: oculta hasta que se pide.
  function setHelp(open) {
    $('pedestrian-help')?.classList.toggle('hidden', !open);
    $('btn-help-toggle')?.setAttribute('aria-expanded', String(open));
  }
  $('btn-help-toggle')?.addEventListener('click', () => setHelp($('pedestrian-help').classList.contains('hidden')));

  $('btn-pedestrian-mode')?.addEventListener('click', () => {
    if (pedestrianControls.active) pedestrianControls.exitPedestrianMode();
    else pedestrianControls.enterPedestrianMode();
  });
  $('btn-exit-pedestrian')?.addEventListener('click', () => {
    pedestrianControls.exitPedestrianMode();
  });
  $('btn-sv-forward')?.addEventListener('click', () => {
    pedestrianControls.stepForward(5.5);
  });
  $('btn-sv-backward')?.addEventListener('click', () => {
    pedestrianControls.stepBackward(5.5);
  });
  $('btn-teleport-space')?.addEventListener('click', () => {
    if (selected) {
      const obj = selected;
      clearSelection();
      pedestrianControls.teleportToObject(obj);
    }
  });

  // Buscador único (Ctrl+K o "/"): vistas, lugares y salones.
  const VIEWS = [
    { key: 'general', label: 'Vista aérea del predio' }, { key: 'plataforma', label: 'Plataforma' },
    { key: 'hangar', label: 'Hangar' }, { key: 'admin', label: 'Vista desde administración' },
    { key: 'formacion', label: 'Ambientes de formación' }, { key: 'parqueo', label: 'Parqueo y reserva' },
    { key: 'top', label: 'Vista cenital (planta)' },
  ];
  const searchDialog = $('search-dialog');
  function initSearch() {
    const input = $('search-input'), list = $('search-results');
    const norm = text => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const spaces = building.interactiveObjects
      .filter(obj => obj.userData?.name && !obj.userData.name.includes('Núcleo vertical'))
      .sort((a, b) => (a.userData.floorLevel || 1) - (b.userData.floorLevel || 1)
        || String(a.userData.code || a.userData.name).localeCompare(String(b.userData.code || b.userData.name), undefined, { numeric: true }));
    const entries = [
      ...VIEWS.map(v => ({ group: 'Vistas', icon: 'camera', title: v.label, sub: 'Cambiar de vista', text: norm(`${v.label} vista camara`), run: () => selectCamera(v.key) })),
      ...PLACES.map(place => ({ group: 'Lugares', icon: 'map-pin', title: place.name, sub: 'Ir a pie', text: norm(`${place.name} lugar`), run: () => pedestrianControls.goToPlace(place) })),
      ...spaces.map(obj => {
        const data = obj.userData, level = data.floorLevel || 1;
        return { group: 'Espacios', badge: `P${level}`, title: data.name, sub: [data.code, data.type].filter(Boolean).join(' · '),
          text: norm(`${data.code || ''} ${data.name} ${data.type || ''} piso ${level} p${level}`),
          run: () => { pedestrianControls.teleportToObject(obj); showInspector(data, obj); } };
      }),
    ];
    let shown = [], active = 0;

    function render() {
      const terms = norm(input.value.trim()).split(/\s+/).filter(Boolean);
      let spaceCount = 0;
      shown = entries.filter(entry => (terms.length ? terms.every(term => entry.text.includes(term)) : entry.group !== 'Espacios'))
        .filter(entry => entry.group !== 'Espacios' || ++spaceCount <= 30);
      active = Math.min(active, Math.max(shown.length - 1, 0));
      list.replaceChildren();
      if (!shown.length) {
        const empty = document.createElement('li');
        empty.className = 'result-empty';
        empty.textContent = 'No encontramos nada con esa búsqueda.';
        list.append(empty);
        return;
      }
      let group = null;
      shown.forEach((entry, index) => {
        if (entry.group !== group) {
          group = entry.group;
          const header = document.createElement('li');
          header.className = 'result-group';
          header.setAttribute('role', 'presentation');
          header.textContent = group;
          list.append(header);
        }
        const item = document.createElement('li');
        item.className = 'result' + (index === active ? ' active' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(index === active));
        item.dataset.index = index;
        const icon = document.createElement('span');
        icon.className = 'result-icon';
        if (entry.icon) icon.innerHTML = `<i data-lucide="${entry.icon}"></i>`; else icon.textContent = entry.badge;
        const main = document.createElement('span');
        main.className = 'result-main';
        const title = document.createElement('span');
        title.className = 'result-title';
        title.textContent = entry.title;
        const sub = document.createElement('span');
        sub.className = 'result-sub';
        sub.textContent = entry.sub;
        main.append(title, sub);
        item.append(icon, main);
        list.append(item);
      });
      createIcons({ icons, root: list });
    }
    function highlight(next) {
      if (!shown.length) return;
      active = (next + shown.length) % shown.length;
      list.querySelectorAll('.result').forEach(item => {
        const on = Number(item.dataset.index) === active;
        item.classList.toggle('active', on);
        item.setAttribute('aria-selected', String(on));
        if (on) item.scrollIntoView({ block: 'nearest' });
      });
    }
    function choose(index) {
      const entry = shown[index];
      if (!entry) return;
      searchDialog.close();
      entry.run();
    }
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); highlight(active + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); highlight(active - 1); }
      else if (event.key === 'Enter') { event.preventDefault(); choose(active); }
    });
    list.addEventListener('click', event => {
      const item = event.target.closest('.result');
      if (item) choose(Number(item.dataset.index));
    });
    searchDialog.addEventListener('click', event => { if (event.target === searchDialog) searchDialog.close(); });
    searchDialog.addEventListener('close', () => { controls.enabled = true; });
    return function open() {
      document.querySelectorAll('[popover]:popover-open').forEach(el => el.hidePopover());
      input.value = '';
      active = 0;
      render();
      controls.enabled = false;
      searchDialog.showModal();
      input.focus();
    };
  }
  const openSearch = initSearch();
  $('btn-search').addEventListener('click', openSearch);

  controls.addEventListener('start', () => {
    cameraTween?.kill();
    targetTween?.kill();
    setAutoRotate(false);
    markCamera(null);
    currentView = null;
  });

  // Only a click or tap selects; dragging the camera must not open an inspector.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press = null;
  let lastClickTime = 0;
  let lastClickPos = { x: 0, y: 0 };

  renderer.domElement.addEventListener('pointerdown', event => {
    press = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
  });
  renderer.domElement.addEventListener('pointercancel', () => { press = null; });
  renderer.domElement.addEventListener('pointerup', event => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;

    const now = performance.now();
    const isDoubleClick = (now - lastClickTime < 380) && (Math.hypot(event.clientX - lastClickPos.x, event.clientY - lastClickPos.y) < 18);
    lastClickTime = now;
    lastClickPos = { x: event.clientX, y: event.clientY };

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);

    const targets = building.interactiveObjects.filter(isWorldVisible);
    const hit = raycaster.intersectObjects(targets, false)[0];

    // 1. Clic directo en un espacio o salón (aeronave, recinto, hangar)
    if (hit) {
      // Con el mouse solo se entra al recorrido desde el botón; fuera de él, solo se inspecciona
      if (pedestrianControls.active) pedestrianControls.teleportToObject(hit.object);
      showInspector(hit.object.userData, hit.object);
      return;
    }

    clearSelection();
  });

  document.addEventListener('keydown', event => {
    if (searchDialog.open) return;   // el diálogo gestiona sus propias teclas (Esc, flechas, Enter)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    else if (event.key === '/' && !typing(event)) { event.preventDefault(); openSearch(); }
    else if (event.key === 'Escape') {
      if (demo.active) demo.stop();
      else if (pedestrianControls.active) pedestrianControls.exitPedestrianMode();
      else clearSelection();
    }
  });

  // Primera visita: una ayuda breve que se va sola o con la primera interacción.
  try {
    if (!localStorage.getItem('ciac-hint')) {
      const hint = $('first-hint');
      hint.classList.remove('hidden');
      const dismiss = () => {
        hint.classList.add('hidden');
        try { localStorage.setItem('ciac-hint', '1'); } catch { /* sin almacenamiento: se mostrará de nuevo */ }
      };
      setTimeout(dismiss, 8000);
      ['pointerdown', 'wheel', 'keydown'].forEach(name => addEventListener(name, dismiss, { once: true, passive: true }));
    }
  } catch { /* almacenamiento bloqueado: sin ayuda inicial */ }

  const direction = new THREE.Vector3();
  const compass = document.querySelector('.compass-needle');
  const clock = new THREE.Clock();
  let wasPresenting = false;
  function animate() {
    if (contextLost || document.hidden) return;
    if (renderer.shadowMap.enabled !== shadowsWereEnabled) { shadowsWereEnabled = renderer.shadowMap.enabled; refreshShadows(); }
    renderer.shadowMap.needsUpdate = performance.now() < shadowUntil;
    const delta = Math.min(clock.getDelta(), 0.05);

    // Animación de ondas y corriente viva en el agua
    if (Materials.waterSurface.normalMap) {
      const wt = performance.now() * 0.00035;
      Materials.waterSurface.normalMap.offset.set(
        Math.sin(wt * 0.7) * 0.08 + wt * 0.05,
        Math.cos(wt * 0.5) * 0.06 + wt * 0.035
      );
    }

    const presenting = renderer.xr.isPresenting;
    if (presenting !== wasPresenting) { wasPresenting = presenting; xr.setPresenting(presenting); }
    // Lo que hacía el bucle de IWSDK antes de que lo reemplazáramos: estado de visibilidad, ECS y callbacks de XRFrame.
    world.visibilityState.value = world.session?.visibilityState ?? VisibilityState.NonImmersive;
    world.update(delta, clock.elapsedTime);  // ECS de IWSDK: entrada, locomoción en XR
    xr.update();
    const xrFrame = renderer.xr.getFrame?.();
    if (xrFrame) world.runXRFrameCallbacks(xrFrame, delta, clock.elapsedTime);
    if (presenting) {
      renderer.render(scene, camera);
    } else {
      pedestrianControls.pollGamepad(delta);
      if (pedestrianControls.active) {
        pedestrianControls.update(delta);
      } else {
        controls.update(delta);
      }
      camera.getWorldDirection(direction);
      compass.style.transform = 'rotate(' + THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z)) + 'deg)';
      if (selected) selectionBox.update();
      if (!SIN_RENDER) postprocessing.composer.render();
      urbanism.userData.tick?.(clock.elapsedTime);
      actualizarRotulos();
      if (!SIN_RENDER) hotspots.render();
    }
  }
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    renderer.setAnimationLoop(null);
    showError('Se perdió la conexión con la tarjeta gráfica. Recarga el visor para continuar.');
  });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const ratio = pixelRatio();
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight);
    postprocessing.resize(innerWidth, innerHeight, ratio);
    hotspots.setSize(innerWidth, innerHeight);
    if (currentView === 'general' || currentView === 'top') selectCamera(currentView, true);
  });
  setFloorMode('all');
  refreshShadows(4000);
  selectCamera('general', true);
  animate();
  createIcons({ icons });
  $('loading-state').classList.add('hidden');
  renderer.setAnimationLoop(animate);
  if (import.meta.env.DEV) {
    window.gsap = gsap;
    window.__ciac = { scene, camera, renderer, building, urbanism, controls, state,
      world, environment, hotspots, gui, setFloorMode, selectCamera, isWorldVisible, pedestrianControls, gsap, tour, demo };
  }
}
