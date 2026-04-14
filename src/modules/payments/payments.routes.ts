import { Router } from 'express'
import {
  procesarPagoController,
  getMetodosPagoController,
  getPagosByOrdenController,
  getOrdenesPendientesPagoController,
  subirComprobanteController,
  confirmarPagoController,
  getPendingTransfersController,
} from './payments.controller'
import { verificarToken, verificarTokenOpcional, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { uploadComprobante } from '../../middlewares/upload.middleware'
import { ProcesarPagoSchema, ConfirmarPagoSchema } from '../../schemas'

const router = Router()

const soloCajero = [verificarToken, verificarRol('gerente', 'cajero')]

router.get('/metodos',            ...soloCajero, getMetodosPagoController)
router.get('/pendientes',         ...soloCajero, getOrdenesPendientesPagoController)
// IMPORTANTE: /pending-transfers antes de /:id para que Express no lo interprete como ID
router.get('/pending-transfers',  ...soloCajero, getPendingTransfersController)
router.get('/orden/:id',          ...soloCajero, getPagosByOrdenController)
// Crear pago — cajero/gerente en ventanilla; cliente autenticado para registrar transferencia propia
router.post('/',
  verificarToken,
  validate(ProcesarPagoSchema),
  procesarPagoController,
)

// Subir comprobante — cualquier usuario autenticado (cliente puede subir su transferencia)
router.post('/:id/comprobante',
  verificarToken,
  uploadComprobante,
  subirComprobanteController,
)

// Aprobar / rechazar comprobante — solo cajero y gerente
router.patch('/:id/confirm',
  ...soloCajero,
  validate(ConfirmarPagoSchema),
  confirmarPagoController,
)

export { router as paymentsRoutes }