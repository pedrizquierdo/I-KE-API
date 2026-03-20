import { Request, Response } from 'express'
import { abrirServicio, cerrarServicio, getServicioActivo } from './services.service'

export const abrirServicioController = async (req: Request, res: Response) => {
  try {
    const empleadoId = req.usuario?.id
    const servicio = await abrirServicio(empleadoId)
    res.status(201).json(servicio)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al abrir servicio'
    res.status(400).json({ error: mensaje })
  }
}

export const cerrarServicioController = async (_req: Request, res: Response) => {
  try {
    const servicio = await cerrarServicio()
    res.json(servicio)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al cerrar servicio'
    res.status(400).json({ error: mensaje })
  }
}

export const getServicioActivoController = async (_req: Request, res: Response) => {
  try {
    const servicio = await getServicioActivo()
    if (!servicio) {
      res.status(404).json({ error: 'No hay ningún servicio abierto' })
      return
    }
    res.json(servicio)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener servicio activo' })
  }
}