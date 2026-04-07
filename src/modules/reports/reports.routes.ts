import { Router } from 'express'
import {
  getReporteVentasController,
  getDashboardController,
} from './reports.controller'
import { getReporteVentas } from './reports.service'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

const soloAdmin = [verificarToken, verificarRol('gerente')]

// Dashboard del día
router.get('/dashboard', ...soloAdmin, getDashboardController)

router.get('/sales/today', ...soloAdmin, async (req, res) => {
  try {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' })
    const reporte = await getReporteVentas({ fechaInicio: hoy, fechaFin: hoy })
    res.json(reporte)
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte del día' })
  }
})

// Reporte de ventas con filtros opcionales
router.get('/sales', ...soloAdmin, getReporteVentasController)



export { router as reportsRoutes }