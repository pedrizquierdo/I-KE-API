import { Request, Response } from 'express'
import { getReporteVentas, getDashboard } from './reports.service'

export const getReporteVentasController = async (req: Request, res: Response) => {
  const { fechaInicio, fechaFin, servicioId } = req.query
  const reporte = await getReporteVentas({
    fechaInicio: fechaInicio as string | undefined,
    fechaFin:    fechaFin    as string | undefined,
    servicioId:  servicioId  ? parseInt(servicioId as string) : undefined,
  })
  res.json(reporte)
}

export const getDashboardController = async (_req: Request, res: Response) => {
  const dashboard = await getDashboard()
  res.json(dashboard)
}
