import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { lightLook } from './stylized.js';

const PRESETS = {
  sunset: { hour: 17.5, icon: 'sunset', label: 'Atardecer' }
};

export class EnvironmentManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.scene.environmentIntensity = lightLook().environmentIntensity;
    this.listeners = new Set();
    this.environmentTarget = null;
    this.reflectionHour = null;

    // Sky dome — 2 km radius encloses the full orbit range
    this.sky = new Sky();
    this.sky.scale.setScalar(2000);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.sunPosition = new THREE.Vector3();

    // ── Primary Sun Light ──
    // ArchViz: warm golden directional light with soft shadows
    this.dirLight = new THREE.DirectionalLight(0xff9855, 1.8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(4096, 4096);
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 400;
    Object.assign(this.dirLight.shadow.camera, {
      left: -160, right: 160, top: 160, bottom: -160
    });
    this.dirLight.shadow.camera.updateProjectionMatrix();
    this.dirLight.shadow.bias = -0.00015;
    this.dirLight.shadow.normalBias = 0.025;
    this.dirLight.shadow.radius = 1.5;
    this.scene.add(this.dirLight, this.dirLight.target);

    // ── Fill Light ── (warm ambient fill)
    this.fillLight = new THREE.DirectionalLight(lightLook().fillColor, lightLook().fillIntensity);
    this.fillLight.position.set(-80, 60, -40);
    this.scene.add(this.fillLight);

    // ── Hemisphere ── sky warm / ground bounce light
    this.hemiLight = new THREE.HemisphereLight(lightLook().hemiSky, lightLook().hemiGround, lightLook().hemiIntensity);
    this.hemiLight.position.set(0, 150, 0);
    this.scene.add(this.hemiLight);

    // ── Atmospheric Fog (sutil neblina dorada de atardecer) ──
    this.scene.fog = new THREE.FogExp2(lightLook().fogColor, lightLook().fogDensity);

    // ── Architectural Lighting ──
    this.nightLights = new THREE.Group();
    this.scene.add(this.nightLights);
    this.setupArchitecturalNightLighting();

    // ── Environment Map ──
    this.reflectionScene = new THREE.Scene();
    this.reflectionSky = this.sky.clone(false);
    this.reflectionScene.add(this.reflectionSky);
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.nightColor = new THREE.Color(0x0a1220);

    // Initialize at cinematic golden hour sunset
    this.setTimeOfDay(17.5);
  }

  setupArchitecturalNightLighting() {
    const lights = [
      // Auditorio — luz cálida dorada sobre la cúpula
      { color: 0xffaa44, intensity: 110, distance: 70, x: 0, y: 14, z: -56 },
      // Atrio central — acento cyan
      { color: 0x00d2ff, intensity: 80, distance: 60, x: 0, y: 12, z: -18 },
      // Alas — iluminación cálida de interior
      ...[ { x: -30, z: 22 }, { x: -10, z: 28 }, { x: 10, z: 28 }, { x: 30, z: 22 }
      ].map(position => ({
        ...position, color: 0xfff1cf, intensity: 60, distance: 48, y: 11
      })),
      // Barra transversal — luz de oficina
      { color: 0xfff5e0, intensity: 40, distance: 30, x: -42, y: 5, z: -26 },
      { color: 0xfff5e0, intensity: 40, distance: 30, x: 42, y: 5, z: -26 },
      // Plaza de acceso — iluminación de senderos
      { color: 0xffd080, intensity: 30, distance: 25, x: 0, y: 3, z: 68 },
    ];
    for (const light of lights) {
      const point = new THREE.PointLight(light.color, light.intensity, light.distance);
      point.position.set(light.x, light.y, light.z);
      point.userData.nightIntensity = light.intensity;
      this.nightLights.add(point);
    }
  }

  setTimeOfDay(hour, { updateReflections = true } = {}) {
    this.timeOfDay = 17.5; // Modo permanente: Atardecer dorado (Golden Hour)

    // Solar arc: sunset 17:30
    const progress = (17.5 - 6) / 12;
    const elevation = 12.0; // Ángulo rasante cálido de atardecer
    const azimuth = 252.0;
    this.sunPosition.setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - elevation),
      THREE.MathUtils.degToRad(azimuth)
    );
    this.dirLight.position.copy(this.sunPosition).multiplyScalar(200);
    this.dirLight.position.add(this.dirLight.target.position);

    this.currentPreset = 'sunset';

    // ── Sky Atmosphere Atardecer Dorado ──
    const uniforms = this.sky.material.uniforms;
    uniforms.sunPosition.value.copy(this.sunPosition);
    uniforms.turbidity.value = 4.5;
    uniforms.rayleigh.value = 3.2;
    uniforms.mieCoefficient.value = 0.012;
    uniforms.mieDirectionalG.value = 0.85;

    const refUniforms = this.reflectionSky.material.uniforms;
    refUniforms.sunPosition.value.copy(this.sunPosition);
    refUniforms.turbidity.value = uniforms.turbidity.value;
    refUniforms.rayleigh.value = uniforms.rayleigh.value;
    refUniforms.mieCoefficient.value = uniforms.mieCoefficient.value;
    refUniforms.mieDirectionalG.value = uniforms.mieDirectionalG.value;

    this.sky.visible = true;
    this.reflectionSky.visible = true;
    this.scene.background = null;
    this.reflectionScene.background = null;
    this.scene.environmentIntensity = lightLook().environmentIntensity;

    // ── Sun Color & Intensity Cálida ──
    this.dirLight.color.setHex(0xff9855);
    this.dirLight.intensity = 1.8;

    // ── Fill & Hemi Light ──
    const look = lightLook();
    this.fillLight.intensity = look.fillIntensity;
    this.fillLight.color.setHex(look.fillColor);

    this.hemiLight.color.setHex(look.hemiSky);
    this.hemiLight.groundColor.setHex(look.hemiGround);
    this.hemiLight.intensity = look.hemiIntensity;

    // ── Fog ──
    this.scene.fog.color.setHex(look.fogColor);
    this.scene.fog.density = look.fogDensity;

    // ── Night Lights ──
    this.nightLights.visible = true;
    for (const light of this.nightLights.children) {
      light.intensity = (light.userData.nightIntensity || 40) * 0.45;
    }

    if (updateReflections) this.updateEnvironmentReflections();
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
    return state;
  }

  getState() {
    const { icon, label } = PRESETS.sunset;
    return { timeOfDay: 17.5, mode: 'sunset', icon, label };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  applyPreset(preset = 'sunset') {
    return this.setTimeOfDay(17.5);
  }

  updateEnvironmentReflections() {
    if (this.reflectionHour === this.timeOfDay && this.environmentTarget) return;
    const previousTarget = this.environmentTarget;
    this.environmentTarget = this.pmremGenerator.fromScene(this.reflectionScene, 0, 0.1, 1200);
    this.scene.environment = this.environmentTarget.texture;
    this.reflectionHour = this.timeOfDay;
    previousTarget?.dispose();
  }

  toggleNext() {
    return this.applyPreset('sunset');
  }

  dispose() {
    this.listeners.clear();
    if (this.scene.environment === this.environmentTarget?.texture) this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.pmremGenerator.dispose();
    this.dirLight.shadow.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.scene.remove(this.sky, this.dirLight, this.dirLight.target, this.hemiLight, this.fillLight, this.nightLights);
    this.reflectionScene.clear();
  }
}
