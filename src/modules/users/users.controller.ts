import { Request, Response } from 'express'
import {
  getUsuarios,
  getUsuarioById,
  actualizarUsuario,
  desactivarUsuario,
  buscarUsuarios,
} from './users.service'

export const getUsuariosController = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
}

export const getUsuarioByIdController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }
    const usuario = await getUsuarioById(id)
    res.json(usuario)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al obtener usuario'
    res.status(404).json({ error: mensaje })
  }
}

export const actualizarUsuarioController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    const { rol, activo, password, empleadoId } = req.body
    const usuario = await actualizarUsuario(id, { rol, activo, password, empleadoId })
    res.json(usuario)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar usuario'
    res.status(400).json({ error: mensaje })
  }
}

export const desactivarUsuarioController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    // No permitir que el gerente se desactive a sí mismo
    if (req.usuario?.id === id) {
      res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' })
      return
    }

    const usuario = await desactivarUsuario(id)
    res.json(usuario)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al desactivar usuario'
    res.status(400).json({ error: mensaje })
  }
}