import * as THREE from 'three';

const lienzo = (w, h, dibuja) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dibuja(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};

// Colombia: amarillo ½, azul ¼, rojo ¼.
export const banderaColombia = () => lienzo(600, 400, (g, w, h) => {
  g.fillStyle = '#FCD116'; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#003893'; g.fillRect(0, h / 2, w, h / 4);
  g.fillStyle = '#CE1126'; g.fillRect(0, h * 3 / 4, w, h / 4);
});

// Barranquilla: tres rectángulos concéntricos (rojo, amarillo, verde) y estrella dorada de ocho puntas.
export const banderaBarranquilla = () => lienzo(600, 400, (g, w, h) => {
  const rect = (m, c) => { g.fillStyle = c; g.fillRect(m * w, m * h, w * (1 - 2 * m), h * (1 - 2 * m)); };
  rect(0, '#D4202A'); rect(0.09, '#F9D71C'); rect(0.19, '#1B8A3C');
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2, r = i % 2 ? h * 0.13 : h * 0.34;
    g[i ? 'lineTo' : 'moveTo'](w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
  }
  g.closePath(); g.fillStyle = '#F2B705'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a5a00'; g.stroke();
});

export function etiqueta(texto, { alto = 1.2, color = '#fff', fondo = 'rgba(15,23,32,.78)' } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '600 40px system-ui, sans-serif';
  c.width = Math.ceil(g.measureText(texto).width) + 40; c.height = 64;
  g.font = '600 40px system-ui, sans-serif'; g.fillStyle = fondo; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 12); g.fill();
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(texto, 20, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(alto * c.width / c.height, alto, 1); s.renderOrder = 10;
  return s;
}
