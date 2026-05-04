import { prisma } from './db'

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
