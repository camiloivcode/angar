import { PARAMS, layoutHangar, layoutPlataforma } from './medidas.js';
import { bloqueFormacion, bloqueAdmin } from './bloques.js';

/** Predio mínimo: bloques + hangar (en línea), plataforma al frente, reserva para un 2º hangar, parqueo y retiros. El 2º piso no ocupa terreno. */
export function layoutPredio(p = PARAMS) {
  const hangar = layoutHangar(p), plataforma = layoutPlataforma(hangar, p);
  const izq = bloqueFormacion(hangar.fondo, p), der = bloqueAdmin(hangar.fondo, p);   // izquierda: formación (1 piso) · derecha: administración (2 pisos)
  const edificios = { ancho: izq.W + hangar.ancho + der.W, fondo: hangar.fondo };
  const parqueo = { m2: p.parqueoPuestos * p.parqueoM2Puesto, ancho: Math.max(der.W, Math.ceil(p.parqueoPuestos / 4) * 2.5) };   // 4 filas de plazas de 2,5 m
  const expansion = { ancho: hangar.ancho, fondo: hangar.fondo };            // reserva para un 2º hangar igual al primero
  const franjaTrasera = { fondo: hangar.fondo, ancho: izq.W + expansion.ancho + parqueo.ancho };   // detrás: motos (formación), reserva (hangar) y parqueo (administración)
  const ancho = Math.max(edificios.ancho, franjaTrasera.ancho) + 2 * p.retiro;
  const fondo = p.retiro + franjaTrasera.fondo + edificios.fondo + plataforma.fondo + p.retiro;
  const neto = (b, i) => b.pisos[i].netoTotal;
  return { hangar, plataforma, izq, der, anchoIzq: izq.W, anchoDer: der.W, edificios, expansion, parqueo, franjaTrasera, ancho, fondo, area: ancho * fondo,
    areas: { formacion: neto(izq, 0), admin: neto(der, 1), apoyo: neto(der, 0) } };
}
