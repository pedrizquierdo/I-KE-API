import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../lib/AppError'

// Mock prisma antes de importar el servicio
vi.mock('../config/db', () => ({
  prisma: {
    usuarios: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-token'),
    verify: vi.fn(),
  },
}))

import { login, registrar } from '../modules/auth/auth.service'
import { prisma } from '../config/db'
import bcrypt from 'bcryptjs'

describe('auth.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('login', () => {
    it('lanza AppError 401 si el usuario no existe', async () => {
      vi.mocked(prisma.usuarios.findUnique).mockResolvedValue(null)

      await expect(login('no@existe.com', '123456')).rejects.toThrow(
        new AppError(401, 'Credenciales incorrectas')
      )
    })

    it('lanza AppError 401 si el usuario está desactivado', async () => {
      vi.mocked(prisma.usuarios.findUnique).mockResolvedValue({
        id: 1, email: 'a@b.com', password: 'hashed', rol: 'cajero',
        activo: false, empleados: null,
      } as any)

      await expect(login('a@b.com', '123456')).rejects.toThrow(
        new AppError(401, 'Usuario desactivado')
      )
    })

    it('lanza AppError 401 si la contraseña es incorrecta', async () => {
      vi.mocked(prisma.usuarios.findUnique).mockResolvedValue({
        id: 1, email: 'a@b.com', password: 'hashed', rol: 'cajero',
        activo: true, empleados: null,
      } as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as any)

      await expect(login('a@b.com', 'mal-pass')).rejects.toThrow(
        new AppError(401, 'Credenciales incorrectas')
      )
    })

    it('retorna tokens si las credenciales son correctas', async () => {
      vi.mocked(prisma.usuarios.findUnique).mockResolvedValue({
        id: 1, email: 'a@b.com', password: 'hashed', rol: 'cajero',
        activo: true, empleados: { nombre: 'Ana', apellido: 'López' },
      } as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any)

      const result = await login('a@b.com', 'correcto')

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.usuario.email).toBe('a@b.com')
    })
  })

  describe('registrar', () => {
    it('lanza AppError 409 si el email ya existe', async () => {
      vi.mocked(prisma.usuarios.findUnique).mockResolvedValue({ id: 1 } as any)

      await expect(registrar('dup@dup.com', '123456789012345678901234567890123', 'cajero')).rejects.toThrow(
        new AppError(409, 'El email ya está registrado')
      )
    })

    it('crea el usuario si el email no existe', async () => {
      vi.mocked(prisma.usuarios.findUnique).mockResolvedValue(null)
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as any)
      vi.mocked(prisma.usuarios.create).mockResolvedValue({
        id: 2, email: 'nuevo@b.com', rol: 'mesero',
      } as any)

      const result = await registrar('nuevo@b.com', 'pass123', 'mesero')

      expect(result).toHaveProperty('id', 2)
      expect(result).toHaveProperty('email', 'nuevo@b.com')
    })
  })
})
