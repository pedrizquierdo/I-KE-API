import { Request, Response } from 'express'
import {
  procesarPago,
  getMetodosPago,
  getPagosByOrden,
  getOrdenesPendientesPago,
  subirComprobante,
  confirmarPago,
  getPendingTransfers,
} from './payments.service'
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

export const subirComprobanteController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  if (!req.file) throw new AppError(400, 'Se requiere un archivo de imagen en el campo "comprobante"')
  const pago = await subirComprobante(id, req.file.buffer)
  res.json(pago)
}

export const confirmarPagoController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const { aprobado, notas } = req.body as { aprobado: boolean; notas?: string }
  const pago = await confirmarPago(id, aprobado, notas)
  res.json(pago)
}

export const getPendingTransfersController = async (_req: Request, res: Response) => {
  const pagos = await getPendingTransfers()
  res.json(pagos)
}
