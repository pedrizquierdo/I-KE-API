import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '../../config/db'
import { AppError } from '../../lib/AppError'
import { enviarEmailResetPassword } from '../../lib/mailer'
import { env } from '../../config/env'

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

// ─── Recuperación de contraseña ───────────────────────────────────────────────
export const solicitarResetPassword = async (email: string) => {
  // Respuesta genérica siempre — nunca revelar si el email existe o no
  const usuario = await prisma.usuarios.findUnique({ where: { email } })
  if (!usuario || !usuario.activo) return

  // Invalidar tokens previos pendientes del mismo usuario
  await prisma.password_reset_tokens.updateMany({
    where: { usuario_id: usuario.id, usado: false },
    data: { usado: true },
  })

  // Generar token criptográficamente seguro (32 bytes → 64 chars hex)
  const tokenPlano = crypto.randomBytes(32).toString('hex')
  // Almacenar solo el hash SHA-256 — si la BD es comprometida, el token plano no se expone
  const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex')

  await prisma.password_reset_tokens.create({
    data: {
      usuario_id: usuario.id,
      token_hash: tokenHash,
      expira_en: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    },
  })

  const resetUrl = `${env.APP_URL}/reset-password?token=${tokenPlano}`

  // Email sending is best-effort: if Resend fails (bad API key, rate limit, etc.)
  // we log the error but do NOT propagate — the token is saved and the user can
  // request again. Propagating would cause a misleading 500 response.
  try {
    await enviarEmailResetPassword(usuario.email, resetUrl)
  } catch (emailErr) {
    console.error('[forgot-password] Error al enviar email de reset:', emailErr)
  }
}

export const resetPassword = async (tokenPlano: string, nuevaPassword: string) => {
  const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex')

  const registro = await prisma.password_reset_tokens.findUnique({
    where: { token_hash: tokenHash },
  })

  if (!registro || registro.usado || registro.expira_en < new Date()) {
    throw new AppError(400, 'El token es inválido o ha expirado')
  }

  const hash = await bcrypt.hash(nuevaPassword, 12)

  // Actualizar contraseña y marcar token como usado en una transacción
  await prisma.$transaction([
    prisma.usuarios.update({
      where: { id: registro.usuario_id },
      data: { password: hash },
    }),
    prisma.password_reset_tokens.update({
      where: { id: registro.id },
      data: { usado: true },
    }),
  ])
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
