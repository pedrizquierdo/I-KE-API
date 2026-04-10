import { Router } from 'express'
import {
  getReporteVentasController,
  getDashboardController,
  compararVentasController,
  getReporteInventarioController,
} from './reports.controller'
import { getReporteVentas } from './reports.service'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validateQuery } from '../../middlewares/validate.middleware'
import { CompararVentasSchema, ReporteInventarioSchema } from '../../schemas'

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

// Comparación de dos períodos — debe ir antes de /sales para que Express
// no confunda /sales/compare con el handler de /sales
router.get('/sales/compare',
  ...soloAdmin,
  validateQuery(CompararVentasSchema),
  compararVentasController,
)

// Reporte de ventas con filtros opcionales
router.get('/sales', ...soloAdmin, getReporteVentasController)

// Consumo de inventario agrupado por ingrediente (movimientos tipo 'venta')
router.get('/inventory',
  ...soloAdmin,
  validateQuery(ReporteInventarioSchema),
  getReporteInventarioController,
)



export { router as reportsRoutes }