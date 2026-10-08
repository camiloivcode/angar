import * as THREE from 'three';

/**
 * Estilo "metaverso" (Horizon Worlds / Rec Room): materiales mate, color limpio, luz de relleno suave y
 * poca reflexión. Fuente única de los valores: materiales, luces, niebla y postprocesado leen de aquí.
 * `?look=pbr` en la URL desactiva el acabado de materiales para comparar con el aspecto anterior.
 */
export const LOOK = Object.freeze({
  material: Object.freeze({
    minRoughness: 0.78,     // sin brillos especulares duros
    metalnessScale: 0.15,   // el metal pasa a pintura/plástico
    envMapIntensity: 0.35,  // casi sin reflejo del cielo
    normalScale: 0.4,       // micro-relieve más suave (textura de baja frecuencia)
    saturation: 1.12,
    lift: 0.05,             // aclara los tonos hacia el blanco
  }),
  light: Object.freeze({
    hemiIntensity: 1.05,
    hemiSky: 0xffe2c4,
    hemiGround: 0x8a9a6a,   // rebote verde-cálido del suelo
    fillIntensity: 0.55,
    fillColor: 0xa8c4e8,
    environmentIntensity: 0.8,
    fogColor: 0xf0cba8,     // el mismo tono pastel del horizonte
    fogDensity: 0.00035,
  }),
  post: Object.freeze({
    vignetteDarkness: 0.12,
    bloomStrength: 0.1,
  }),
  toneMapping: THREE.NeutralToneMapping,   // AgX desatura; Neutral conserva el color
});

// Valores de luz previos al estilo, para `?look=pbr`.
const LIGHT_PBR = Object.freeze({
  hemiIntensity: 0.6, hemiSky: 0xffb888, hemiGround: 0x2a3820,
  fillIntensity: 0.35, fillColor: 0x7090b8, environmentIntensity: 0.55,
  fogColor: 0xd07048, fogDensity: 0.00015,
});

export const lightLook = () => (useStylizedLook() ? LOOK.light : LIGHT_PBR);

const isGlassLike = m => m.transmission > 0 || (m.isMeshPhysicalMaterial && m.transparent);

/** Acabado mate y limpio de un material PBR. Idempotente. */
export function stylizeMaterial(m, s = LOOK.material) {
  if (!m.isMeshStandardMaterial || m.userData.stylized || isGlassLike(m)) return;
  m.userData.stylized = true;
  m.roughness = Math.max(m.roughness, s.minRoughness);
  m.metalness *= s.metalnessScale;
  m.envMapIntensity = Math.min(m.envMapIntensity, s.envMapIntensity);
  m.normalScale?.multiplyScalar(s.normalScale);
  if ('clearcoat' in m) m.clearcoat = 0;
  const hsl = {};
  m.color.getHSL(hsl);
  m.color.setHSL(hsl.h, Math.min(hsl.s * s.saturation, 1), hsl.l + (1 - hsl.l) * s.lift);
}

export function applyStylizedLook(materials, s = LOOK.material) {
  for (const m of Object.values(materials).flat()) stylizeMaterial(m, s);
}

/** Atenúa viñeta y bloom del composer (escritorio). */
export function stylizePostprocessing({ vignettePass, bloomPass }, p = LOOK.post) {
  vignettePass.uniforms.darkness.value = p.vignetteDarkness;
  bloomPass.strength = p.bloomStrength;
}

export const useStylizedLook = (search = globalThis.location?.search ?? '') =>
  new URLSearchParams(search).get('look') !== 'pbr';
