// Puente entre las medidas (medidas.js, bloques.js, predio.js: única fuente) y los módulos del visor: niveles, alturas, implantación y textos.
import { PARAMS } from '../medidas.js';
import { layoutPredio } from '../predio.js';

export const FLOOR_HEIGHT = PARAMS.altPiso2;   // piso a piso del bloque de formación y administración
export const LEVELS = 2;                       // 1: hangar y bloques · 2: administración
export const LOW_LEVELS = 1;                   // bloque de apoyo y áreas técnicas (un piso)
export const EXPLODE_STEP = 14;                // separación entre niveles en la vista explotada

export const levelBase = level => (level - 1) * FLOOR_HEIGHT;
export const levelTop = level => level * FLOOR_HEIGHT;

const L = layoutPredio(), H = L.hangar, r = PARAMS.retiro;
const xEd = r + (L.ancho - 2 * r - L.edificios.ancho) / 2, zEd = r + L.franjaTrasera.fondo;

// Implantación en coordenadas de planta (x ancho, z fondo desde el lindero posterior). Para el mundo: x + ox, z + oz (predio centrado).
export const SITIO = Object.freeze({
  L, H, PL: L.plataforma, ox: -L.ancho / 2, oz: -L.fondo / 2,
  xEd, xH: xEd + L.anchoIzq, xD: xEd + L.anchoIzq + H.ancho, zEd, zFr: zEd + H.fondo, zPlat: zEd + H.fondo + L.plataforma.fondo,
  D: H.fondo,
});
export const mundo = (x, z) => ({ x: x + SITIO.ox, z: z + SITIO.oz });
export const WALK_LIMIT = Math.max(L.ancho, L.fondo) / 2 + 6;

// Zona, etiqueta y texto de cada tipo de recinto (tarjetas, buscador y recorrido).
const k = (zone, label, description) => ({ zone, label, description });
export const KIND_INFO = Object.freeze({
  hangar: k('Hangar', 'Hangar de instrucción', 'Las cuatro aeronaves de instrucción, cada una con su franja SMS de 3 m y su carril recto hasta el portón: cualquiera sale sola, o varias, sin mover las demás. Taller de conformado contra el muro posterior, puertas peatonales y salidas de emergencia.'),
  aeronave: k('Hangar', 'Aeronave de instrucción', 'Aeronave a escala real dentro de su franja SMS.'),
  taller: k('Hangar', 'Taller de conformado', 'Dobladoras, prensas y banco de prueba de motor para prácticas de taller. Ubicación referencial.'),
  plataforma: k('Plataforma', 'Plataforma y pista de rodaje', 'Una sola pista de rodaje frente al portón, por donde salen y se estacionan las aeronaves, con calle de servicio para remolcador y tractor y cono de viento. Afuera no hay franjas SMS.'),
  aula: k('Formación', 'Ambiente de formación', 'Ambiente convencional para 25 aprendices, con televisor y tablero. Sin vista al hangar.'),
  informatica: k('Formación', 'Sala de informática', 'Sala con 25 puestos de cómputo.'),
  multiple: k('Formación', 'Aula múltiple', 'Aula para grupos grandes y eventos de formación, con tarima y pantalla.'),
  'lab-electricidad': k('Formación', 'Laboratorio de electricidad', 'Bancos de trabajo con instrumentos y tableros eléctricos para 25 aprendices.'),
  'lab-avionica': k('Formación', 'Laboratorio de aviónica', 'Bancos con racks de equipos y pantallas para 25 aprendices.'),
  'lab-instrumentos': k('Formación', 'Laboratorio de instrumentos', 'Paneles de instrumentos de a bordo y bancos de calibración.'),
  'lab-hidraulica': k('Formación', 'Laboratorio de hidráulica y neumática', 'Banco didáctico con tanques, bombas y tuberías.'),
  'lab-compuestos': k('Formación', 'Laboratorio de materiales compuestos', 'Mesas de laminado, horno de curado y campana de extracción.'),
  banos: k('Servicios', 'Baños', 'Baterías sanitarias con cubículos y lavamanos.'),
  recepcion: k('Administración', 'Recepción y espera', 'Mostrador de atención y sala de espera.'),
  direccion: k('Administración', 'Dirección', 'Despacho de la dirección, con vista al hangar.'),
  coordinacion: k('Administración', 'Coordinación', 'Oficina de coordinación con seis puestos.'),
  juntas: k('Administración', 'Sala de juntas', 'Sala de reuniones para 14 personas, con vista al hangar.'),
  archivo: k('Administración', 'Archivo', 'Archivo documental con estantería rodante.'),
  cafetin: k('Administración', 'Cafetín', 'Zona de descanso del personal administrativo.'),
  oficina: k('Administración', 'Oficina abierta', 'Oficina abierta con 21 puestos de trabajo.'),
  admin: k('Administración', 'Administración', 'Oficinas en el segundo piso. Las del extremo occidental miran al interior del hangar a través de un ventanal; desde los ambientes de formación no hay esa vista.'),
  'equipos-tierra': k('Áreas técnicas', 'Equipos de tierra', 'Remolcador, tractor, plataformas de trabajo y gatos hidráulicos, con portón directo al hangar.'),
  almacen: k('Áreas técnicas', 'Almacén aeronáutico', 'Almacén de repuestos y herramienta con mostrador y puerta al hangar.'),
  cuarentena: k('Áreas técnicas', 'Zona cero · cuarentena de componentes', 'Área enjaulada para componentes no conformes o pendientes de inspección, con puerta al hangar.'),
  bombas: k('Áreas técnicas', 'Cuarto de bombas y compresores', 'Aire comprimido y bombeo para el hangar.'),
  enfermeria: k('Apoyo y bienestar', 'Enfermería', 'Camilla, escritorio y botiquín.'),
  instructores: k('Apoyo y bienestar', 'Sala de instructores', 'Puestos de trabajo y lockers para los instructores.'),
  cafeteria: k('Apoyo y bienestar', 'Cafetería', 'Cafetería para 150 personas por turno, dos turnos.'),
  biblioteca: k('Apoyo y bienestar', 'Biblioteca', 'Estanterías, mesas de lectura y terminales de consulta.'),
  aseo: k('Apoyo y bienestar', 'Cuarto de aseo', 'Insumos y poceta de aseo.'),
  nucleo: k('Circulación', 'Escaleras y ascensor', 'Núcleo de circulación vertical: escalera de dos tramos y ascensor de vidrio entre los pisos 1 y 2.'),
});
export const kindInfo = tipo => KIND_INFO[tipo] ?? KIND_INFO.aula;
