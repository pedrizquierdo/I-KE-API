import { Request, Response } from 'express'
import {
  procesarPago,
  getMetodosPago,
  getPagosByOrden,
  getOrdenesPendientesPago,
} from './payments.service'

export const procesarPagoController = async (req: Request, res: Response) => {
  try {
    const { ordenId, metodoPagoId, monto, referencia } = req.body

    if (!ordenId || !metodoPagoId || !monto) {
      res.status(400).json({ error: 'ordenId, metodoPagoId y monto son requeridos' })
      return
    }

    if (monto <= 0) {
      res.status(400).json({ error: 'El monto debe ser mayor a 0' })
      return
    }

    const resultado = await procesarPago({
      ordenId: parseInt(ordenId),
      metodoPagoId: parseInt(metodoPagoId),
      monto: parseFloat(monto),
      referencia,
    })

    res.status(201).json(resultado)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al procesar pago'
    res.status(400).json({ error: mensaje })
  }
}

export const getMetodosPagoController = async (_req: Request, res: Response) => {
  try {
    const metodos = await getMetodosPago()
    res.json(metodos)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener métodos de pago' })
  }
}

export const getPagosByOrdenController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    const resultado = await getPagosByOrden(id)
    res.json(resultado)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al obtener pagos'
    res.status(400).json({ error: mensaje })
  }
}

export const getOrdenesPendientesPagoController = async (_req: Request, res: Response) => {
  try {
    const ordenes = await getOrdenesPendientesPago()
    res.json(ordenes)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes pendientes' })
  }
}