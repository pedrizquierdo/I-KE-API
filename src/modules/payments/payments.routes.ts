import { Router } from 'express'
import {
  procesarPagoController,
  getMetodosPagoController,
  getPagosByOrdenController,
  getOrdenesPendientesPagoController,
} from './payments.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { ProcesarPagoSchema } from '../../schemas'

const router = Router()

const soloCajero = [verificarToken, verificarRol('gerente', 'cajero')]

router.get('/metodos',           ...soloCajero, getMetodosPagoController)
router.get('/pendientes',        ...soloCajero, getOrdenesPendientesPagoController)
router.get('/orden/:id',         ...soloCajero, getPagosByOrdenController)
router.post('/',  ...soloCajero, validate(ProcesarPagoSchema), procesarPagoController)

export { router as paymentsRoutes }