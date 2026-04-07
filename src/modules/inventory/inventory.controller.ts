import { Request, Response } from 'express'
import {
  getIngredientes,
  getAlertasStock,
  crearIngrediente,
  actualizarIngrediente,
  registrarMovimiento,
  getMovimientos,
  getUnidadesMedida,
  getRecetasByProducto,
  crearReceta,
} from './inventory.service'

export const getIngredientesController = async (_req: Request, res: Response) => {
  try {
    const ingredientes = await getIngredientes()
    res.json(ingredientes)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ingredientes' })
  }
}

export const getAlertasStockController = async (_req: Request, res: Response) => {
  try {
    const alertas = await getAlertasStock()
    res.json(alertas)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener alertas' })
  }
}

export const crearIngredienteController = async (req: Request, res: Response) => {
  try {
    const { nombre, unidadMedidaId, stockActual, stockMinimo, stockMaximo, costoUnitario, proveedor } = req.body
    if (!nombre || !unidadMedidaId) {
      res.status(400).json({ error: 'nombre y unidadMedidaId son requeridos' })
      return
    }
    const ingrediente = await crearIngrediente({
      nombre, unidadMedidaId, stockActual, stockMinimo, stockMaximo, costoUnitario, proveedor
    })
    res.status(201).json(ingrediente)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear ingrediente'
    res.status(400).json({ error: mensaje })
  }
}

export const actualizarIngredienteController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const ingrediente = await actualizarIngrediente(id, req.body)
    res.json(ingrediente)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar ingrediente'
    res.status(400).json({ error: mensaje })
  }
}

export const registrarMovimientoController = async (req: Request, res: Response) => {
  try {
    const { ingredienteId, tipo, cantidad, motivo } = req.body
    if (!ingredienteId || !tipo || !cantidad) {
      res.status(400).json({ error: 'ingredienteId, tipo y cantidad son requeridos' })
      return
    }
    const movimiento = await registrarMovimiento({
      ingredienteId,
      tipo,
      cantidad,
      motivo,
      empleadoId: req.usuario?.id,
    })
    res.status(201).json(movimiento)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al registrar movimiento'
    res.status(400).json({ error: mensaje })
  }
}

export const getMovimientosController = async (req: Request, res: Response) => {
  try {
    const ingredienteId = req.query['ingredienteId']
      ? parseInt(req.query['ingredienteId'] as string)
      : undefined
    const movimientos = await getMovimientos(ingredienteId)
    res.json(movimientos)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movimientos' })
  }
}

export const getUnidadesMedidaController = async (_req: Request, res: Response) => {
  try {
    const unidades = await getUnidadesMedida()
    res.json(unidades)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener unidades de medida' })
  }
}

export const getRecetasByProductoController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const recetas = await getRecetasByProducto(id)
    res.json(recetas)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recetas' })
  }
}

export const crearRecetaController = async (req: Request, res: Response) => {
  try {
    const { productoId, ingredienteId, cantidad } = req.body
    if (!productoId || !ingredienteId || !cantidad) {
      res.status(400).json({ error: 'productoId, ingredienteId y cantidad son requeridos' })
      return
    }
    const receta = await crearReceta(productoId, ingredienteId, cantidad)
    res.status(201).json(receta)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear receta'
    res.status(400).json({ error: mensaje })
  }
}