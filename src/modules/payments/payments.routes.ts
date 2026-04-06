import { Router } from 'express'
import {
  procesarPagoController,
  getMetodosPagoController,
  getPagosByOrdenController,
  getOrdenesPendientesPagoController,
} from './payments.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

// Métodos de pago disponibles
router.get('/methods', verificarToken, getMetodosPagoController)

// Órdenes pendientes de pago — cajero y gerente
router.get('/pending-orders', verificarToken, verificarRol('gerente', 'cajero'), getOrdenesPendientesPagoController)

// Pagos de una orden específica
router.get('/order/:id', verificarToken, verificarRol('gerente', 'cajero'), getPagosByOrdenController)

// Procesar pago — cajero y gerente
router.post('/', verificarToken, verificarRol('gerente', 'cajero'), procesarPagoController)

export { router as paymentsRoutes }