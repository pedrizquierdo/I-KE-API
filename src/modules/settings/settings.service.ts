import { cloudinary } from '../../config/cloudinary'
import { AppError } from '../../lib/AppError'

export interface BannerConfig {
  titulo: string
  subtitulo: string
  badge: string
  featuredPromoId: number | null
  imagenUrl: string | null
}

const DEFAULTS: BannerConfig = {
  titulo: '3 TACOS + BEBIDA',
  subtitulo: '¡Disfruta la mejor birria!',
  badge: 'Bienvenido',
  featuredPromoId: null,
  imagenUrl: null,
}

let bannerConfig: BannerConfig = { ...DEFAULTS }

export const getBannerConfig = (): BannerConfig => ({ ...bannerConfig })

export const updateBannerConfig = (data: Partial<BannerConfig>): BannerConfig => {
  bannerConfig = { ...bannerConfig, ...data }
  return { ...bannerConfig }
}

export const uploadBannerImage = async (buffer: Buffer): Promise<string> => {
  const imageUrl = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'hero-banner', resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(new AppError(500, 'Error al subir imagen a Cloudinary'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })

  bannerConfig.imagenUrl = imageUrl
  return imageUrl
}

export const removeBannerImage = (): BannerConfig => {
  bannerConfig.imagenUrl = null
  return { ...bannerConfig }
}
