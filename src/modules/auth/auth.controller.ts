import { Request, Response } from 'express'
import { login, refresh, registrar } from './auth.service'

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son requeridos' })
      return
    }

    const resultado = await login(email, password)

    // Guardar refresh token en cookie httpOnly
    res.cookie('refreshToken', resultado.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
    })

    res.json({
      accessToken: resultado.accessToken,
      usuario: resultado.usuario,
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al iniciar sesión'
    res.status(401).json({ error: mensaje })
  }
}

export const refreshController = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies['refreshToken']

    if (!refreshToken) {
      res.status(401).json({ error: 'No hay refresh token' })
      return
    }

    const resultado = await refresh(refreshToken)

    // Renovar cookie
    res.cookie('refreshToken', resultado.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({ accessToken: resultado.accessToken })
  } catch (error) {
    res.status(401).json({ error: 'Refresh token inválido o expirado' })
  }
}

export const registrarController = async (req: Request, res: Response) => {
  try {
    const { email, password, rol, empleadoId } = req.body

    if (!email || !password || !rol) {
      res.status(400).json({ error: 'Email, contraseña y rol son requeridos' })
      return
    }

    const usuario = await registrar(email, password, rol, empleadoId)
    res.status(201).json(usuario)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al registrar usuario'
    res.status(400).json({ error: mensaje })
  }
}

export const logoutController = (_req: Request, res: Response) => {
  res.clearCookie('refreshToken')
  res.json({ message: 'Sesión cerrada' })
}

export const meController = async (req: Request, res: Response) => {
  // req.usuario viene del middleware de auth
  res.json((req as any).usuario)
}