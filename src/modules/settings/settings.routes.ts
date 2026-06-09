import { Router } from 'express'
import {
  getBannerController,
  updateBannerController,
  uploadBannerImageController,
  removeBannerImageController,
} from './settings.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { uploadImagen } from '../../middlewares/upload.middleware'

const router = Router()

const soloGerente = [verificarToken, verificarRol('gerente')]

// GET is public — HeroBanner server component reads this without a token
router.get('/banner', getBannerController)

router.patch('/banner', ...soloGerente, updateBannerController)
router.patch('/banner/image', ...soloGerente, uploadImagen, uploadBannerImageController)
router.delete('/banner/image', ...soloGerente, removeBannerImageController)

export { router as settingsRoutes }
