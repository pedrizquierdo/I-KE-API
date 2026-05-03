import { prisma } from '../../config/db'
import { AppError } from '../../lib/AppError'

// ─── Abrir servicio del día ───────────────────────────────────────────────────
export const abrirServicio = async (usuarioId?: number) => {
  const servicioActivo = await prisma.servicios.findFirst({
    where: { estado: 'abierto' }
  })

  if (servicioActivo) throw new AppError(409, 'Ya hay un servicio abierto')

  // Resolver el empleado_id real desde el usuario autenticado
  let empleadoId: number | null = null
  if (usuarioId) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      select: { empleado_id: true }
    })
    empleadoId = usuario?.empleado_id ?? null
  }

  return await prisma.servicios.create({
    data: {
      ubicacion_id: 1, // I KE TACOS BIRRIA
      empleado_id:  empleadoId,
      estado:       'abierto',
    }
  })
}

// ─── Cerrar servicio activo ───────────────────────────────────────────────────
export const cerrarServicio = async () => {
  const servicio = await prisma.servicios.findFirst({
    where: { estado: 'abierto' }
  })

  if (!servicio) throw new AppError(404, 'No hay ningún servicio abierto')

  return await prisma.servicios.update({
    where: { id: servicio.id },
    data: {
      estado: 'cerrado',
      fecha_fin: new Date(),
    }
  })
}

// ─── Obtener servicio activo ──────────────────────────────────────────────────
export const getServicioActivo = async () => {
  return await prisma.servicios.findFirst({
    where: { estado: 'abierto' },
    include: {
      ubicaciones: {
        select: { id: true, nombre: true, direccion: true }
      },
      empleados: {
        select: { id: true, nombre: true, apellido: true }
      }
    }
  })
}
