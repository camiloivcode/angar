import * as THREE from 'three';
import { RayInteractable } from '@iwsdk/core';

// Paneles flotantes de VR: meshes de Three con textura de canvas + RayInteractable de IWSDK.
// No usan UIKitML (necesitaría el kit y el editor de escenas); suficiente para menú y ficha.
const C = { bg: '#0f1d18', btn: '#1a3324', btnHover: '#2a5a3a', line: '#75c842', text: '#ffffff', muted: '#b6c6bc' };

function canvasMaterial(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const repaint = (...args) => { paint(ctx, w, h, ...args); texture.needsUpdate = true; };
  repaint();
  return { material: new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }), repaint };
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const headPosition = world => world.playerSpaceEntities.head.object3D.getWorldPosition(new THREE.Vector3());

/** Coloca `group` delante de la cabeza, mirando al usuario (los paneles son de una sola cara hacia +Z). */
function placeInFront(world, group, distance, drop) {
  const head = headPosition(world);
  const dir = new THREE.Vector3();
  world.camera.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  group.position.set(head.x + dir.x * distance, head.y - drop, head.z + dir.z * distance);
  group.rotation.set(0, Math.atan2(head.x - group.position.x, head.z - group.position.z), 0);
}

/** Menú de destinos: un botón por elemento de `items` ({ id, label }). */
export function createFloorMenu(world, items, onSelect) {
  const BW = 0.36, ROW = 0.055, HEAD = 0.075, PAD = 0.02;
  const cols = items.length > 8 ? 2 : 1;
  const rows = Math.ceil(items.length / cols);
  const W = cols * BW + PAD * 2;
  const H = HEAD + rows * ROW + PAD * 2;
  const group = new THREE.Group();
  group.name = 'XR_FloorMenu';
  group.visible = false;

  const bg = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.012, H + 0.012),
    new THREE.MeshBasicMaterial({ color: C.line, side: THREE.DoubleSide }));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ color: C.bg, side: THREE.DoubleSide }));
  panel.position.z = 0.001;
  const header = canvasMaterial(512, 92, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.line; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CIAC · Ir a…', w / 2, 62);
  });
  const title = new THREE.Mesh(new THREE.PlaneGeometry(W, HEAD), header.material);
  title.position.set(0, H / 2 - PAD - HEAD / 2, 0.002);
  group.add(bg, panel, title);

  const entity = world.createTransformEntity(group, { persistent: true });
  items.forEach((item, i) => {
    const paint = (ctx, w, h, hover = false) => {
      ctx.fillStyle = hover ? C.btnHover : C.btn; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = hover ? '#a8ff60' : C.line + '88'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = C.text; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(item.label, 28, h / 2 + 14);
    };
    const { material, repaint } = canvasMaterial(512, 88, paint);
    const button = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.01, ROW - 0.008), material);
    const col = i % cols, row = Math.floor(i / cols);
    button.position.set((col - (cols - 1) / 2) * BW, H / 2 - PAD - HEAD - ROW * (row + 0.5), 0.003);
    world.createTransformEntity(button, { parent: entity }).addComponent(RayInteractable);
    button.addEventListener('pointerenter', () => repaint(true));
    button.addEventListener('pointerleave', () => repaint(false));
    button.addEventListener('pointerdown', () => onSelect(item.id));
  });

  return {
    group,
    summon() { placeInFront(world, group, 0.9, 0.1); group.visible = true; },
    hide() { group.visible = false; },
  };
}

/** Ficha de un espacio (misma información que el inspector de escritorio). */
export function createInspectorCard(world) {
  const W = 0.8, H = 0.5;
  const group = new THREE.Group();
  group.name = 'XR_InspectorCard';
  group.visible = false;
  const border = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.014, H + 0.014),
    new THREE.MeshBasicMaterial({ color: C.line, side: THREE.DoubleSide }));
  let paint = () => {};
  const { material, repaint } = canvasMaterial(1024, 640, (ctx, w, h, data) => { if (data) paint(ctx, w, h, data); });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), material);
  face.position.z = 0.001;
  group.add(border, face);
  world.createTransformEntity(group, { persistent: true });

  paint = (ctx, w, h, data) => {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.line; ctx.font = 'bold 30px sans-serif';
    ctx.fillText((data.type || 'Espacio del predio').toUpperCase(), 48, 70);
    ctx.fillStyle = C.text; ctx.font = 'bold 50px sans-serif';
    ctx.fillText(data.name, 48, 135);
    ctx.fillStyle = C.muted; ctx.font = '30px sans-serif';
    wrapLines(ctx, data.description || '', w - 96).slice(0, 7).forEach((line, i) => ctx.fillText(line, 48, 200 + i * 38));
    [['Dimensiones', data.dimensions], ['Área', data.area], ['Capacidad', data.capacity]].forEach(([label, value], i) => {
      const x = 48 + i * 320;
      ctx.fillStyle = C.line; ctx.font = 'bold 26px sans-serif'; ctx.fillText(label, x, 500);
      ctx.fillStyle = C.text; ctx.font = '27px sans-serif'; ctx.fillText(value || 'Sin especificar', x, 545);
    });
  };

  return {
    group,
    get isOpen() { return group.visible; },
    /** Muestra la ficha sobre `point`, de cara al usuario. */
    show(data, point) {
      repaint(data);
      const head = headPosition(world);
      group.position.set(point.x, point.y + 0.45, point.z);
      group.rotation.set(0, Math.atan2(head.x - group.position.x, head.z - group.position.z), 0);
      group.visible = true;
    },
    /** Muestra la ficha delante del usuario (paradas del recorrido). */
    showInFront(data) {
      repaint(data);
      placeInFront(world, group, 1.3, 0.05);
      group.visible = true;
    },
    hide() { group.visible = false; },
  };
}
