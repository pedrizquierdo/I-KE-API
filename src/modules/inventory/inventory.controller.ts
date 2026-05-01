import { Request, Response } from 'express'
import {
  getIngredientes, getAlertasStock, crearIngrediente, actualizarIngrediente,
  desactivarIngrediente, registrarMovimiento, getMovimientos, getUnidadesMedida,
  getRecetasByProducto, crearReceta, actualizarReceta, eliminarReceta,
} from './inventory.service'
import { AppError } from '../../lib/AppError'

export const getIngredientesController = async (_req: Request, res: Response) => {
  const ingredientes = await getIngredientes()
  res.json(ingredientes)
}

export const getAlertasStockController = async (_req: Request, res: Response) => {
  const alertas = await getAlertasStock()
  res.json(alertas)
}

export const crearIngredienteController = async (req: Request, res: Response) => {
  const { nombre, unidadMedidaId, stockActual, stockMinimo, stockMaximo, costoUnitario, proveedor } = req.body
  const ingrediente = await crearIngrediente({ nombre, unidadMedidaId, stockActual, stockMinimo, stockMaximo, costoUnitario, proveedor })
  res.status(201).json(ingrediente)
}

export const actualizarIngredienteController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const ingrediente = await actualizarIngrediente(id, req.body)
  res.json(ingrediente)
}

export const desactivarIngredienteController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const ingrediente = await desactivarIngrediente(id)
  res.json(ingrediente)
}

export const registrarMovimientoController = async (req: Request, res: Response) => {
  const { ingredienteId, tipo, cantidad, motivo } = req.body
  const movimiento = await registrarMovimiento({
    ingredienteId, tipo, cantidad, motivo, empleadoId: req.usuario?.id,
  })
  res.status(201).json(movimiento)
}

export const getMovimientosController = async (req: Request, res: Response) => {
  const ingredienteId = req.query['ingredienteId']
    ? parseInt(req.query['ingredienteId'] as string)
    : undefined
  const page  = req.query['page']  ? parseInt(req.query['page']  as string) : undefined
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined
  const result = await getMovimientos(ingredienteId, { page, limit })
  res.json(result)
}

export const getUnidadesMedidaController = async (_req: Request, res: Response) => {
  const unidades = await getUnidadesMedida()
  res.json(unidades)
}

export const getRecetasByProductoController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const recetas = await getRecetasByProducto(id)
  res.json(recetas)
}

export const crearRecetaController = async (req: Request, res: Response) => {
  const { productoId, ingredienteId, cantidad } = req.body
  const receta = await crearReceta(productoId, ingredienteId, cantidad)
  res.status(201).json(receta)
}

export const actualizarRecetaController = async (req: Request, res: Response) => {
  const productoId    = parseInt(req.params['productoId'] as string)
  const ingredienteId = parseInt(req.params['ingredienteId'] as string)
  if (isNaN(productoId) || isNaN(ingredienteId)) throw new AppError(400, 'IDs inválidos')
  const { cantidad } = req.body
  if (typeof cantidad !== 'number' || cantidad <= 0)
    throw new AppError(400, 'cantidad debe ser un número mayor a 0')
  const receta = await actualizarReceta(productoId, ingredienteId, cantidad)
  res.json(receta)
}

export const eliminarRecetaController = async (req: Request, res: Response) => {
  const productoId    = parseInt(req.params['productoId'] as string)
  const ingredienteId = parseInt(req.params['ingredienteId'] as string)
  if (isNaN(productoId) || isNaN(ingredienteId)) throw new AppError(400, 'IDs inválidos')
  await eliminarReceta(productoId, ingredienteId)
  res.status(204).send()
}
