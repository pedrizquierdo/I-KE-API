import { Router } from 'express'
import {
  loginController,
  refreshController,
  registrarController,
  logoutController,
  meController,
  forgotPasswordController,
  resetPasswordController,
} from './auth.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { authLimiter } from '../../middlewares/rate-limit.middleware'
import { LoginSchema, RegistrarSchema, ForgotPasswordSchema, ResetPasswordSchema } from '../../schemas'

const router = Router()

// Rate limiter aplicado solo a los endpoints que reciben credenciales
router.post('/login',    authLimiter, validate(LoginSchema),    loginController)
router.post('/refresh',  authLimiter,                           refreshController)
router.post('/logout',                                          logoutController)
router.get('/me',        verificarToken,                        meController)

// Recuperación de contraseña — rate limiter para prevenir abuso
router.post('/forgot-password', authLimiter, validate(ForgotPasswordSchema), forgotPasswordController)
router.post('/reset-password',  authLimiter, validate(ResetPasswordSchema),  resetPasswordController)

// Solo gerente puede registrar nuevos usuarios
router.post('/register',
  verificarToken,
  verificarRol('gerente'),
  validate(RegistrarSchema),
  registrarController,
)

export { router as authRoutes }