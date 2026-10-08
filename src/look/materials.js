import * as THREE from 'three';

// -------------------------------------------------------------
// TEXTURAS PROCEDURALES — ALTA FIDELIDAD ARCHVIZ
// -------------------------------------------------------------

// ── Generador de Normal Maps Procedurales ──
// Deriva mapas de normales a partir de texturas de color usando filtros Sobel.
// Esto agrega profundidad geométrica (juntas hundidas, vetas en relieve, poros
// del concreto que proyectan micro-sombras) sin necesidad de archivos externos.
function generateNormalMap(sourceCanvas, strength = 1.5) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const srcCtx = sourceCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const normalCtx = normalCanvas.getContext('2d');
  const normalImg = normalCtx.createImageData(w, h);
  const out = normalImg.data;

  // Luminancia de un píxel (wrap-around para tiling)
  function lum(x, y) {
    x = ((x % w) + w) % w;
    y = ((y % h) + h) % h;
    const i = (y * w + x) * 4;
    return (srcData[i] * 0.299 + srcData[i + 1] * 0.587 + srcData[i + 2] * 0.114) / 255;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Operador Sobel 3×3
      const tl = lum(x - 1, y - 1), t = lum(x, y - 1), tr = lum(x + 1, y - 1);
      const l  = lum(x - 1, y),                          r  = lum(x + 1, y);
      const bl = lum(x - 1, y + 1), b = lum(x, y + 1), br = lum(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      // Normal en espacio tangente
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const i = (y * w + x) * 4;
      out[i]     = (nx * 0.5 + 0.5) * 255;  // R
      out[i + 1] = (ny * 0.5 + 0.5) * 255;  // G
      out[i + 2] = (nz * 0.5 + 0.5) * 255;  // B
      out[i + 3] = 255;
    }
  }

  normalCtx.putImageData(normalImg, 0, 0);

  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;
  return normalTexture;
}

function createMarbleTileTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Travertino natural cálido con variación tonal
  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, '#c8c2b8');
  gradient.addColorStop(0.5, '#d4cfc6');
  gradient.addColorStop(1, '#c0b9af');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  // Grano mineral sutil
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const brightness = 140 + Math.random() * 50;
    ctx.fillStyle = `rgba(${brightness}, ${brightness - 8}, ${brightness - 15}, 0.06)`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Veteado orgánico suave (como travertino real)
  for (let i = 0; i < 30; i++) {
    const hue = 28 + Math.random() * 12;
    ctx.strokeStyle = `hsla(${hue}, 12%, ${62 + Math.random() * 10}%, ${0.06 + Math.random() * 0.06})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * 1024;
    let y = Math.random() * 1024;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (Math.random() - 0.5) * 120;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Juntas de dilatación limpias y finas
  ctx.strokeStyle = '#a39e94';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 1024; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, 1024);
    ctx.moveTo(0, i); ctx.lineTo(1024, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 8;
  return texture;
}

function createTravertineNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-granularidad de la piedra
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const dx = 128 + (Math.random() - 0.5) * 28;
    const dy = 128 + (Math.random() - 0.5) * 28;
    ctx.fillStyle = `rgb(${dx}, ${dy}, 250)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Juntas de despiece en bajorrelieve (bisel normal)
  const step = 64;
  for (let i = 0; i <= 512; i += step) {
    ctx.fillStyle = 'rgb(85, 128, 240)';
    ctx.fillRect(i - 1, 0, 1, 512);
    ctx.fillStyle = 'rgb(170, 128, 240)';
    ctx.fillRect(i + 1, 0, 1, 512);

    ctx.fillStyle = 'rgb(128, 85, 240)';
    ctx.fillRect(0, i - 1, 512, 1);
    ctx.fillStyle = 'rgb(128, 170, 240)';
    ctx.fillRect(0, i + 1, 512, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 8;
  return texture;
}

function createTravertineRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, 512, 512);

  // Variación tonal por baldosa
  const step = 64;
  for (let x = 0; x < 512; x += step) {
    for (let y = 0; y < 512; y += step) {
      const v = Math.floor(85 + Math.random() * 35);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  // Juntas de lechada con rugosidad mate
  ctx.fillStyle = '#d8d8d8';
  for (let i = 0; i <= 512; i += step) {
    ctx.fillRect(i - 1, 0, 2, 512);
    ctx.fillRect(0, i - 1, 512, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 8;
  return texture;
}

function createRichGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base verde natural
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 360);
  gradient.addColorStop(0, '#79b34d');
  gradient.addColorStop(1, '#65a13f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Briznas de hierba multicapa
  for (let i = 0; i < 50000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = Math.random();
    if (shade < 0.35) {
      ctx.fillStyle = 'rgba(92, 148, 58, 0.45)';
    } else if (shade < 0.7) {
      ctx.fillStyle = 'rgba(74, 128, 46, 0.4)';
    } else if (shade < 0.9) {
      ctx.fillStyle = 'rgba(118, 172, 76, 0.3)';
    } else {
      ctx.fillStyle = 'rgba(150, 196, 88, 0.25)'; // Hojas más claras
    }
    ctx.fillRect(x, y, Math.random() * 2.5 + 0.5, Math.random() * 2.5 + 0.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.anisotropy = 8;
  return texture;
}

function createGrassNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const dx = 128 + (Math.random() - 0.5) * 44;
    const dy = 128 + (Math.random() - 0.5) * 44;
    ctx.fillStyle = `rgb(${dx}, ${dy}, 245)`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.anisotropy = 8;
  return texture;
}

function createAsphaltRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3b4047';
  ctx.fillRect(0, 0, 512, 512);

  // Agregado de asfalto realista
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 55 + Math.random() * 30;
    ctx.fillStyle = `rgba(${v}, ${v + 3}, ${v + 6}, 0.35)`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.anisotropy = 8;
  return texture;
}

function createAsphaltNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const dx = 128 + (Math.random() - 0.5) * 52;
    const dy = 128 + (Math.random() - 0.5) * 52;
    ctx.fillStyle = `rgb(${dx}, ${dy}, 240)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.anisotropy = 8;
  return texture;
}

function createAsphaltRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d7d7d7';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.floor(160 + Math.random() * 80);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.anisotropy = 8;
  return texture;
}

function createSolarCellTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Fondo oscuro de unión interceldas
  ctx.fillStyle = '#050c16';
  ctx.fillRect(0, 0, 512, 512);

  // Gradiente azul cobalto antirreflejo de silicio monocristalino
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, '#0a182c');
  gradient.addColorStop(0.35, '#0f2444');
  gradient.addColorStop(0.7, '#0c1d38');
  gradient.addColorStop(1, '#071222');

  const cellSize = 128;
  const gap = 3;

  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const px = cx * cellSize + gap;
      const py = cy * cellSize + gap;
      const w = cellSize - gap * 2;
      const h = cellSize - gap * 2;

      // Oblea monocristalina con chaflanes en 4 esquinas
      const corner = 10;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(px + corner, py);
      ctx.lineTo(px + w - corner, py);
      ctx.lineTo(px + w, py + corner);
      ctx.lineTo(px + w, py + h - corner);
      ctx.lineTo(px + w - corner, py + h);
      ctx.lineTo(px + corner, py + h);
      ctx.lineTo(px, py + h - corner);
      ctx.lineTo(px, py + corner);
      ctx.closePath();
      ctx.fill();

      // Micro-fingers conductores ultrafinos
      ctx.strokeStyle = 'rgba(185, 210, 235, 0.22)';
      ctx.lineWidth = 0.5;
      for (let fy = py + 4; fy < py + h; fy += 4) {
        ctx.beginPath();
        ctx.moveTo(px + 1, fy);
        ctx.lineTo(px + w - 1, fy);
        ctx.stroke();
      }

      // 5 Busbars verticales plateados por celda
      for (let b = 1; b <= 5; b++) {
        const bx = px + (w * b) / 6;
        const busbarGrad = ctx.createLinearGradient(bx - 1, py, bx + 1, py);
        busbarGrad.addColorStop(0, '#8ea8c4');
        busbarGrad.addColorStop(0.5, '#e4effa');
        busbarGrad.addColorStop(1, '#7a96b4');
        ctx.fillStyle = busbarGrad;
        ctx.fillRect(bx - 1, py, 2, h);
      }
    }
  }

  // Marco perimetral del módulo
  ctx.strokeStyle = '#5a6878';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 510, 510);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = 8;
  return texture;
}

function createSolarCellNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  const cellSize = 128;
  const gap = 3;
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const px = cx * cellSize + gap;
      const py = cy * cellSize + gap;
      const w = cellSize - gap * 2;
      const h = cellSize - gap * 2;

      // Bisel perimetral de la oblea
      ctx.fillStyle = 'rgb(128, 80, 240)';
      ctx.fillRect(px, py, w, 1);
      ctx.fillStyle = 'rgb(128, 176, 240)';
      ctx.fillRect(px, py + h - 1, w, 1);
      ctx.fillStyle = 'rgb(80, 128, 240)';
      ctx.fillRect(px, py, 1, h);
      ctx.fillStyle = 'rgb(176, 128, 240)';
      ctx.fillRect(px + w - 1, py, 1, h);

      // Relieve de los 5 busbars metálicos
      for (let b = 1; b <= 5; b++) {
        const bx = px + (w * b) / 6;
        ctx.fillStyle = 'rgb(95, 128, 245)';
        ctx.fillRect(bx - 1, py, 1, h);
        ctx.fillStyle = 'rgb(160, 128, 245)';
        ctx.fillRect(bx + 1, py, 1, h);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = 8;
  return texture;
}

function createSolarCellRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // Silicio pulido especular
  ctx.fillStyle = '#242424';
  ctx.fillRect(0, 0, 512, 512);

  // Espacio interceldas y marco mate
  const cellSize = 128;
  const gap = 3;
  ctx.fillStyle = '#d8d8d8';
  for (let i = 0; i <= 512; i += cellSize) {
    ctx.fillRect(i - gap, 0, gap * 2, 512);
    ctx.fillRect(0, i - gap, 512, gap * 2);
  }

  // Busbars metálicos satinados
  ctx.fillStyle = '#404040';
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const px = cx * cellSize + gap;
      const py = cy * cellSize + gap;
      const w = cellSize - gap * 2;
      const h = cellSize - gap * 2;
      for (let b = 1; b <= 5; b++) {
        const bx = px + (w * b) / 6;
        ctx.fillRect(bx - 1, py, 2, h);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = 8;
  return texture;
}

function createBrushedMetalNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 256);

  // Líneas finas longitudinales de cepillado
  for (let i = 0; i < 400; i++) {
    const y = Math.random() * 256;
    const dy = 128 + (Math.random() - 0.5) * 35;
    ctx.strokeStyle = `rgb(128, ${dy}, 248)`;
    ctx.lineWidth = 0.5 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = 8;
  return texture;
}

function createDeckWoodNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  // Tablones de tarima deck acanalada (ranuras antideslizantes)
  for (let y = 0; y < 512; y += 16) {
    ctx.fillStyle = 'rgb(128, 70, 235)';
    ctx.fillRect(0, y - 1, 512, 1);
    ctx.fillStyle = 'rgb(128, 185, 235)';
    ctx.fillRect(0, y + 1, 512, 1);
  }

  // Micro-grano de madera
  for (let i = 0; i < 1500; i++) {
    const y = Math.random() * 512;
    const dy = 128 + (Math.random() - 0.5) * 20;
    ctx.strokeStyle = `rgb(128, ${dy}, 245)`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 8);
  texture.anisotropy = 8;
  return texture;
}

function createWoodParquetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base madera cálida
  ctx.fillStyle = '#8a6840';
  ctx.fillRect(0, 0, 512, 512);

  // Variación tonal por tablón
  for (let y = 0; y < 512; y += 32) {
    const shift = ((y / 32) % 2) * 64;
    for (let x = 0; x < 512; x += 128) {
      const hue = 25 + Math.random() * 10;
      const lightness = 30 + Math.random() * 12;
      ctx.fillStyle = `hsl(${hue}, 35%, ${lightness}%)`;
      ctx.fillRect(x + shift, y, 128, 32);
    }
  }

  // Veta de madera
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 200; i++) {
    ctx.strokeStyle = `hsl(28, 40%, ${20 + Math.random() * 20}%)`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    const y = Math.random() * 512;
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Juntas entre tablones
  ctx.strokeStyle = '#4a3520';
  ctx.lineWidth = 1.5;
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(512, y);
    ctx.stroke();
  }
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y < 512; y += 32) {
      const shift = ((y / 32) % 2) * 64;
      ctx.beginPath();
      ctx.moveTo(x + shift, y); ctx.lineTo(x + shift, y + 32);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
}

function createWoodParquetNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  // Veta longitudinal sutil
  for (let i = 0; i < 300; i++) {
    const y = Math.random() * 512;
    const dy = 128 + (Math.random() - 0.5) * 25;
    ctx.strokeStyle = `rgb(128, ${dy}, 248)`;
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }

  // Biseles en ranuras horizontales de tablones
  for (let y = 0; y <= 512; y += 32) {
    ctx.fillStyle = 'rgb(128, 85, 240)';
    ctx.fillRect(0, y - 1, 512, 1);
    ctx.fillStyle = 'rgb(128, 170, 240)';
    ctx.fillRect(0, y + 1, 512, 1);
  }

  // Biseles en ranuras verticales trabadas
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y < 512; y += 32) {
      const shift = ((y / 32) % 2) * 64;
      const bx = x + shift;
      ctx.fillStyle = 'rgb(85, 128, 240)';
      ctx.fillRect(bx - 1, y, 1, 32);
      ctx.fillStyle = 'rgb(170, 128, 240)';
      ctx.fillRect(bx + 1, y, 1, 32);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
}

function createWoodParquetRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#737373';
  ctx.fillRect(0, 0, 512, 512);

  // Variación por tablón individual
  for (let y = 0; y < 512; y += 32) {
    const shift = ((y / 32) % 2) * 64;
    for (let x = 0; x < 512; x += 128) {
      const v = Math.floor(95 + Math.random() * 45);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(x + shift + 1, y + 1, 126, 30);
    }
  }

  // Juntas entre tablones más rugosas
  ctx.fillStyle = '#c0c0c0';
  for (let y = 0; y <= 512; y += 32) {
    ctx.fillRect(0, y - 1, 512, 2);
  }
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y < 512; y += 32) {
      const shift = ((y / 32) % 2) * 64;
      ctx.fillRect(x + shift - 1, y, 2, 32);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
}

// Textura de concreto expuesto con encofrado
function createConcreteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b0b4b8';
  ctx.fillRect(0, 0, 512, 512);

  // Marcas de encofrado horizontales
  for (let y = 0; y < 512; y += 64) {
    ctx.strokeStyle = `rgba(120, 124, 128, ${0.15 + Math.random() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 4);
    ctx.lineTo(512, y + Math.random() * 4);
    ctx.stroke();
  }

  // Poros y burbujas del concreto
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = `rgba(95, 98, 102, ${0.08 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 4;
  return texture;
}

function createConcreteNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-porosidad y áridos finos del concreto
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const dx = 128 + (Math.random() - 0.5) * 38;
    const dy = 128 + (Math.random() - 0.5) * 38;
    ctx.fillStyle = `rgb(${dx}, ${dy}, 245)`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  // Juntas de encofrado horizontales
  for (let y = 0; y <= 512; y += 64) {
    ctx.fillStyle = 'rgb(128, 75, 240)';
    ctx.fillRect(0, y - 1, 512, 1);
    ctx.fillStyle = 'rgb(128, 180, 240)';
    ctx.fillRect(0, y + 1, 512, 1);
  }

  // Conos de tirante de encofrado (tie holes)
  const tieSpacingX = 128;
  const tieSpacingY = 64;
  for (let ty = 32; ty < 512; ty += tieSpacingY) {
    for (let tx = 64; tx < 512; tx += tieSpacingX) {
      const rad = 4;
      for (let r = rad; r >= 1; r--) {
        const factor = r / rad;
        ctx.fillStyle = `rgb(${128 + Math.cos(factor * Math.PI) * 20}, ${128 + Math.sin(factor * Math.PI) * 20}, ${220 + r * 6})`;
        ctx.beginPath();
        ctx.arc(tx, ty, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
}

function createConcreteRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(0, 0, 512, 512);

  // Variación por tabla de encofrado
  for (let y = 0; y < 512; y += 64) {
    const r = Math.floor(190 + Math.random() * 40);
    ctx.fillStyle = `rgb(${r},${r},${r})`;
    ctx.fillRect(0, y, 512, 64);
  }

  // Manchas de porosidad
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.floor(210 + Math.random() * 45);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.15)`;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 4;
  return texture;
}

function createStuccoNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-grano de estuco / revoco fino
  for (let i = 0; i < 25000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const dx = 128 + (Math.random() - 0.5) * 28;
    const dy = 128 + (Math.random() - 0.5) * 28;
    ctx.fillStyle = `rgb(${dx}, ${dy}, 248)`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 8;
  return texture;
}

function createLeafClusterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);

  // Racimos de hojas detalladas con nervaduras y variación tonal
  for (let i = 0; i < 450; i++) {
    const cx = Math.random() * 470 + 21;
    const cy = Math.random() * 470 + 21;
    const length = 16 + Math.random() * 20;
    const width = 7 + Math.random() * 9;
    const angle = Math.random() * Math.PI * 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Gradiente de hoja
    const leafGrad = ctx.createLinearGradient(0, 0, length, 0);
    leafGrad.addColorStop(0, '#cce8b5');
    leafGrad.addColorStop(0.5, '#e8f7dc');
    leafGrad.addColorStop(1, '#bfe0a4');
    ctx.fillStyle = leafGrad;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.45, width, length, 0);
    ctx.quadraticCurveTo(length * 0.45, -width, 0, 0);
    ctx.fill();

    // Nervadura central
    ctx.strokeStyle = 'rgba(160, 200, 140, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length * 0.85, 0);
    ctx.stroke();

    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
}

function createFoliageNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-relieve de hojas orientadas tridimensionalmente
  for (let i = 0; i < 500; i++) {
    const cx = Math.random() * 470 + 21;
    const cy = Math.random() * 470 + 21;
    const rad = 8 + Math.random() * 12;
    const angle = Math.random() * Math.PI * 2;

    const nx = 128 + Math.cos(angle) * 48;
    const ny = 128 + Math.sin(angle) * 48;
    ctx.fillStyle = `rgb(${Math.floor(nx)}, ${Math.floor(ny)}, 240)`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad, rad * 0.5, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
}

function createBarkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(0, 0, 256, 512);

  // Surcos longitudinales de corteza
  for (let x = 0; x < 256; x += 8) {
    const v = Math.floor(45 + Math.random() * 30);
    ctx.fillStyle = `rgb(${v + 16}, ${v + 6}, ${v - 8})`;
    ctx.fillRect(x, 0, 4 + Math.random() * 4, 512);
  }

  // Fisuras y fibras
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    ctx.fillStyle = `rgba(20, 14, 8, ${0.12 + Math.random() * 0.18})`;
    ctx.fillRect(x, y, 2, 6 + Math.random() * 14);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = 8;
  return texture;
}

function createBarkNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 512);

  // Fisuras verticales
  for (let x = 0; x < 256; x += 10) {
    ctx.fillStyle = 'rgb(75, 128, 240)';
    ctx.fillRect(x - 1, 0, 1, 512);
    ctx.fillStyle = 'rgb(180, 128, 240)';
    ctx.fillRect(x + 1, 0, 1, 512);
  }

  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const dx = 128 + (Math.random() - 0.5) * 44;
    const dy = 128 + (Math.random() - 0.5) * 44;
    ctx.fillStyle = `rgb(${dx}, ${dy}, 245)`;
    ctx.fillRect(x, y, 2, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = 8;
  return texture;
}

function createWaterNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  // Ondas compuestas con suma de armónicos
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const u = (x / 512) * Math.PI * 8;
      const v = (y / 512) * Math.PI * 8;

      const dx = (Math.cos(u * 1.5) * 1.2 - Math.sin(u * 0.9) * 0.8 + Math.cos(u * 2.8) * 1.1 + Math.sin(u * 3.5) * 0.9) * 18;
      const dy = (Math.cos(v * 0.8) * 0.8 + Math.sin(v * 1.4) * 1.2 + Math.cos(v * 2.2) * 0.9 - Math.sin(v * 2.9) * 0.8) * 18;

      const nx = Math.max(0, Math.min(255, Math.floor(128 + dx)));
      const ny = Math.max(0, Math.min(255, Math.floor(128 + dy)));
      const nz = 245;

      const idx = (y * 512 + x) * 4;
      data[idx] = nx;
      data[idx + 1] = ny;
      data[idx + 2] = nz;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
}

function createTimberTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a06c3e';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * 256;
    ctx.strokeStyle = 'rgba(' + (70 + Math.random() * 45) + ', ' + (40 + Math.random() * 30) + ', 20, ' + (0.08 + Math.random() * 0.14) + ')';
    ctx.lineWidth = 0.6 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// =============================================================
// MATERIALES ARQUITECTÓNICOS — NIVEL ARCHVIZ PROFESIONAL
// Calibrados para AgX Tone Mapping @ exposición 1.0
// =============================================================
export const Materials = {
  // ─────── FACHADAS Y ESTRUCTURA ───────

  // Estuco blanco arquitectónico mate con micro-textura
  whiteStucco: new THREE.MeshStandardMaterial({
    color: 0xd6d9de,
    normalMap: createStuccoNormalTexture(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.72,
    metalness: 0.03,
    envMapIntensity: 0.35,
  }),

  // Concreto visto con textura PBR, relieve de encofrado y mapa de rugosidad
  warmConcrete: new THREE.MeshStandardMaterial({
    map: createConcreteTexture(),
    normalMap: createConcreteNormalTexture(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: createConcreteRoughnessTexture(),
    roughness: 0.82,
    metalness: 0.05,
    envMapIntensity: 0.35,
  }),

  // Charcoal oscuro (equipos, mobiliario)
  darkCharcoal: new THREE.MeshStandardMaterial({
    color: 0x1e2228,
    roughness: 0.45,
    metalness: 0.35,
    envMapIntensity: 0.5,
  }),

  // ─────── IDENTIDAD INSTITUCIONAL SENA ───────

  // Aluminio anodizado verde institucional con micro-relieve satinado
  senaGreen: new THREE.MeshStandardMaterial({
    color: 0x339900,
    roughness: 0.30,
    metalness: 0.28,
    envMapIntensity: 0.75,
  }),

  // Aluminio anodizado naranja institucional con reflejo metálico
  senaOrange: new THREE.MeshStandardMaterial({
    color: 0xe67e00,
    roughness: 0.35,
    metalness: 0.25,
    envMapIntensity: 0.65,
  }),

  // ─────── VIDRIO ARQUITECTÓNICO DE ALTA GAMA (PHYSICAL GLASS PBR) ───────

  // Muro cortina Low-E — Transmisión óptica física, grosor y reflejo laminar
  lowEGlass: new THREE.MeshPhysicalMaterial({
    color: 0xe8f4f8,
    transparent: true,
    opacity: 1.0,
    transmission: 0.92,
    thickness: 0.65,
    ior: 1.52,
    roughness: 0.03,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    attenuationColor: new THREE.Color(0x76c8d8),
    attenuationDistance: 1.4,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    envMapIntensity: 1.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),

  // Domo geodésico — Vidrio estructural templado azul cobalto con refracción
  blueDomeGlass: new THREE.MeshPhysicalMaterial({
    color: 0xd0ecf6,
    transparent: true,
    opacity: 1.0,
    transmission: 0.88,
    thickness: 1.1,
    ior: 1.48,
    roughness: 0.06,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(0x1a8cb2),
    attenuationDistance: 0.85,
    specularIntensity: 1.2,
    envMapIntensity: 1.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),

  // Lucernarios, pérgolas y claraboyas cenitales
  tintedCanopyGlass: new THREE.MeshPhysicalMaterial({
    color: 0xd8eff6,
    transparent: true,
    opacity: 1.0,
    transmission: 0.86,
    thickness: 0.8,
    ior: 1.5,
    roughness: 0.05,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    attenuationColor: new THREE.Color(0x15709c),
    attenuationDistance: 1.1,
    envMapIntensity: 1.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),

  // ─────── PERFILERÍA Y ESTRUCTURA METÁLICA ───────

  // Acero estructural termolacado blanco/gris claro
  structuralSteelWhite: new THREE.MeshStandardMaterial({
    color: 0xe5eaef,
    roughness: 0.28,
    metalness: 0.60,
    envMapIntensity: 0.85,
  }),

  // Perfilería de aluminio extruido negro grafito con cepillado micro-fino
  darkAluminumMullion: new THREE.MeshStandardMaterial({
    color: 0x181c22,
    normalMap: createBrushedMetalNormalTexture(),
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughness: 0.22,
    metalness: 0.90,
    envMapIntensity: 0.85,
  }),

  // Acero inoxidable pulido y cepillado (barandillas, mástiles, tirantes)
  stainlessSteel: new THREE.MeshStandardMaterial({
    color: 0xd0d8e0,
    normalMap: createBrushedMetalNormalTexture(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.12,
    metalness: 0.95,
    envMapIntensity: 1.2,
  }),

  // ─────── PISOS E INTERIORES ───────

  travertineFloor: new THREE.MeshStandardMaterial({
    map: createMarbleTileTexture(),
    normalMap: createTravertineNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: createTravertineRoughnessTexture(),
    roughness: 0.38,
    metalness: 0.04,
    envMapIntensity: 0.5,
  }),

  woodParquet: new THREE.MeshStandardMaterial({
    map: createWoodParquetTexture(),
    normalMap: createWoodParquetNormalTexture(),
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: createWoodParquetRoughnessTexture(),
    roughness: 0.45,
    metalness: 0.02,
    envMapIntensity: 0.4,
  }),

  auditoriumSeatingRed: new THREE.MeshStandardMaterial({
    color: 0x7a1818,
    roughness: 0.8,
    metalness: 0.03,
    envMapIntensity: 0.2,
  }),

  interiorLightFixture: new THREE.MeshStandardMaterial({
    color: 0xfff0d0,
    emissive: 0xffd899,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  }),

  // ─────── ACABADOS DE FACHADA Y CUBIERTA VERDE ───────

  timberSlat: new THREE.MeshStandardMaterial({
    map: createTimberTexture(),
    normalMap: createWoodParquetNormalTexture(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.35,
  }),
  greenRoof: new THREE.MeshStandardMaterial({ color: 0x7fae4e, roughness: 1, metalness: 0, envMapIntensity: 0.1 }),
  plantFoliage: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, envMapIntensity: 0.15 }),
  clearDomeGlass: new THREE.MeshPhysicalMaterial({
    color: 0xb9e0ef, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.05,
    transmission: 0, thickness: 0.5, ior: 1.45, envMapIntensity: 1.1, depthWrite: false,
  }),

  // ─────── MOBILIARIO, PANTALLAS Y EQUIPOS (HUB, AULAS, LABORATORIOS) ───────

  // Madera laminada para mesas de trabajo, laboratorios y pupitres
  laminateWood: new THREE.MeshStandardMaterial({
    color: 0xba8a59,
    map: createWoodParquetTexture(),
    normalMap: createWoodParquetNormalTexture(),
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.42,
    metalness: 0.02,
    envMapIntensity: 0.35,
  }),

  // Melamina blanca satinada para encimeras y coworking
  laminateWhite: new THREE.MeshStandardMaterial({
    color: 0xf0f2f5,
    roughness: 0.38,
    metalness: 0.02,
    envMapIntensity: 0.35,
  }),

  fabricGrey: new THREE.MeshStandardMaterial({ color: 0x59636f, roughness: 0.95, metalness: 0, envMapIntensity: 0.15 }),
  fabricBlue: new THREE.MeshStandardMaterial({ color: 0x2f5f8f, roughness: 0.95, metalness: 0, envMapIntensity: 0.15 }),
  carpetGrey: new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 1, metalness: 0, envMapIntensity: 0.1 }),
  antistaticFloor: new THREE.MeshStandardMaterial({ color: 0x8a939c, roughness: 0.35, metalness: 0.12, envMapIntensity: 0.4 }),

  // Madera tratada para terrazas y pérgolas exteriores
  deckWood: new THREE.MeshStandardMaterial({
    color: 0x9a7248,
    map: createWoodParquetTexture(),
    normalMap: createDeckWoodNormalTexture(),
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: createWoodParquetRoughnessTexture(),
    roughness: 0.65,
    metalness: 0.02,
    envMapIntensity: 0.3,
  }),

  // Ductería galvanizada industrial con cepillado metálico
  ductGalvanized: new THREE.MeshStandardMaterial({
    color: 0xbac2ca,
    normalMap: createBrushedMetalNormalTexture(),
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.30,
    metalness: 0.88,
    envMapIntensity: 0.95,
  }),

  safetyYellow: new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.45, metalness: 0.2, envMapIntensity: 0.4 }),
  planterGreen: new THREE.MeshStandardMaterial({ color: 0x3f7a2e, roughness: 0.9, metalness: 0, envMapIntensity: 0.1 }),
  screenGlow: new THREE.MeshStandardMaterial({
    color: 0x0b2a40, emissive: 0x2aa7ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1,
  }),
  smartBoard: new THREE.MeshStandardMaterial({
    color: 0x10151c, emissive: 0x1b4f7a, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.2,
  }),
  ledPanel: new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.1, roughness: 0.4,
  }),

  // ─────── CUBIERTAS ───────

  // Panel solar fotovoltaico de alta gama — Silicio monocristalino, busbars de plata y antirreflejo
  solarPanel: new THREE.MeshStandardMaterial({
    map: createSolarCellTexture(),
    normalMap: createSolarCellNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: createSolarCellRoughnessTexture(),
    roughness: 0.14,
    metalness: 0.88,
    envMapIntensity: 1.5,
  }),

  gravelRoof: new THREE.MeshStandardMaterial({
    color: 0x6a7280,
    roughness: 0.95,
    metalness: 0.02,
    envMapIntensity: 0.15,
  }),

  // ─────── TERRENO Y PAISAJISMO ───────

  grassPBR: new THREE.MeshStandardMaterial({
    map: createRichGrassTexture(),
    normalMap: createGrassNormalTexture(),
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.25,
  }),

  asphaltPBR: new THREE.MeshStandardMaterial({
    map: createAsphaltRoadTexture(),
    normalMap: createAsphaltNormalTexture(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: createAsphaltRoughnessTexture(),
    roughness: 0.85,
    metalness: 0.06,
    envMapIntensity: 0.25,
  }),

  paverPlazaPBR: new THREE.MeshStandardMaterial({
    map: createMarbleTileTexture(),
    normalMap: createTravertineNormalTexture(),
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: createTravertineRoughnessTexture(),
    roughness: 0.45,
    metalness: 0.03,
    envMapIntensity: 0.45,
  }),

  curbStone: new THREE.MeshStandardMaterial({
    color: 0x8a9099,
    normalMap: createConcreteNormalTexture(),
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.75,
    envMapIntensity: 0.25,
  }),

  roadStripeWhite: new THREE.MeshBasicMaterial({
    color: 0xeceef0,
  }),

  roadStripeYellow: new THREE.MeshBasicMaterial({
    color: 0xe89800,
  }),

  soccerTurf: new THREE.MeshStandardMaterial({
    color: 0x1e8540,
    normalMap: createGrassNormalTexture(),
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.88,
    envMapIntensity: 0.15,
  }),

  athleticTrackRubber: new THREE.MeshStandardMaterial({
    color: 0xa02520,
    normalMap: createAsphaltNormalTexture(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.82,
    envMapIntensity: 0.15,
  }),

  basketballCourtBlue: new THREE.MeshStandardMaterial({
    color: 0x1e5e8a,
    roughness: 0.72,
    envMapIntensity: 0.2,
  }),

  // Espejo de agua cristalino arquitectónico con relieve de ondas y refracción física
  waterSurface: new THREE.MeshPhysicalMaterial({
    color: 0x1888a8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.03,
    metalness: 0.06,
    ior: 1.333,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    attenuationColor: new THREE.Color(0x0e5d7d),
    attenuationDistance: 1.2,
    envMapIntensity: 1.8,
    normalMap: createWaterNormalTexture(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    side: THREE.DoubleSide,
  }),

  // ─────── VEGETACIÓN Y PAISAJISMO ORGÁNICO ───────

  // Tronco de árbol con corteza fisurada y relieve normal
  treeTrunkRealistic: new THREE.MeshStandardMaterial({
    map: createBarkTexture(),
    normalMap: createBarkNormalTexture(),
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.90,
    metalness: 0.0,
    envMapIntensity: 0.25,
  }),

  // Follaje verde bosque profundo con textura de racimos de hojas
  foliageDeepGreen: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createLeafClusterTexture(),
    normalMap: createFoliageNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
  }),

  // Follaje verde claro y brotes nuevos con transmisión lumínica
  foliageBrightGreen: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createLeafClusterTexture(),
    normalMap: createFoliageNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
  }),

  // Follaje de floración (Guayacanes amarillos / rosados / Jacarandas)
  foliageFlowering: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createLeafClusterTexture(),
    normalMap: createFoliageNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.76,
    metalness: 0.0,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
  }),

  // ─────── ESCALA HUMANA ───────

  personColors: [
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7, envMapIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.7, envMapIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7, envMapIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7, envMapIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.7, envMapIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.7, envMapIntensity: 0.3 }),
  ],

  carMetallicColors: [
    new THREE.MeshStandardMaterial({ color: 0x222830, metalness: 0.88, roughness: 0.2, envMapIntensity: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0xaab2bc, metalness: 0.82, roughness: 0.25, envMapIntensity: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x881818, metalness: 0.88, roughness: 0.2, envMapIntensity: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x1a5580, metalness: 0.88, roughness: 0.2, envMapIntensity: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x146050, metalness: 0.82, roughness: 0.25, envMapIntensity: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x303848, metalness: 0.88, roughness: 0.18, envMapIntensity: 1.0 }),
  ],
};

// Canvas colors are authored in sRGB; decode once before physical lighting.
// Then derive normal maps procedurally from canvas color textures.
for (const material of Object.values(Materials).flat()) {
  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;

    // Generar normal map procedural a partir de la textura de color
    const sourceCanvas = material.map.image;
    if (sourceCanvas && sourceCanvas.tagName === 'CANVAS') {
      const normalMap = generateNormalMap(sourceCanvas, 2.0);
      normalMap.repeat.copy(material.map.repeat);
      normalMap.anisotropy = material.map.anisotropy;
      material.normalMap = normalMap;
      material.normalScale = new THREE.Vector2(0.35, 0.35);
    }
  }
}
