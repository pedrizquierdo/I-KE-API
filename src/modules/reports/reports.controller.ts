import { Request, Response } from 'express'
import { getReporteVentas, getDashboard, compararVentas, getReporteInventario } from './reports.service'

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

export const getReporteInventarioController = async (_req: Request, res: Response) => {
  const { fechaInicio, fechaFin } = res.locals['query'] as {
    fechaInicio?: string
    fechaFin?:    string
  }
  const reporte = await getReporteInventario({ fechaInicio, fechaFin })
  res.json(reporte)
}

export const compararVentasController = async (_req: Request, res: Response) => {
  // Los query params ya fueron validados y parseados por validateQuery(CompararVentasSchema).
  // El objeto limpio vive en res.locals['query'] — tipado localmente para evitar any.
  const { periodo1Inicio, periodo1Fin, periodo2Inicio, periodo2Fin } = res.locals['query'] as {
    periodo1Inicio: string
    periodo1Fin:    string
    periodo2Inicio: string
    periodo2Fin:    string
  }
  const comparacion = await compararVentas(periodo1Inicio, periodo1Fin, periodo2Inicio, periodo2Fin)
  res.json(comparacion)
}
