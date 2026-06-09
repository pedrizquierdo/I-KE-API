import { Request, Response } from 'express'
import { getBannerConfig, updateBannerConfig, uploadBannerImage, removeBannerImage } from './settings.service'
import { AppError } from '../../lib/AppError'

export const getBannerController = async (_req: Request, res: Response) => {
  res.json(getBannerConfig())
}

export const updateBannerController = async (req: Request, res: Response) => {
  const config = updateBannerConfig(req.body)
  res.json(config)
}

export const uploadBannerImageController = async (req: Request, res: Response) => {
  if (!req.file) throw new AppError(400, 'No se proporcionó ninguna imagen')
  const imagenUrl = await uploadBannerImage(req.file.buffer)
  res.json({ imagenUrl })
}

export const removeBannerImageController = async (_req: Request, res: Response) => {
  const config = removeBannerImage()
  res.json(config)
}
