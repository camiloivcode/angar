// Única fuente de medidas (metros). El render solo lee de aquí; nada de cifras en la escena.
// Planta del hangar: x = ancho (izq→der, mirando al hangar desde la plataforma), z = fondo desde el muro posterior (z=0) hacia el portón.

const A = {
  tc685: { nombre: 'Turbo Commander 685', tipo: 'A', largo: 13.10, ancho: 14.19, alto: 4.56, pax: 8, vacio: 2731, pmt: 4082, cargaUtil: 1373, combustible: 946, superficie: 24.7 },
  bell206: { nombre: 'Bell 206B Ranger II', tipo: 'H', zona: 'circulo', largo: 11.82, ancho: 10.16, alto: 2.83, pax: 5, vacio: 1057, pmt: 1451, cargaUtil: 676, combustible: 344, superficie: 81.1 }, // largo con rotores girando (9,50 = solo fuselaje); ancho = diámetro del rotor; superficie = disco del rotor
  c206: { nombre: 'Cessna 206', tipo: 'A', largo: 8.61, ancho: 10.97, alto: 2.83, pax: 6, vacio: 987, pmt: 1633, cargaUtil: 654, combustible: 331, superficie: 16.17 },
  c210: { nombre: 'Cessna 210', tipo: 'A', largo: 8.59, ancho: 11.20, alto: 2.95, pax: 6, vacio: 1045, pmt: 1814, cargaUtil: 769, combustible: 341, superficie: 16.3 },
};
export const AERONAVES = Object.fromEntries(Object.entries(A).map(([id, a]) => [id, { id, ...a }]));
export const ORDEN = ['tc685', 'bell206', 'c206', 'c210'];   // de izquierda a derecha frente al portón

// Equipos de apoyo. Medidas APROXIMADAS (las fichas técnicas no se pudieron consultar): confirmar con el proveedor.
// Del remolcador AeroTow T2 solo se verificó: largo 3,43 m con la manija extendida, peso 227 kg y capacidad de remolque de 6.800 kg.
export const EQUIPOS = {
  remolcador: { nombre: 'Remolcador AeroTow T2', largo: 3.43, ancho: 0.9, alto: 1.0, capacidadKg: 6800, verificado: true },
  tractor: { nombre: 'Tractor de remolque', largo: 3.0, ancho: 1.5, alto: 1.6 },
  gato: { nombre: 'Gato hidráulico (trípode)', largo: 1.2, ancho: 1.2, alto: 2.0 },
  plataforma: { nombre: 'Plataforma de trabajo', largo: 2.5, ancho: 1.2, alto: 2.4 },
  bancoMotor: { nombre: 'Banco de prueba de motor', largo: 4.0, ancho: 2.0, alto: 2.5 },
  conoViento: { nombre: 'Cono de viento', alto: 6.0 },
};

// Perillas calibrables: ajustar con RAC 147 / criterio del cliente, no con el código.
export const PARAMS = {
  franjaSMS: 3.0,          // perímetro de seguridad pintado alrededor de cada aeronave
  pasilloSMS: 3.0,         // pasillo libre entre franjas vecinas y entre franja y muro
  pilaHojas: 4.5,          // hojas corredizas apiladas en cada extremo del portón
  holguraJamba: 1.5,       // holgura entre la punta de ala y la jamba al salir
  carrilServicio: 6.0,     // calle de servicio de la plataforma (remolcador y tractor)
  holguraAltura: 1.5, fondoTaller: 6.0,
  altPiso2: 3.8, antepecho: 1.0, altVentanal: 2.0,
  bandera: { ancho: 3, alto: 2, separacion: 1, bordeInferior: 5.5 },
  // bloques de formación y apoyo
  profCrujia: 9.0, corredor: 2.5, nucleoAncho: 7.0,
  m2Persona: { aula: 2.0, informatica: 2.4, laboratorio: 3.0, multiple: 1.2, cafeteria: 1.4 },
  aprendices: 300, personalOficinaSimultaneo: 150, aforoEvacuacion: 1800,
  andenPeatonal: 6, retiro: 5, parqueoPuestos: 60, parqueoM2Puesto: 25,
};

