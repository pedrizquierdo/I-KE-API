import { prisma } from '../../config/db'

// ─── Abrir servicio del día ───────────────────────────────────────────────────
export const abrirServicio = async (empleadoId?: number) => {
  // Verificar que no haya un servicio abierto
  const servicioActivo = await prisma.servicios.findFirst({
    where: { estado: 'abierto' }
  })

  if (servicioActivo) {
    throw new Error('Ya hay un servicio abierto')
  }

  return await prisma.servicios.create({
    data: {
      ubicacion_id: 1, // I KE TACOS BIRRIA
      empleado_id: empleadoId ?? null,
      estado: 'abierto',
    }
  })
}

// ─── Cerrar servicio activo ───────────────────────────────────────────────────
export const cerrarServicio = async () => {
  const servicio = await prisma.servicios.findFirst({
    where: { estado: 'abierto' }
  })

  if (!servicio) {
    throw new Error('No hay ningún servicio abierto')
  }

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
  const servicio = await prisma.servicios.findFirst({
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

  return servicio
}