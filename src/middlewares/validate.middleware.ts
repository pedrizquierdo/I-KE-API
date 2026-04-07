import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

/**
 * Middleware genérico de validación con Zod.
 * Uso: router.post('/ruta', validate(MiSchema), miController)
 *
 * Valida req.body y lo reemplaza con el objeto parseado por Zod
 * (limpiando campos extra que no estén en el schema).
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const errores = result.error.issues.map((e) => ({
        campo:   e.path.join('.'),
        mensaje: e.message,
      }))
      res.status(400).json({ error: 'Datos inválidos', errores })
      return
    }

    // Reemplaza req.body con el objeto ya validado y limpio
    req.body = result.data
    next()
  }
}