export const redondea = (v, paso = 1) => Math.ceil(v / paso - 1e-9) * paso;

/** Zona SMS de una aeronave: rectángulo (huella + franja) o, para el helicóptero, círculo (largo total con rotores + franja). */
export function zonaSMS(a, p = PARAMS) {
  const f = p.franjaSMS;
  return a.zona === 'circulo'
    ? { tipo: 'circulo', r0: a.largo / 2, r1: a.largo / 2 + f, ancho: a.largo + 2 * f, fondo: a.largo + 2 * f }
    : { tipo: 'rect', ancho: a.ancho + 2 * f, fondo: a.largo + 2 * f };
}

/**
 * Hangar de una sola fila frente al portón: cada aeronave sale en línea recta, sola o con otras, sin mover las demás.
 * Cada una lleva su zona SMS (franja de 3 m), pasillos de 3 m entre zonas y hacia los muros, y el taller contra el muro posterior.
 */
export function layoutHangar(p = PARAMS, I = AERONAVES) {
  const zs = ORDEN.map(id => ({ a: I[id], z: zonaSMS(I[id], p) }));
  const anchoFila = zs.reduce((s, q) => s + q.z.ancho, 0) + p.pasilloSMS * (zs.length - 1);
  const ancho = redondea(anchoFila + 2 * p.pasilloSMS);
  const profZona = Math.max(...zs.map(q => q.z.fondo));
  const fondo = redondea(p.fondoTaller + p.pasilloSMS + profZona + p.pasilloSMS);
  const zBack = p.fondoTaller + p.pasilloSMS;   // borde posterior de las zonas
  let x = (ancho - anchoFila) / 2;
  const aeronaves = zs.map(({ a, z }) => {
    const q = { ...a, zona: z, tipoZona: z.tipo, x: x + z.ancho / 2, z: zBack + z.fondo / 2 };
    x += z.ancho + p.pasilloSMS;
    // carril de salida: franja recta de la envergadura de la aeronave, desde su cola hasta el portón y más allá
    q.carril = { x0: q.x - a.ancho / 2, x1: q.x + a.ancho / 2, z0: q.z - a.largo / 2 };
    return q;
  });
  const b = p.bandera, ventanalSup = p.altPiso2 + p.antepecho + p.altVentanal;
  const alturaLibre = redondea(Math.max(I.tc685.alto + p.holguraAltura, ventanalSup + 0.5, b.bordeInferior + b.alto + 0.5), 0.5);
  const puerta = { ancho: ancho - 2 * p.pilaHojas, alto: redondea(I.tc685.alto + p.holguraAltura, 0.5), x0: p.pilaHojas };
  return {
    ancho, fondo, alturaLibre, puerta, aeronaves, area: ancho * fondo, zBack, profZona,
    taller: { x: 0, z: 0, ancho, fondo: p.fondoTaller },
    ventanal: { inf: p.altPiso2 + p.antepecho, sup: ventanalSup },
    banderas: { y0: b.bordeInferior, y1: b.bordeInferior + b.alto, ancho: b.ancho, separacion: b.separacion },
  };
}

/** Plataforma frente al portón: un puesto exterior por aeronave (cualquiera, o todas, pueden estar afuera) y la calle de servicio. */
export function layoutPlataforma(h = layoutHangar(), p = PARAMS) {
  const puestos = h.aeronaves.map(a => ({ id: a.id, x: a.x, z: h.fondo + p.pasilloSMS + a.zona.fondo / 2, zona: a.zona }));
  const tc = h.aeronaves.find(a => a.id === 'tc685');
  const giro = Math.hypot(tc.ancho, tc.largo) + 2 * p.franjaSMS;     // círculo de giro del avión mayor con su franja
  const fondo = redondea(Math.max(p.pasilloSMS + h.profZona + p.carrilServicio, giro));
  return { ancho: h.ancho + 6, fondo, puestos, giro, servicioZ: h.fondo + p.pasilloSMS + h.profZona, conoViento: { x: h.ancho + 1.5, z: h.fondo + fondo - 2 } };
}
