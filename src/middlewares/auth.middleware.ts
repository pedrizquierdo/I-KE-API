import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { TokenPayload } from '../modules/auth/auth.service'

// Extender el tipo Request para agregar usuario
declare global {
  namespace Express {
    interface Request {
      usuario?: TokenPayload
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET as string

export const verificarToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token no proporcionado' })
      return
    }

    const token = authHeader.split(' ')[1] as string
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload

    req.usuario = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// Middleware opcional — extrae el usuario del token si está presente,
// pero permite continuar aunque no haya token o sea inválido.
// Útil para rutas accesibles tanto a anónimos como a usuarios autenticados.
export const verificarTokenOpcional = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1] as string
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload
      req.usuario = payload
    }
  } catch {
    // Token inválido o expirado — simplemente no se asigna req.usuario
  }
  next()
}

// Middleware para verificar roles específicos
export const verificarRol = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }

    if (!roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' })
      return
    }

    next()
  }
}