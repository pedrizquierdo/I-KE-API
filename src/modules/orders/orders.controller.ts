import { Request, Response } from 'express'
import { crearOrden, getOrdenes, getOrdenById, cambiarEstadoOrden, getOrdenesByUsuario, getOrdenesDelivery, editarItemsOrden } from './orders.service'
import { AppError } from '../../lib/AppError'
import { getIo } from '../../lib/socket'

export const crearOrdenController = async (req: Request, res: Response) => {
  const { tipoServicio, productos, combos, notas, nombreCliente, direccionEntrega, telefonoCliente } = req.body
  const orden = await crearOrden(
    { tipoServicio, productos, combos, notas, nombreCliente, direccionEntrega, telefonoCliente },
    req.usuario?.id,
  )

  // Notificar a la pantalla de cocina vía WebSocket
  getIo().to('cocina').emit('orden:nueva', { id: orden.id, estado: orden.estado, orden })

  res.status(201).json(orden)
}

export const getOrdenesController = async (req: Request, res: Response) => {
  const page  = req.query['page']  ? parseInt(req.query['page']  as string) : undefined
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined
  const result = await getOrdenes({ page, limit })
  res.json(result)
}

export const getOrdenByIdController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const orden = await getOrdenById(id)
  res.json(orden)
}

export const editarItemsOrdenController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')

  const { productos, combos } = req.body
  const orden = await editarItemsOrden(id, { productos, combos }, req.usuario?.id)

  // Notificar a cocina: la orden cambió su composición
  getIo().to('cocina').emit('orden:items_actualizados', { id: orden.id, estado: orden.estado, orden })

  res.json(orden)
}

export const cambiarEstadoOrdenController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')

  const { estado } = req.body
  const orden = await cambiarEstadoOrden(id, estado, req.usuario?.id)

  // Notificar cambio de estado en tiempo real a la pantalla de cocina
  getIo().to('cocina').emit('orden:estado', { id: orden.id, estado: orden.estado, orden })

  res.json(orden)
}

export const getOrdenesDeliveryController = async (req: Request, res: Response) => {
  const page  = req.query['page']  ? parseInt(req.query['page']  as string) : undefined
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined
  const result = await getOrdenesDelivery({ page, limit })
  res.json(result)
}

export const getOrdenesByUsuarioController = async (req: Request, res: Response) => {
  const usuarioId = req.usuario?.id
  if (!usuarioId) throw new AppError(401, 'No autenticado')

  const page  = req.query['page']  ? parseInt(req.query['page']  as string) : undefined
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined
  const result = await getOrdenesByUsuario(usuarioId, { page, limit })
  res.json(result)
}
