import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../lib/AppError'

vi.mock('../config/db', () => ({
  prisma: {
    ordenes: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orden_estados_historial: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('../modules/services/services.service', () => ({
  getServicioActivo: vi.fn(),
}))

import { cambiarEstadoOrden } from '../modules/orders/orders.service'
import { prisma } from '../config/db'
import { getServicioActivo } from '../modules/services/services.service'

describe('orders.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('cambiarEstadoOrden', () => {
    it('lanza AppError 404 si la orden no existe', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue(null)

      await expect(cambiarEstadoOrden(999, 'lista')).rejects.toThrow(
        new AppError(404, 'Orden no encontrada')
      )
    })

    it('lanza AppError 422 para transición inválida (entregada → pendiente)', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue({
        id: 1, estado: 'entregada',
      } as any)

      await expect(cambiarEstadoOrden(1, 'pendiente')).rejects.toThrow(
        expect.objectContaining({ statusCode: 422 })
      )
    })

    it('lanza AppError 422 para saltar un estado (pendiente → lista)', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue({
        id: 1, estado: 'pendiente',
      } as any)

      await expect(cambiarEstadoOrden(1, 'lista')).rejects.toThrow(
        expect.objectContaining({ statusCode: 422 })
      )
    })

    it('ejecuta la transición válida (pendiente → en_preparacion)', async () => {
      const ordenActualizada = { id: 1, estado: 'en_preparacion' }

      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue({
        id: 1, estado: 'pendiente',
      } as any)
      vi.mocked(prisma.$transaction).mockResolvedValue([ordenActualizada, {}] as any)

      const result = await cambiarEstadoOrden(1, 'en_preparacion', 5)

      expect(result).toEqual(ordenActualizada)
      expect(prisma.$transaction).toHaveBeenCalledOnce()
    })

    it('permite cancelar desde cualquier estado activo', async () => {
      const estados = ['pendiente', 'en_preparacion', 'lista']

      for (const estado of estados) {
        vi.mocked(prisma.ordenes.findUnique).mockResolvedValue({ id: 1, estado } as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([{ id: 1, estado: 'cancelada' }, {}] as any)

        await expect(cambiarEstadoOrden(1, 'cancelada')).resolves.toBeDefined()
      }
    })
  })
})
