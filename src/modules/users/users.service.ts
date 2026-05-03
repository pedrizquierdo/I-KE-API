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
interface ActualizarUsuarioDTO {
  rol?: string
  activo?: boolean
  password?: string
  empleadoId?: number
  nombre?: string
  apellido?: string
}

export const actualizarUsuario = async (id: number, datos: ActualizarUsuarioDTO) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id },
    select: { id: true, empleado_id: true, email: true }
  })
  if (!usuario) throw new AppError(404, 'Usuario no encontrado')

  const dataUpdate: any = {}
  if (datos.rol      !== undefined) dataUpdate.rol      = datos.rol
  if (datos.activo   !== undefined) dataUpdate.activo   = datos.activo
  if (datos.empleadoId !== undefined) dataUpdate.empleado_id = datos.empleadoId
  if (datos.password) dataUpdate.password = await bcrypt.hash(datos.password, 12)

  // Si se cambia a rol de empleado (no cliente), garantizar que exista un registro en empleados
  if (datos.rol && datos.rol !== 'cliente') {
    if (!usuario.empleado_id) {
      const nombreBase = usuario.email.split('@')[0] ?? 'Empleado'
      const nuevoEmpleado = await prisma.empleados.create({
        data: {
          nombre:   datos.nombre   ?? nombreBase,
          apellido: datos.apellido ?? '',
          rol:      datos.rol,
          activo:   true,
        }
      })
      dataUpdate.empleado_id = nuevoEmpleado.id
    } else {
      // Ya tiene empleado — sincronizar el rol
      await prisma.empleados.update({
        where: { id: usuario.empleado_id },
        data: { rol: datos.rol }
      })
    }
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

// ─── Registrar / actualizar empleado vinculado a un usuario ──────────────────
export const registrarEmpleado = async (
  usuarioId: number,
  datos: { nombre: string; apellido: string; rol: string; telefono?: string }
) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { id: true, empleado_id: true }
  })
  if (!usuario) throw new AppError(404, 'Usuario no encontrado')

  if (usuario.empleado_id) {
    await prisma.empleados.update({
      where: { id: usuario.empleado_id },
      data: {
        nombre:   datos.nombre,
        apellido: datos.apellido,
        rol:      datos.rol,
        telefono: datos.telefono ?? null,
      }
    })
  } else {
    const empleado = await prisma.empleados.create({
      data: {
        nombre:   datos.nombre,
        apellido: datos.apellido,
        rol:      datos.rol,
        telefono: datos.telefono ?? null,
        activo:   true,
      }
    })
    await prisma.usuarios.update({
      where: { id: usuarioId },
      data: { empleado_id: empleado.id }
    })
  }

  return await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: {
      id: true, email: true, rol: true, activo: true,
      empleados: { select: { id: true, nombre: true, apellido: true, rol: true, telefono: true } }
    }
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
