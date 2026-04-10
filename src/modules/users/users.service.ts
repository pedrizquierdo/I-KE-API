import { prisma } from '../../config/db'
import bcrypt from 'bcryptjs'
import { AppError } from '../../lib/AppError'

// ─── Obtener todos los usuarios ───────────────────────────────────────────────
export const getUsuarios = async () => {
  return await prisma.usuarios.findMany({
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      creado_en: true,
      empleados: {
        select: { id: true, nombre: true, apellido: true, rol: true }
      }
    },
    orderBy: { creado_en: 'desc' }
  })
}

// ─── Obtener usuario por ID ───────────────────────────────────────────────────
export const getUsuarioById = async (id: number) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      creado_en: true,
      empleados: {
        select: { id: true, nombre: true, apellido: true, rol: true }
      }
    }
  })

  if (!usuario) throw new AppError(404, 'Usuario no encontrado')
  return usuario
}

// ─── Actualizar usuario ───────────────────────────────────────────────────────
export const actualizarUsuario = async (
  id: number,
  datos: { rol?: string; activo?: boolean; password?: string; empleadoId?: number }
) => {
  const usuario = await prisma.usuarios.findUnique({ where: { id } })
  if (!usuario) throw new AppError(404, 'Usuario no encontrado')

  const dataUpdate: any = {}
  if (datos.rol !== undefined) dataUpdate.rol = datos.rol
  if (datos.activo !== undefined) dataUpdate.activo = datos.activo
  if (datos.empleadoId !== undefined) dataUpdate.empleado_id = datos.empleadoId
  if (datos.password) {
    dataUpdate.password = await bcrypt.hash(datos.password, 12)
  }

  return await prisma.usuarios.update({
    where: { id },
    data: dataUpdate,
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      empleados: {
        select: { id: true, nombre: true, apellido: true }
      }
    }
  })
}

// ─── Desactivar usuario (soft delete) ────────────────────────────────────────
export const desactivarUsuario = async (id: number) => {
  const usuario = await prisma.usuarios.findUnique({ where: { id } })
  if (!usuario) throw new AppError(404, 'Usuario no encontrado')

  return await prisma.usuarios.update({
    where: { id },
    data: { activo: false },
    select: { id: true, email: true, activo: true }
  })
}

// ─── Buscar usuarios ──────────────────────────────────────────────────────────
export const buscarUsuarios = async (filtros: { rol?: string; activo?: boolean }) => {
  return await prisma.usuarios.findMany({
    where: {
      rol: filtros.rol ?? undefined,
      activo: filtros.activo ?? undefined,
    },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      creado_en: true,
      empleados: {
        select: { id: true, nombre: true, apellido: true }
      }
    },
    orderBy: { creado_en: 'desc' }
  })
}
