import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SITIO as S, FLOOR_HEIGHT, EXPLODE_STEP, KIND_INFO, mundo } from '../model/program.js';
import { PARAMS as P } from '../medidas.js';

const { L, H, PL } = S;

export class HotspotsManager {
  constructor(scene, camera, onSelectHotspot, { building } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.building = building;
    this.enabled = true;
    this.floorMode = 'all';
    this.hotspotsGroup = new THREE.Group();
    scene.add(this.hotspotsGroup);
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(innerWidth, innerHeight);
    Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '5' });
    document.getElementById('app').appendChild(this.labelRenderer.domElement);
    const at = (x, y, z) => { const w = mundo(x, z); return [w.x, y, w.z]; };
    const cxH = S.xH + H.ancho / 2, fmt = n => Math.round(n).toLocaleString('es-CO');
    const puestos = L.der.pisos.flatMap(d => d.recintos).reduce((s, r) => s + (r.puestos || 0), 0);
    const spots = [
      { id: 'hangar', name: 'Hangar', badge: `${H.ancho} × ${H.fondo} m`, dimensions: `${H.ancho} × ${H.fondo} m`,
        pos: at(cxH, H.alturaLibre + 3.5, S.zEd + H.fondo / 2), cameraTarget: at(cxH, 2, S.zEd + H.fondo / 2), cameraPos: at(cxH + 10, 44, S.zFr + 52),
        type: 'Hangar de instrucción', area: `${fmt(H.area)} m²`, cap: '4 aeronaves, salida independiente', desc: KIND_INFO.hangar.description },
      { id: 'formacion', name: 'Formación', badge: '14 ambientes · 25 aprendices', dimensions: `${L.anchoIzq} × ${H.fondo} m`,
        pos: at(S.xEd + L.anchoIzq / 2, FLOOR_HEIGHT + 3, S.zEd + H.fondo / 2), cameraTarget: at(S.xEd + L.anchoIzq / 2, 2, S.zEd + H.fondo / 2), cameraPos: at(S.xEd - 26, 40, S.zFr + 44),
        type: 'Ambientes de formación', area: `${fmt(L.areas.formacion)} m² de recintos`, cap: '25 aprendices por ambiente', desc: `${KIND_INFO.aula.description} Un piso, sin vista al hangar.` },
      { id: 'admin', name: 'Administración', badge: '2º piso · vista al hangar', dimensions: `${L.anchoDer} × ${H.fondo} m`, floor: 2,
        pos: at(S.xD + L.anchoDer * 0.72, FLOOR_HEIGHT * 2 + 2, S.zEd + H.fondo / 2), cameraTarget: at(S.xD + 6, FLOOR_HEIGHT + 1.4, S.zEd + 10), cameraPos: at(S.xD + L.anchoDer + 18, 22, S.zFr + 30),
        type: 'Administración', area: `${fmt(L.areas.admin)} m² de oficinas`, cap: `${puestos} puestos y sillas de sala`, desc: KIND_INFO.admin.description },
      { id: 'apoyo', name: 'Técnicas y apoyo', badge: 'Equipos de tierra · cafetería · biblioteca', dimensions: `${L.anchoDer} × ${H.fondo} m`,
        pos: at(S.xD + L.anchoDer * 0.28, FLOOR_HEIGHT - 0.5, S.zEd + H.fondo / 2), cameraTarget: at(S.xD + L.anchoDer / 2, 2, S.zEd + H.fondo / 2), cameraPos: at(S.xD + L.anchoDer + 22, 30, S.zFr + 40),
        type: 'Áreas técnicas, apoyo y bienestar', area: `${fmt(L.areas.apoyo)} m² de recintos`, cap: 'Piso 1, con puertas al hangar', desc: 'Equipos de tierra, almacén aeronáutico y zona cero (cuarentena), con puerta directa al hangar, más recepción, enfermería, sala de instructores, cafetería, biblioteca y aseo.' },
      { id: 'plataforma', name: 'Plataforma', badge: `${PL.fondo} m de fondo · una pista`, dimensions: `${PL.ancho} × ${PL.fondo} m`,
        pos: at(cxH, 5, S.zFr + PL.fondo / 2 + 6), cameraTarget: at(cxH, 2, S.zFr + 8), cameraPos: at(cxH, 26, S.zPlat + 44),
        type: 'Plataforma y pista de rodaje', area: `${fmt(PL.ancho * PL.fondo)} m²`, cap: 'Cualquier aeronave, o todas, pueden estar afuera', desc: KIND_INFO.plataforma.description },
      { id: 'predio', name: 'Predio mínimo', badge: `${L.ancho} × ${L.fondo} m`, dimensions: `${L.ancho} × ${L.fondo} m`,
        pos: at(L.ancho * 0.12, 4, S.zEd - 12), cameraTarget: at(L.ancho / 2, 0, L.fondo * 0.45), cameraPos: at(L.ancho / 2, 150, L.fondo + 120),
        type: 'Implantación', area: `${(L.area / 10000).toFixed(2)} ha`, cap: `${P.parqueoPuestos} puestos de parqueo`, desc: 'Lote mínimo que resulta de sumar hangar, bloques, plataforma, andén, parqueo, reserva para un 2º hangar y retiros.' },
    ];
    this.spots = spots.map(spot => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'hotspot-pin';
      element.style.pointerEvents = 'auto';
      element.setAttribute('aria-label', 'Explorar ' + spot.name);
      const beacon = document.createElement('span');
      beacon.className = 'pin-beacon';
      beacon.setAttribute('aria-hidden', 'true');
      const card = document.createElement('span');
      card.className = 'pin-card';
      const badge = document.createElement('span');
      badge.className = 'pin-badge';
      badge.textContent = spot.badge;
      const title = document.createElement('span');
      title.className = 'pin-title';
      title.textContent = spot.name;
      card.append(badge, title);
      element.append(beacon, card);
      element.addEventListener('click', event => {
        event.stopPropagation();
        const offset = this.getOffset(spot);
        onSelectHotspot({ ...spot,
          cameraPos: spot.cameraPos.map((value, i) => i === 1 ? value + offset : value),
          cameraTarget: spot.cameraTarget.map((value, i) => i === 1 ? value + offset : value),
        });
      });
      const object = new CSS2DObject(element);
      object.position.fromArray(spot.pos);
      this.hotspotsGroup.add(object);
      return { data: spot, object };
    });
  }
  getOffset(spot) {
    return this.floorMode === 'exploded' && spot.floor ? (spot.floor - 1) * EXPLODE_STEP : 0;
  }
  setFloorMode(mode) { this.floorMode = mode; }
  setVisibility(visible) {
    this.enabled = visible;
    this.hotspotsGroup.visible = visible;
  }
  setSize(width, height) { this.labelRenderer.setSize(width, height); }
  render() {
    for (const { data, object } of this.spots) {
      // El rótulo de un piso desaparece con el piso (Pisos 1: el 2º no se ve).
      const nivelOk = !data.floor || ['all', 'exploded'].includes(this.floorMode) || Number(this.floorMode) >= data.floor;
      object.visible = this.enabled && nivelOk;
      object.position.y = data.pos[1] + this.getOffset(data);
    }
    this.labelRenderer.render(this.scene, this.camera);
  }
}
