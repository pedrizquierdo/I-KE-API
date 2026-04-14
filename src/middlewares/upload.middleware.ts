import multer from 'multer'
import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/AppError'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// ─── Factory — crea un middleware de subida para el campo indicado ────────────
const crearUploadMiddleware = (fieldName: string) => {
  const _upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: MAX_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new AppError(400, 'Solo se permiten imágenes JPG, PNG o WebP'))
      }
    },
  }).single(fieldName)

  // Wraps multer to convert MulterError → AppError
  return (req: Request, res: Response, next: NextFunction) => {
    _upload(req, res, (err) => {
      if (!err) return next()
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE')
          return next(new AppError(400, 'La imagen no debe superar 5 MB'))
        return next(new AppError(400, err.message))
      }
      next(err)
    })
  }
}

export const uploadImagen      = crearUploadMiddleware('image')
export const uploadComprobante = crearUploadMiddleware('comprobante')
