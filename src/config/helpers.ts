import { prisma } from './db'

// Zona horaria fija de Sonora (UTC-7, sin cambio de horario)
const TZ = 'America/Hermosillo'

/**
 * Devuelve el día de hoy en minúsculas y sin acentos, en español.
 * Ej: 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
 */
export const diaHoyHermosillo = (): string =>
  new Date()
    .toLocaleDateString('es-MX', { weekday: 'long', timeZone: TZ })
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Construye el bloque `where` de Prisma para filtrar promociones activas
 * que apliquen hoy (por día de la semana y rango de fechas).
 */
export const promocionesActivasHoy = () => {
  const ahora  = new Date()
  const diaHoy = diaHoyHermosillo()

  return {
    activo: true as const,
    OR: [
      { solo_dia: null  as null },
      { solo_dia: diaHoy },
    ],
    AND: [
      { OR: [{ fecha_inicio: null as null }, { fecha_inicio: { lte: ahora } }] },
      { OR: [{ fecha_fin:    null as null }, { fecha_fin:    { gte: ahora } }] },
    ],
  }
}

/**
 * Resuelve el empleado_id (tabla empleados) a partir de un usuario_id
 * (tabla usuarios). Las FKs de orden_estados_historial, servicios,
 * movimientos_inventario y mermas apuntan a empleados, no a usuarios.
 */
export const getEmpleadoId = async (usuarioId?: number): Promise<number | null> => {
  if (!usuarioId) return null
  const usuario = await prisma.usuarios.findUnique({
    where:  { id: usuarioId },
    select: { empleado_id: true },
  })
  return usuario?.empleado_id ?? null
}
