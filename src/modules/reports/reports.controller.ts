import { Request, Response } from 'express'
import { getReporteVentas, getDashboard } from './reports.service'

export const getReporteVentasController = async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin, servicioId } = req.query

    const filtros = {
      fechaInicio: fechaInicio
        ? new Date(fechaInicio as string)
        : undefined,
      fechaFin: fechaFin
        ? new Date(fechaFin as string)
        : undefined,
      servicioId: servicioId ? parseInt(servicioId as string) : undefined,
    }

    const reporte = await getReporteVentas(filtros)
    res.json(reporte)
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte' })
  }
}

export const getDashboardController = async (_req: Request, res: Response) => {
  try {
    const dashboard = await getDashboard()
    res.json(dashboard)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener dashboard' })
  }
}