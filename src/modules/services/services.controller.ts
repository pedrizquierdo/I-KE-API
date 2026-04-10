import { Request, Response } from 'express'
import { abrirServicio, cerrarServicio, getServicioActivo } from './services.service'
import { AppError } from '../../lib/AppError'

export const abrirServicioController = async (req: Request, res: Response) => {
  const servicio = await abrirServicio(req.usuario?.id)
  res.status(201).json(servicio)
}

export const cerrarServicioController = async (_req: Request, res: Response) => {
  const servicio = await cerrarServicio()
  res.json(servicio)
}

export const getServicioActivoController = async (_req: Request, res: Response) => {
  const servicio = await getServicioActivo()
  if (!servicio) throw new AppError(404, 'No hay ningún servicio abierto')
  res.json(servicio)
}
