import { Request, Response } from 'express'
import { login, refresh, registrar, solicitarResetPassword, resetPassword } from './auth.service'
import { AppError } from '../../lib/AppError'

// Express 5 captura automáticamente los rechazos de promesas y los pasa al middleware de error.
// No se necesita try/catch en controllers — los errores se propagan via next(err).

export const loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body
  const resultado = await login(email, password)

  res.cookie('refreshToken', resultado.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.json({ accessToken: resultado.accessToken, usuario: resultado.usuario })
}

export const refreshController = async (req: Request, res: Response) => {
  const refreshToken = req.cookies['refreshToken']
  if (!refreshToken) throw new AppError(401, 'No hay refresh token')

  const resultado = await refresh(refreshToken)

  res.cookie('refreshToken', resultado.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.json({ accessToken: resultado.accessToken })
}

export const registrarController = async (req: Request, res: Response) => {
  const { email, password, rol, empleadoId } = req.body
  const usuario = await registrar(email, password, rol, empleadoId)
  res.status(201).json(usuario)
}

export const logoutController = (_req: Request, res: Response) => {
  res.clearCookie('refreshToken')
  res.json({ message: 'Sesión cerrada' })
}

export const meController = (req: Request, res: Response) => {
  res.json((req as any).usuario)
}

export const forgotPasswordController = async (req: Request, res: Response) => {
  const { email } = req.body
  // El servicio nunca lanza error si el email no existe — respuesta siempre genérica
  await solicitarResetPassword(email)
  res.json({ message: 'Si el correo está registrado recibirás un enlace en breve' })
}

export const resetPasswordController = async (req: Request, res: Response) => {
  const { token, password } = req.body
  await resetPassword(token, password)
  res.json({ message: 'Contraseña actualizada correctamente' })
}
