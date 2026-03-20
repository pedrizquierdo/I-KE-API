import { Request, Response } from 'express'
import { crearOrden, getOrdenes, getOrdenById, cambiarEstadoOrden } from './orders.service'

export const crearOrdenController = async (req: Request, res: Response) => {
  try {
    const { productos, combos, notas, nombreCliente } = req.body

    if ((!productos || productos.length === 0) && (!combos || combos.length === 0)) {
      res.status(400).json({ error: 'La orden debe tener al menos un producto o combo' })
      return
    }

    const orden = await crearOrden(
      { productos, combos, notas, nombreCliente },
      req.usuario?.id
    )

    res.status(201).json(orden)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear orden'
    res.status(400).json({ error: mensaje })
  }
}

export const getOrdenesController = async (_req: Request, res: Response) => {
  try {
    const ordenes = await getOrdenes()
    res.json(ordenes)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes' })
  }
}

export const getOrdenByIdController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    const orden = await getOrdenById(id)

    if (!orden) {
      res.status(404).json({ error: 'Orden no encontrada' })
      return
    }

    res.json(orden)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden' })
  }
}

export const cambiarEstadoOrdenController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    const { estado } = req.body

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    if (!estado) {
      res.status(400).json({ error: 'El estado es requerido' })
      return
    }

    const orden = await cambiarEstadoOrden(id, estado, req.usuario?.id)
    res.json(orden)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al cambiar estado'
    res.status(400).json({ error: mensaje })
  }
}