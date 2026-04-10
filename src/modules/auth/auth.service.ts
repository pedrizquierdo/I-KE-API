import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '../../config/db'
import { AppError } from '../../lib/AppError'

const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH as string
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface TokenPayload {
  id: number
  email: string
  rol: string
}

// ─── Generar tokens ───────────────────────────────────────────────────────────
const generarTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions)

  const refreshToken = jwt.sign(payload, JWT_SECRET_REFRESH, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions)

  return { accessToken, refreshToken }
}

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (email: string, password: string) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { email },
    include: {
      empleados: {
        select: { id: true, nombre: true, apellido: true }
      }
    }
  })

  if (!usuario) throw new AppError(401, 'Credenciales incorrectas')
  if (!usuario.activo) throw new AppError(401, 'Usuario desactivado')

  const passwordValida = await bcrypt.compare(password, usuario.password)
  if (!passwordValida) throw new AppError(401, 'Credenciales incorrectas')

  const payload: TokenPayload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  }

  const { accessToken, refreshToken } = generarTokens(payload)

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.empleados?.nombre ?? null,
      apellido: usuario.empleados?.apellido ?? null,
    }
  }
}

// ─── Refresh token ────────────────────────────────────────────────────────────
export const refresh = async (refreshToken: string) => {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET_REFRESH) as TokenPayload

    const usuario = await prisma.usuarios.findUnique({ where: { id: payload.id } })
    if (!usuario || !usuario.activo) throw new AppError(401, 'Usuario no válido')

    const nuevoPayload: TokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    }

    const { accessToken, refreshToken: nuevoRefreshToken } = generarTokens(nuevoPayload)
    return { accessToken, refreshToken: nuevoRefreshToken }
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError(401, 'Refresh token inválido o expirado')
  }
}

// ─── Registrar usuario (solo admin) ──────────────────────────────────────────
export const registrar = async (
  email: string,
  password: string,
  rol: string,
  empleadoId?: number
) => {
  const existe = await prisma.usuarios.findUnique({ where: { email } })
  if (existe) throw new AppError(409, 'El email ya está registrado')

  const hash = await bcrypt.hash(password, 12)

  const usuario = await prisma.usuarios.create({
    data: {
      email,
      password: hash,
      rol,
      empleado_id: empleadoId ?? null,
    }
  })

  return { id: usuario.id, email: usuario.email, rol: usuario.rol }
}
