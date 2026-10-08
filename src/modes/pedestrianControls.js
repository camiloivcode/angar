import * as THREE from 'three';
import gsap from 'gsap';
import { levelBase, WALK_LIMIT } from '../model/program.js';
import { spawnById } from '../model/spawns.js';

/**
 * PedestrianControls - Navegación Inmersiva 100% Web estilo Street View y Recorrido Libre
 *
 * Características:
 * - Teletransporte directo a salones emblemáticos (IA, Robótica, FabLab, Auditorio, etc.)
 * - Movimiento con WASD / Flechas de alta velocidad (8 m/s caminata, 16 m/s carrera con Shift)
 * - Navegación por clics en el piso estilo Google Street View (dolly rápido al punto)
 * - Botones de avance y retroceso (▲ / ▼) en pantalla
 * - Rotación 360° con arrastre de ratón o toque táctil en móviles
 * - Detección inteligente de cota de losa y adaptación de nivel
 */
// Límite de caminata: el borde exterior de la avenida perimetral (centro ±206 m, 12 m de ancho)
// Solo las losas y el terreno cuentan como suelo: no se camina sobre aeronaves ni mobiliario.
const esSuelo = h => h.object.userData.walkable || h.object.userData.floorArea;

export class PedestrianControls {
  constructor({
    camera,
    renderer,
    scene,
    orbitControls,
    walkableSurfaces = [],
    interactiveObjects = [],
    obstaculos = [],
    onModeChange = null,
    onFloorChangeNeeded = null,
    onMove = null,
    onBoundary = null,
    onFlyChange = null
  }) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;
    this.orbitControls = orbitControls;
    this.walkableSurfaces = Array.isArray(walkableSurfaces) ? walkableSurfaces : [walkableSurfaces];
    this.interactiveObjects = interactiveObjects;
    this.onModeChange = onModeChange;
    this.onFloorChangeNeeded = onFloorChangeNeeded;
    this.onMove = onMove;
    this.onBoundary = onBoundary;
    this.onFlyChange = onFlyChange;
    this.lastBoundaryNotice = 0;

    this.active = false;
    this.eyeHeight = 1.65; // Altura promedio de ojos (escala 1:1)
    this.walkSpeed = 8.0;  // Velocidad de caminata rápida (8 m/s)
    this.sprintSpeed = 16.0; // Velocidad de carrera con Shift (16 m/s)
    this.currentFloorElevation = 0.0;
    this.currentFloorLevel = 1;

    // Estado del teclado WASD / Flechas / Shift
    this.keys = { forward: false, backward: false, left: false, right: false, shift: false, ctrl: false, space: false, turnLeft: false, turnRight: false };

    // Mando (Gamepad API): ejes de movimiento y botones del cuadro anterior
    this.padMove = { x: 0, y: 0 };
    this.padSprint = false;
    this.padUp = false;
    this.padDown = false;
    this.padPrev = [];
    this.velocity = new THREE.Vector3();

    // Vuelo estilo Minecraft creativo: doble toque de Espacio (o de A) alterna volar
    this.flying = false;
    this.vy = 0;
    this.flySpeed = 7;        // m/s vertical
    this.flySprintSpeed = 12;
    this.maxAltitude = 150;
    this.lastFlyTap = -Infinity;

    // Orientación de la cámara (Yaw / Pitch)
    this.yaw = 0;
    this.pitch = 0;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Memoria de la posición orbital previa
    this.savedOrbit = {
      position: new THREE.Vector3(145, 150, 190),
      target: new THREE.Vector3(0, 0, -5)
    };

