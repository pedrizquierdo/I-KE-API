import { Request, Response } from 'express'
import { getUsuarios, getUsuarioById, actualizarUsuario, desactivarUsuario, buscarUsuarios, registrarEmpleado } from './users.service'
import { AppError } from '../../lib/AppError'

export const getUsuariosController = async (req: Request, res: Response) => {
  const { rol, activo } = req.query

  if (rol || activo !== undefined) {
    const filtros = {
      rol: rol as string | undefined,
      activo: activo === 'true' ? true : activo === 'false' ? false : undefined,
    }
    const usuarios = await buscarUsuarios(filtros)
    res.json(usuarios)
    return
  }

  const usuarios = await getUsuarios()
  res.json(usuarios)
}

export const getUsuarioByIdController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const usuario = await getUsuarioById(id)
  res.json(usuario)
}

export const actualizarUsuarioController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const { rol, activo, password, empleadoId } = req.body
  const usuario = await actualizarUsuario(id, { rol, activo, password, empleadoId })
  res.json(usuario)
}

export const registrarEmpleadoController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const { nombre, apellido, rol, telefono } = req.body
  if (!nombre || !apellido || !rol) throw new AppError(400, 'nombre, apellido y rol son obligatorios')
  const usuario = await registrarEmpleado(id, { nombre, apellido, rol, telefono })
  res.json(usuario)
}

export const desactivarUsuarioController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')

  if (req.usuario?.id === id) throw new AppError(400, 'No puedes desactivar tu propia cuenta')

  const usuario = await desactivarUsuario(id)
  res.json(usuario)
}
