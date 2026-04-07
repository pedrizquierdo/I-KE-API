import { Router } from 'express'
import {
  getUsuariosController,
  getUsuarioByIdController,
  actualizarUsuarioController,
  desactivarUsuarioController,
} from './users.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { ActualizarUsuarioSchema } from '../../schemas'

const router = Router()

const soloGerente = [verificarToken, verificarRol('gerente')]

router.get('/',         ...soloGerente,                                      getUsuariosController)
router.get('/:id',      ...soloGerente,                                      getUsuarioByIdController)
router.patch('/:id',    ...soloGerente, validate(ActualizarUsuarioSchema),   actualizarUsuarioController)
router.delete('/:id',   ...soloGerente,                                      desactivarUsuarioController)

export { router as usersRoutes }