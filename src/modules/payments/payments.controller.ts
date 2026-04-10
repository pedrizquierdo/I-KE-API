import { Request, Response } from 'express'
import { procesarPago, getMetodosPago, getPagosByOrden, getOrdenesPendientesPago } from './payments.service'
import { AppError } from '../../lib/AppError'

export const procesarPagoController = async (req: Request, res: Response) => {
  const { ordenId, metodoPagoId, monto, referencia } = req.body
  const resultado = await procesarPago({
    ordenId: parseInt(ordenId),
    metodoPagoId: parseInt(metodoPagoId),
    monto: parseFloat(monto),
    referencia,
  })
  res.status(201).json(resultado)
}

export const getMetodosPagoController = async (_req: Request, res: Response) => {
  const metodos = await getMetodosPago()
  res.json(metodos)
}

export const getPagosByOrdenController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const resultado = await getPagosByOrden(id)
  res.json(resultado)
}

export const getOrdenesPendientesPagoController = async (_req: Request, res: Response) => {
  const ordenes = await getOrdenesPendientesPago()
  res.json(ordenes)
}
