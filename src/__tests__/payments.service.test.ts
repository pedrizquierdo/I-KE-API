import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../lib/AppError'

vi.mock('../config/db', () => ({
  prisma: {
    ordenes: {
      findUnique: vi.fn(),
    },
    metodos_pago: {
      findUnique: vi.fn(),
    },
    pagos: {
      create: vi.fn(),
    },
  },
}))

import { procesarPago } from '../modules/payments/payments.service'
import { prisma } from '../config/db'

const ordenBase = {
  id: 1,
  estado: 'lista',
  total: '100.00',
  pagos: [],
}

const metodoPagoBase = { id: 1, nombre: 'Efectivo' }

describe('payments.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('procesarPago', () => {
    it('lanza AppError 404 si la orden no existe', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue(null)

      await expect(procesarPago({ ordenId: 99, metodoPagoId: 1, monto: 50 })).rejects.toThrow(
        new AppError(404, 'Orden no encontrada')
      )
    })

    it('lanza AppError 400 si la orden está cancelada', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue({ ...ordenBase, estado: 'cancelada' } as any)

      await expect(procesarPago({ ordenId: 1, metodoPagoId: 1, monto: 50 })).rejects.toThrow(
        new AppError(400, 'No se puede pagar una orden cancelada')
      )
    })

    it('lanza AppError 404 si el método de pago no existe', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue(ordenBase as any)
      vi.mocked(prisma.metodos_pago.findUnique).mockResolvedValue(null)

      await expect(procesarPago({ ordenId: 1, metodoPagoId: 99, monto: 50 })).rejects.toThrow(
        new AppError(404, 'Método de pago no válido')
      )
    })

    it('lanza AppError 400 si el monto excede el restante', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue(ordenBase as any)
      vi.mocked(prisma.metodos_pago.findUnique).mockResolvedValue(metodoPagoBase as any)

      await expect(procesarPago({ ordenId: 1, metodoPagoId: 1, monto: 200 })).rejects.toThrow(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('registra el pago exacto correctamente', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue(ordenBase as any)
      vi.mocked(prisma.metodos_pago.findUnique).mockResolvedValue(metodoPagoBase as any)
      vi.mocked(prisma.pagos.create).mockResolvedValue({
        id: 10, orden_id: 1, monto: '100', metodos_pago: metodoPagoBase,
      } as any)

      const result = await procesarPago({ ordenId: 1, metodoPagoId: 1, monto: 100 })

      expect(result.ordenPagada).toBe(true)
      expect(result.cambio).toBe(0)
      expect(result.restante).toBe(0)
    })

    it('registra pago parcial correctamente', async () => {
      vi.mocked(prisma.ordenes.findUnique).mockResolvedValue(ordenBase as any)
      vi.mocked(prisma.metodos_pago.findUnique).mockResolvedValue(metodoPagoBase as any)
      vi.mocked(prisma.pagos.create).mockResolvedValue({
        id: 11, orden_id: 1, monto: '50', metodos_pago: metodoPagoBase,
      } as any)

      const result = await procesarPago({ ordenId: 1, metodoPagoId: 1, monto: 50 })

      expect(result.ordenPagada).toBe(false)
      expect(result.restante).toBe(50)
      expect(result.cambio).toBe(0)
    })
  })
})
