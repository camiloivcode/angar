import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Subtle architectural vignette — darkens edges for a cinematic, professional look
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.85 },
    darkness: { value: 0.35 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = smoothstep(offset, offset + 0.45, dist) * darkness;
      texel.rgb *= 1.0 - vignette;
      gl_FragColor = texel;
    }
  `,
};

export function setupPostprocessing(renderer, scene, camera) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const composer = new EffectComposer(renderer);

  // 1. Render Pass Base (Renderiza la escena 3D completa con materiales PBR e iluminación)
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Bloom Cinemático — Resplandor sutil en cúpula, destellos y luminarias
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.round(width / 2), Math.round(height / 2)),
    0.14,   // strength
    0.30,   // radius
    0.90    // threshold
  );
  composer.addPass(bloomPass);

  // 3. Vignette — Enmarcado cinematográfico sutil
  const vignettePass = new ShaderPass(VignetteShader);
  composer.addPass(vignettePass);

  // 4. Output Pass con mapeo de tonos ACES Filmic / AgX
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function resize(w, h, pixelRatio = renderer.getPixelRatio()) {
    const safeRatio = Math.min(pixelRatio, 2);
    composer.setPixelRatio(safeRatio);
    composer.setSize(w, h);
    bloomPass.setSize(Math.round(w / 2), Math.round(h / 2));
  }

  function dispose() {
    bloomPass.dispose();
    vignettePass.dispose();
    outputPass.dispose();
    composer.dispose();
  }

  return { composer, bloomPass, vignettePass, resize, dispose };
}