    // Raycasters para suelo y colisiones
    this.raycaster = new THREE.Raycaster();
    this.raycaster.camera = camera;
    this.pointer = new THREE.Vector2();
    this.downRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 30);
    this.downRay.camera = camera;   // los rótulos (Sprite) exigen cámara al lanzar rayos; sin ella el modo a pie lanza una excepción al entrar
    this.hoverGroundPoint = null;

    // Colisiones: rayos horizontales a la altura de rodillas y pecho contra `obstaculos` (muros, aeronaves, equipos, vehículos); se desliza por la pared
    this.obstaculos = obstaculos;
    this.radio = 0.32;
    this._rc = new THREE.Raycaster(); this._rc.camera = camera;
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(); this._n = new THREE.Vector3(); this._m4 = new THREE.Matrix4();

    // Estado de arrastre del puntero
    this.isDragging = false;
    this.lastPointerPos = { x: 0, y: 0 };
    this.pointerDownPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;

    // Retículo visual en el piso estilo Street View
    this.reticle = this.createStreetViewReticle();
    this.scene.add(this.reticle);

    // Vectores en caché para evitar GC durante movimiento WASD continuo
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this.setupEventListeners();
  }

  /** Lista de objetos contra los que se choca (grupos o mallas instanciadas). Los vanos de puertas quedan libres. */
  setObstaculos(lista) { this.obstaculos = lista; }

  /** Primer obstáculo al avanzar desde (x, z) en la dirección unitaria (ux, uz) hasta `largo`: { distancia, n: {x, z} } o null. */
  golpe(x, z, ux, uz, largo) {
    if (!this.obstaculos.length || largo <= 0) return null;
    const base = this.currentFloorElevation, rc = this._rc, dir = this._d.set(ux, 0, uz);
    let mejor = null;
    for (const h of [0.45, 1.35]) for (const l of [-0.26, 0, 0.26]) {
      rc.set(this._o.set(x - uz * l, base + h, z + ux * l), dir); rc.far = largo;
      for (const hit of rc.intersectObjects(this.obstaculos, true)) {
        const o = hit.object;
        if (o.isSprite || o.isLine || o.name === 'Hitbox' || o.material?.visible === false) continue;
        if (!mejor || hit.distance < mejor.distancia) {
          const n = this._n.copy(hit.face?.normal ?? this._n.set(0, 0, 1));
          if (o.isInstancedMesh && hit.instanceId !== undefined) { o.getMatrixAt(hit.instanceId, this._m4); n.transformDirection(this._m4); }
          n.transformDirection(o.matrixWorld); n.y = 0;
          const k = Math.hypot(n.x, n.z) || 1;
          mejor = { distancia: hit.distance, n: { x: n.x / k, z: n.z / k } };
        }
        break;
      }
    }
    return mejor;
  }

  /** Desplaza la cámara (dx, dz) sin atravesar obstáculos: avanza hasta el radio del cuerpo y desliza por la pared. */
  mover(dx, dz) {
    const p = this.camera.position;
    if (this.flying || !this.obstaculos.length) { p.x += dx; p.z += dz; return; }
    for (let i = 0; i < 3; i++) {
      const len = Math.hypot(dx, dz);
      if (len < 1e-5) return;
      const ux = dx / len, uz = dz / len, hit = this.golpe(p.x, p.z, ux, uz, len + this.radio);
      if (!hit) { p.x += dx; p.z += dz; return; }
      const libre = Math.min(Math.max(0, hit.distancia - this.radio), len);
      p.x += ux * libre; p.z += uz * libre;
      const resto = len - libre, dot = ux * hit.n.x + uz * hit.n.z;
      dx = (ux - hit.n.x * dot) * resto; dz = (uz - hit.n.z * dot) * resto;         // lo que queda va a lo largo de la pared
    }
  }

  /** Recorta un destino (x, z) hasta el primer obstáculo del trayecto recto desde la posición actual. */
  limitarTrayecto(tx, tz) {
    const p = this.camera.position, dx = tx - p.x, dz = tz - p.z, len = Math.hypot(dx, dz);
    if (len < 1e-3 || this.flying) return { x: tx, z: tz };
    const hit = this.golpe(p.x, p.z, dx / len, dz / len, len + this.radio);
    if (!hit) return { x: tx, z: tz };
    const libre = Math.max(0, hit.distancia - this.radio);
    return { x: p.x + dx / len * libre, z: p.z + dz / len * libre };
  }

  /**
   * Crea el retículo en el suelo con anillo y flecha direccional (Street View)
   */
  createStreetViewReticle() {
    const group = new THREE.Group();
    group.name = 'StreetView_Reticle';

    // Anillo exterior verde SENA con borde nítido
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x75c842,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    group.add(ringMesh);

    // Chevron / Flecha de avance Street View en el centro
    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(0, 0.32);
    chevronShape.lineTo(0.24, -0.14);
    chevronShape.lineTo(0.12, -0.06);
    chevronShape.lineTo(0.12, -0.28);
    chevronShape.lineTo(-0.12, -0.28);
    chevronShape.lineTo(-0.12, -0.06);
    chevronShape.lineTo(-0.24, -0.14);
    chevronShape.closePath();

    const chevronGeo = new THREE.ShapeGeometry(chevronShape);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    this.chevronMesh = new THREE.Mesh(chevronGeo, chevronMat);
    this.chevronMesh.rotation.x = -Math.PI / 2;
    this.chevronMesh.position.y = 0.002;
    group.add(this.chevronMesh);

    group.visible = false;
    return group;
  }

  /**
   * Configuración de eventos de interacción (Teclado WASD ágil + Clics Street View + Arrastre 360°)
   */
  setupEventListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', event => {
        if (!this.active) return;
        if (event.target instanceof Element && event.target.closest('input, textarea, dialog')) return;   // escribiendo en el buscador
        switch (event.code) {
          case 'KeyW':
          case 'ArrowUp':
            this.keys.forward = true;
            break;
          case 'KeyS':
          case 'ArrowDown':
            this.keys.backward = true;
            break;
          case 'KeyA':
          case 'ArrowLeft':
            this.keys.left = true;
            break;
          case 'KeyD':
          case 'ArrowRight':
            this.keys.right = true;
            break;
          case 'ShiftLeft':
          case 'ShiftRight':
            this.keys.shift = true;
            break;
          case 'ControlLeft':
          case 'ControlRight':
            this.keys.ctrl = true;
            break;
          case 'Space':
            event.preventDefault();
            if (!event.repeat) this.registerFlyTap();
            this.keys.space = true;
            break;
          case 'KeyQ':
            this.keys.turnLeft = true;
            break;
          case 'KeyE':
            this.keys.turnRight = true;
            break;
          case 'Escape':
            this.exitPedestrianMode();
            break;
        }
      });

      window.addEventListener('keyup', event => {
        if (!this.active) return;
        switch (event.code) {
          case 'KeyW':
          case 'ArrowUp':
            this.keys.forward = false;
            break;
          case 'KeyS':
          case 'ArrowDown':
            this.keys.backward = false;
            break;
          case 'KeyA':
          case 'ArrowLeft':
            this.keys.left = false;
            break;
          case 'KeyD':
          case 'ArrowRight':
            this.keys.right = false;
            break;
          case 'ShiftLeft':
          case 'ShiftRight':
            this.keys.shift = false;
            break;
          case 'ControlLeft':
          case 'ControlRight':
            this.keys.ctrl = false;
            break;
          case 'Space':
            this.keys.space = false;
            break;
          case 'KeyQ':
            this.keys.turnLeft = false;
            break;
          case 'KeyE':
            this.keys.turnRight = false;
            break;
        }
      });
    }

    const dom = this.renderer?.domElement;
    if (!dom || typeof dom.addEventListener !== 'function') return;

    // Pointer Move: actualizar retículo en el suelo y rotación 360 al arrastrar
    dom.addEventListener('pointermove', event => {
      const rect = dom.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      // Si estamos arrastrando en modo Street View, rotar la vista 360°
      if (this.active && this.isDragging) {
        const dx = event.clientX - this.lastPointerPos.x;
        const dy = event.clientY - this.lastPointerPos.y;
        this.lastPointerPos.x = event.clientX;
        this.lastPointerPos.y = event.clientY;

        this.yaw -= dx * 0.003;
        this.pitch -= dy * 0.003;
        this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
        this.updateCameraRotation();
      }

      this.updateGroundHover();
    });

    dom.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      this.isDragging = true;
      this.lastPointerPos = { x: event.clientX, y: event.clientY };
      this.pointerDownPos = { x: event.clientX, y: event.clientY };
      this.pointerDownTime = performance.now();
    });

    const finishPointer = event => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // Clic corto sin arrastre significativo
      const dist = Math.hypot(
        event.clientX - this.pointerDownPos.x,
        event.clientY - this.pointerDownPos.y
      );
      const duration = performance.now() - this.pointerDownTime;

      if (this.active && dist < 6 && duration < 320) {
        const rect = dom.getBoundingClientRect();
        this.pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.updateGroundHover(); // sin mover el mouse, el punto estaría desactualizado
        if (this.hoverGroundPoint) {
          this.teleportTo(this.hoverGroundPoint, 0.65);
        }
      }
    };

    dom.addEventListener('pointerup', finishPointer);
    dom.addEventListener('pointercancel', () => { this.isDragging = false; });
  }

  /**
   * Proyecta el rayo al suelo y actualiza el retículo direccional
   */
  updateGroundHover() {
    if (this.walkableSurfaces.length === 0) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.far = this.active ? 400 : 450;

    const hits = this.raycaster.intersectObjects(this.walkableSurfaces, true);
    const valid = hits.find(h =>
      esSuelo(h) &&
      !h.object.name.includes('Glass') &&
      h.point.y >= -0.2 &&
      h.point.y <= (this.active ? this.currentFloorElevation + 2.5 : 24.0)
    );

    if (valid) {
      this.hoverGroundPoint = valid.point.clone();
      this.reticle.position.copy(valid.point);
      this.reticle.position.y += 0.035;

      // Orientar el chevron en el suelo hacia adelante desde la cámara
      const dirX = valid.point.x - this.camera.position.x;
      const dirZ = valid.point.z - this.camera.position.z;
      const angle = Math.atan2(dirX, dirZ);
      this.reticle.rotation.y = angle;

      this.reticle.visible = true;
    } else {
      this.hoverGroundPoint = null;
      this.reticle.visible = false;
    }
  }

  /**
   * Obtiene la cota Y del piso en las coordenadas X, Z
   */
  getGroundHeightAt(x, z, referenceY = null) {
    const startY = referenceY !== null ? referenceY + 2.5 : 25.0;
    this.downRay.set(new THREE.Vector3(x, startY, z), new THREE.Vector3(0, -1, 0));
    const hits = this.downRay.intersectObjects(this.walkableSurfaces, true);
    const valid = hits.find(h =>
      esSuelo(h) &&
      !h.object.name.includes('Glass') &&
      h.point.y >= -0.5 &&
      h.point.y <= (referenceY !== null ? referenceY + 2.0 : 24.0)
    );
    return valid ? valid.point.y : null;
  }

  /**
   * Doble toque (< 300 ms) alterna el vuelo
   */
  registerFlyTap() {
    if (!this.active) return;
    const now = performance.now();
    if (now - this.lastFlyTap < 300) {
      this.setFlying(!this.flying);
      this.lastFlyTap = -Infinity;
    } else {
      this.lastFlyTap = now;
    }
  }

  setFlying(value) {
    if (this.flying === value) return;
    this.flying = value;
    this.vy = 0;
    if (!value) {
      const ground = this.getGroundBelow(this.camera.position.x, this.camera.position.z, this.camera.position.y);
      if (ground !== null) this.currentFloorElevation = ground;
    }
    this.onFlyChange?.(value);
  }

  /**
   * Primer suelo visible bajo (x, fromY, z), sin límite de altura; ignora hitboxes invisibles y vidrio
   */
  getGroundBelow(x, z, fromY) {
    this.downRay.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
    const far = this.downRay.far;
    this.downRay.far = fromY + 1;
    const hits = this.downRay.intersectObjects(this.walkableSurfaces, true);
    this.downRay.far = far;
    const valid = hits.find(h =>
      esSuelo(h) &&
      !h.object.name.includes('Glass') &&
      h.object.material?.visible !== false &&
      h.point.y >= -0.5
    );
    return valid ? valid.point.y : null;
  }

  /**
   * Mantiene la posición dentro de la carretera exterior; avisa (máx. 1 vez cada 3 s) al tocar el límite
   */
  clampToRoad(v) {
    const x = THREE.MathUtils.clamp(v.x, -WALK_LIMIT, WALK_LIMIT);
    const z = THREE.MathUtils.clamp(v.z, -WALK_LIMIT, WALK_LIMIT);
    if ((x !== v.x || z !== v.z) && performance.now() - this.lastBoundaryNotice > 3000) {
      this.lastBoundaryNotice = performance.now();
      this.onBoundary?.();
    }
    v.x = x;
    v.z = z;
    return v;
  }

  /**
   * Gira la mirada un ángulo determinado
   */
  turn(angleRad) {
    if (!this.active) return;
    this.yaw += angleRad;
    this.updateCameraRotation();
  }

  /**
   * Entra al modo Peatón / Street View
   */
  enterPedestrianMode(targetPos = null, lookAtTarget = null, { duration = 0.9, floorElevation = null, altura = null } = {}) {
    if (!this.active) {
      this.savedOrbit.position.copy(this.camera.position);
      this.savedOrbit.target.copy(this.orbitControls.target);
    }

    this.active = true;
    this.setFlying(false);
    this.orbitControls.enabled = false;

    // Destino: si no se especifica, por defecto en el Acceso Sur [0, 0, 75]
    const dest = targetPos ? targetPos.clone() : new THREE.Vector3(...spawnById('plataforma').pos);
    const groundY = floorElevation !== null
      ? floorElevation
      : (this.getGroundHeightAt(dest.x, dest.z) ?? 0);
    this.currentFloorElevation = groundY;
    const targetY = groundY + (altura ?? this.eyeHeight);

    // Orientar hacia el objetivo
    const lookDir = lookAtTarget
      ? lookAtTarget.clone().sub(new THREE.Vector3(dest.x, targetY, dest.z))
      : new THREE.Vector3(0, targetY, 0).sub(new THREE.Vector3(dest.x, targetY, dest.z));

    this.yaw = Math.atan2(-lookDir.x, -lookDir.z);
    this.pitch = lookAtTarget ? THREE.MathUtils.clamp(Math.atan2(lookDir.y, Math.hypot(lookDir.x, lookDir.z) || 1), -1.2, 1.2) : 0;   // cabecea hacia el foco

    gsap.killTweensOf(this.camera.position);
    if (duration <= 0) {
      this.camera.position.set(dest.x, targetY, dest.z);
      this.updateCameraRotation();
    } else {
      gsap.to(this.camera.position, {
        x: dest.x,
        y: targetY,
        z: dest.z,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          this.updateCameraRotation();
        },
        onComplete: () => {
          this.updateCameraRotation();
        }
      });
    }

    this.onModeChange?.(true);
  }

  /**
   * Sale del modo Street View y regresa a la vista orbital
   */
  exitPedestrianMode({ duration = 1.0 } = {}) {
    if (!this.active) return;
    this.setFlying(false);
    this.active = false;
    this.reticle.visible = false;
    this.keys = { forward: false, backward: false, left: false, right: false, shift: false, ctrl: false, space: false, turnLeft: false, turnRight: false };
    this.velocity.set(0, 0, 0);

    const returnPos = this.savedOrbit.position.y > 20
      ? this.savedOrbit.position
      : new THREE.Vector3(145, 150, 190);
    const returnTarget = this.savedOrbit.target.lengthSq() > 0
      ? this.savedOrbit.target
      : new THREE.Vector3(0, 0, -5);

    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.orbitControls.target);

    if (duration <= 0) {
      this.camera.position.copy(returnPos);
      this.camera.lookAt(returnTarget);
      this.orbitControls.target.copy(returnTarget);
      this.orbitControls.enabled = true;
      this.orbitControls.update();
    } else {
      gsap.to(this.camera.position, {
        x: returnPos.x,
        y: returnPos.y,
        z: returnPos.z,
        duration,
        ease: 'power3.inOut',
        onUpdate: () => {
          this.camera.lookAt(returnTarget);
        },
        onComplete: () => {
          this.orbitControls.target.copy(returnTarget);
          this.orbitControls.enabled = true;
          this.orbitControls.update();
        }
      });

      gsap.to(this.orbitControls.target, {
        x: returnTarget.x,
        y: returnTarget.y,
        z: returnTarget.z,
        duration,
        ease: 'power3.inOut'
      });
    }

    this.onModeChange?.(false);
  }

  /**
   * Teletransporta al usuario a un punto en el suelo con deslizamiento cinemático Street View
   */
  teleportTo(point, duration = 0.65) {
    if (!this.active) {
      this.enterPedestrianMode(point, null, { duration });
      return;
    }
    this.onMove?.();
    point = this.clampToRoad(point.clone());
    Object.assign(point, this.limitarTrayecto(point.x, point.z));   // no atraviesa muros ni aeronaves

    const groundY = this.getGroundHeightAt(point.x, point.z, this.currentFloorElevation) ?? point.y;
    this.currentFloorElevation = groundY;
    const targetY = groundY + this.eyeHeight;

    // Orientar mirada hacia la dirección de avance
    const dir = new THREE.Vector3(
      point.x - this.camera.position.x,
      0,
      point.z - this.camera.position.z
    );
    if (dir.lengthSq() > 1.5) {
      this.yaw = Math.atan2(-dir.x, -dir.z);
    }

    gsap.killTweensOf(this.camera.position);
    if (duration <= 0) {
      this.camera.position.set(point.x, targetY, point.z);
      this.updateCameraRotation();
    } else {
      gsap.to(this.camera.position, {
        x: point.x,
        y: targetY,
        z: point.z,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          this.updateCameraRotation();
        }
      });
    }
  }

  /**
   * Avanza un paso en la dirección actual de la mirada (Street View)
   */
  stepForward(distance = 5, { duration = 0.4 } = {}) {
    if (!this.active) return;
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    let targetX = this.camera.position.x + forwardX * distance;
    let targetZ = this.camera.position.z + forwardZ * distance;
    const bounded = this.clampToRoad({ x: targetX, z: targetZ }), lim = this.limitarTrayecto(bounded.x, bounded.z);
    targetX = lim.x;
    targetZ = lim.z;
    const groundY = this.getGroundHeightAt(targetX, targetZ, this.currentFloorElevation) ?? this.currentFloorElevation;
    this.currentFloorElevation = groundY;
    const targetY = groundY + this.eyeHeight;
    this.onMove?.();

    gsap.killTweensOf(this.camera.position);
    if (duration <= 0) {
      this.camera.position.set(targetX, targetY, targetZ);
      this.updateCameraRotation();
    } else {
      gsap.to(this.camera.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration,
        ease: 'power2.out',
        onUpdate: () => this.updateCameraRotation()
      });
    }
  }

  /**
   * Retrocede un paso en dirección opuesta a la mirada (Street View)
   */
  stepBackward(distance = 5, { duration = 0.4 } = {}) {
    this.stepForward(-distance, { duration });
  }

  /**
   * Teletransporta a un aula o ambiente arquitectónico interactivo directamente al interior
   */
  teleportToObject(object, { duration = 0.85 } = {}) {
    if (!object) return;
    this.setFlying(false);
    const data = object.userData || {};
    const floorLevel = data.floorLevel || 1;

    // Cambiar al nivel correspondiente para dejar el interior despejado
    if (this.onFloorChangeNeeded) {
      this.onFloorChangeNeeded(floorLevel);
    }

    object.updateWorldMatrix(true, true);
    const bbox = new THREE.Box3().setFromObject(object);
    const center = bbox.getCenter(new THREE.Vector3());

    const baseElev = levelBase(floorLevel);
    this.currentFloorLevel = floorLevel;
    this.currentFloorElevation = baseElev;

    let targetPos = new THREE.Vector3(center.x, baseElev + this.eyeHeight, center.z);
    let lookTarget = new THREE.Vector3(center.x, baseElev + this.eyeHeight, center.z - 5);

    // En un recinto se entra por su centro; ante una aeronave, por delante y mirándola.
    if (data.entrada) {
      targetPos.set(data.entrada[0], baseElev + this.eyeHeight, data.entrada[1]);
      lookTarget.set(center.x, baseElev + this.eyeHeight, center.z);
    }

    if (!this.active) {
      this.enterPedestrianMode(targetPos, lookTarget, { duration, floorElevation: baseElev });
    } else {
      const lookDir = lookTarget.clone().sub(targetPos);
      if (lookDir.lengthSq() > 0.1) {
        this.yaw = Math.atan2(-lookDir.x, -lookDir.z);
      }
      this.pitch = 0;

      gsap.killTweensOf(this.camera.position);
      if (duration <= 0) {
        this.camera.position.set(targetPos.x, targetPos.y, targetPos.z);
        this.updateCameraRotation();
      } else {
        gsap.to(this.camera.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration,
          ease: 'power2.out',
          onUpdate: () => {
            this.updateCameraRotation();
          }
        });
      }
    }
  }

  /**
   * Teletransporta a un lugar fijo (x, z, nivel) mirando hacia un punto; entra al modo si estaba inactivo
   */
  goToPlace({ position, look, floorLevel = null, y = null, altura = null, mirarY = null }, { duration = 0.85 } = {}) {
    this.setFlying(false);
    if (floorLevel !== null) this.onFloorChangeNeeded?.(floorLevel);
    const elevation = y ?? (floorLevel !== null ? levelBase(floorLevel) : (this.getGroundHeightAt(position.x, position.z) ?? 0));
    this.currentFloorLevel = floorLevel ?? 1;
    this.currentFloorElevation = elevation;
    const h = altura ?? this.eyeHeight, eyeY = elevation + h;
    const dest = new THREE.Vector3(position.x, elevation, position.z);
    const lookAt = new THREE.Vector3(look.x, mirarY ?? eyeY, look.z);

    if (!this.active) {
      this.enterPedestrianMode(dest, lookAt, { duration, floorElevation: elevation, altura: h });
      return;
    }
    this.onMove?.();
    this.yaw = Math.atan2(-(look.x - position.x), -(look.z - position.z));
    this.pitch = THREE.MathUtils.clamp(Math.atan2((mirarY ?? eyeY) - eyeY, Math.hypot(look.x - position.x, look.z - position.z) || 1), -1.2, 1.2);
    gsap.killTweensOf(this.camera.position);
    gsap.to(this.camera.position, {
      x: position.x, y: eyeY, z: position.z, duration, ease: 'power2.out',
      onUpdate: () => this.updateCameraRotation()
    });
  }

  /**
   * Actualiza la rotación de la cámara usando el orden Euler YXZ
   */
  updateCameraRotation() {
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  /**
   * Lee el mando (Xbox/estándar). Llamar cada cuadro, también con el modo inactivo.
   * Stick izq. = mover, stick der. = mirar, LB/L3 = correr, B = salir, Start = entrar/salir.
   */
  pollGamepad(delta = 0.016) {
    this.padMove.x = 0;
    this.padMove.y = 0;
    this.padSprint = false;
    this.padUp = false;
    this.padDown = false;
    const pad = typeof navigator !== 'undefined' && navigator.getGamepads
      ? [...navigator.getGamepads()].find(p => p && p.connected)
      : null;
    if (!pad) return;

    // Zona muerta + curva cuadrática: precisión con poco recorrido del stick, velocidad al fondo
    const dead = v => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * ((Math.abs(v) - 0.15) / 0.85) ** 2);
    const pressed = i => !!pad.buttons[i]?.pressed;
    const edge = i => pressed(i) && !this.padPrev[i];

    if (edge(9)) {
      if (this.active) this.exitPedestrianMode();
      else this.enterPedestrianMode();
    } else if (this.active) {
      // Select, cruceta ↑/↓, A y B: si el menú de lugares los usa (onPadButton → true), no salen del recorrido
      let consumed = false;
      for (const i of [8, 12, 13, 0, 1]) if (edge(i)) consumed = this.onPadButton?.(i) || consumed;
      if (edge(0) && !consumed) this.registerFlyTap(); // A dos veces: volar / aterrizar
      if (edge(1) && !consumed) this.exitPedestrianMode();
    }

    if (this.active) {
      this.padMove.x = dead(pad.axes[0] || 0);
      this.padMove.y = dead(pad.axes[1] || 0);
      this.padSprint = pressed(4) || pressed(10) || (pad.buttons[7]?.value ?? 0) > 0.5;
      this.padUp = pressed(0);   // A: subir (en vuelo)
      this.padDown = pressed(2); // X: bajar (en vuelo)
      this.yaw -= dead(pad.axes[2] || 0) * 2.5 * delta;
      this.pitch -= dead(pad.axes[3] || 0) * 1.8 * delta;
      this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
    }
    this.padPrev = pad.buttons.map(b => b.pressed);
  }

  /**
   * Actualización por cuadro en el bucle principal de renderizado
   */
  update(delta = 0.016) {
    if (!this.active) return;
    delta = Math.min(delta, 0.1); // una pestaña en segundo plano no debe dar saltos

    // Animación suave de pulsación del retículo
    if (this.reticle.visible) {
      const s = 1.0 + 0.06 * Math.sin(performance.now() * 0.006);
      this.reticle.scale.set(s, s, s);
    }

    // Movimiento fluido con teclado WASD / Flechas
    let moveZ = 0;
    let moveX = 0;
    if (this.keys.forward) moveZ -= 1;
    if (this.keys.backward) moveZ += 1;
    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;
    moveX += this.padMove.x;
    moveZ += this.padMove.y;
    // Q/E giran la vista con el teclado
    this.yaw += ((this.keys.turnLeft ? 1 : 0) - (this.keys.turnRight ? 1 : 0)) * 1.8 * delta;

    // Velocidad objetivo con inercia: arranca y frena suave en vez de en seco
    const len = Math.hypot(moveX, moveZ);
    const sprinting = this.keys.ctrl || this.padSprint || (this.keys.shift && !this.flying);
    const speed = sprinting ? this.sprintSpeed : this.walkSpeed;
    let tx = 0;
    let tz = 0;
    if (len > 0) {
      const k = (speed * Math.min(len, 1)) / len; // el stick suave camina más despacio
      this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      tx = (this._forward.x * -moveZ + this._right.x * moveX) * k;
      tz = (this._forward.z * -moveZ + this._right.z * moveX) * k;
    }
    const blend = 1 - Math.exp(-10 * delta);
    this.velocity.x += (tx - this.velocity.x) * blend;
    this.velocity.z += (tz - this.velocity.z) * blend;

    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.02) {
      this.onMove?.();
      this.mover(this.velocity.x * delta, this.velocity.z * delta);
      this.clampToRoad(this.camera.position); // desliza por el borde de la carretera
    }

    if (this.flying) {
      // Espacio / A suben, Shift / X bajan; sin entrada se queda flotando
      const up = (this.keys.space || this.padUp ? 1 : 0) - (this.keys.shift || this.padDown ? 1 : 0);
      const vTarget = up * (sprinting ? this.flySprintSpeed : this.flySpeed);
      this.vy += (vTarget - this.vy) * (1 - Math.exp(-10 * delta));
      if (Math.abs(this.vy) > 0.02) {
        this.onMove?.();
        this.camera.position.y = Math.min(this.camera.position.y + this.vy * delta, this.maxAltitude);
      }
      // Tocar el suelo (o un tejado) al bajar aterriza
      const ground = this.getGroundBelow(this.camera.position.x, this.camera.position.z, this.camera.position.y + 0.5);
      if (ground !== null && this.camera.position.y <= ground + this.eyeHeight) {
        this.camera.position.y = ground + this.eyeHeight;
        if (up < 0) this.setFlying(false);
      }
    } else if (Math.hypot(this.velocity.x, this.velocity.z) > 0.02) {
      // Adaptar altura al terreno o entrepiso
      const groundY = this.getGroundHeightAt(this.camera.position.x, this.camera.position.z, this.currentFloorElevation);
      if (groundY !== null) {
        this.currentFloorElevation = groundY;
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, groundY + this.eyeHeight, 1 - Math.exp(-14 * delta));
      }
    }

    this.updateCameraRotation();
  }
}
