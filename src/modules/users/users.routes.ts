import { Router } from 'express'
import {
  getUsuariosController,
  getUsuarioByIdController,
  actualizarUsuarioController,
  desactivarUsuarioController,
} from './users.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

// Solo gerente puede gestionar usuarios
router.get('/', verificarToken, verificarRol('gerente'), getUsuariosController)
router.get('/:id', verificarToken, verificarRol('gerente'), getUsuarioByIdController)
router.patch('/:id', verificarToken, verificarRol('gerente'), actualizarUsuarioController)
router.delete('/:id', verificarToken, verificarRol('gerente'), desactivarUsuarioController)

export { router as usersRoutes }