import { Router } from 'express'
import {
  getReporteVentasController,
  getDashboardController,
} from './reports.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

const soloAdmin = [verificarToken, verificarRol('gerente')]

// Dashboard del día
router.get('/dashboard', ...soloAdmin, getDashboardController)

// Reporte por fecha
router.get('/sales/today', ...soloAdmin, async (req, res) => {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' })
  console.log('HOY:', hoy)
  console.log('FECHA ACTUAL UTC:', new Date().toISOString())
  req.query['fechaInicio'] = hoy
  req.query['fechaFin'] = hoy
  getReporteVentasController(req, res)
})

// Reporte de ventas con filtros opcionales
router.get('/sales', ...soloAdmin, getReporteVentasController)



export { router as reportsRoutes }