import { Router } from 'express'
import {
  loginController,
  refreshController,
  registrarController,
  logoutController,
  meController,
} from './auth.controller'
import { verificarToken } from '../../middlewares/auth.middleware'

const router = Router()

// Públicas
router.post('/login', loginController)
router.post('/refresh', refreshController)
router.post('/logout', logoutController)

// Protegidas — requieren token válido
router.get('/me', verificarToken, meController)

// Solo admin puede registrar usuarios
router.post('/register', verificarToken, registrarController)

export { router as authRoutes }