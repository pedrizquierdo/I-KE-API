import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config/db', () => ({
  prisma: {
    promociones: {
      findMany: vi.fn(),
    },
  },
}))

import { fetchPromociones } from '../modules/menu/menu.service'
import { prisma } from '../config/db'

describe('menu.service', () => {
  beforeEach(() => vi.clearAllMocks())

  // CP_026 – GET /menu/promociones es público y devuelve promociones activas
  describe('CP_026 fetchPromociones', () => {
    it('retorna 200 con promociones activas incluyendo porcentaje y monto_fijo', async () => {
      const mockRows = [
        {
          id: 1,
          nombre: 'Descuento 10%',
          descripcion: null,
          tipo_descuento: 'porcentaje',
          valor: 10,
          combo_id: null,
          solo_dia: null,
          fecha_inicio: null,
          fecha_fin: null,
          activo: true,
          combos: null,
        },
        {
          id: 2,
          nombre: 'Rebaja $20',
          descripcion: null,
          tipo_descuento: 'monto_fijo',
          valor: 20,
          combo_id: null,
          solo_dia: null,
          fecha_inicio: null,
          fecha_fin: null,
          activo: true,
          combos: null,
        },
      ]

      vi.mocked(prisma.promociones.findMany).mockResolvedValue(mockRows as any)

      const result = await fetchPromociones()

      expect(result).toHaveLength(2)

      expect(result[0]).toMatchObject({
        id: 1,
        activo: true,
        tipo_descuento: 'porcentaje',
        porcentaje: 10,
        monto_fijo: null,
      })

      expect(result[1]).toMatchObject({
        id: 2,
        activo: true,
        tipo_descuento: 'monto_fijo',
        porcentaje: null,
        monto_fijo: 20,
      })
    })

    it('filtra por activo: true en la query de Prisma', async () => {
      vi.mocked(prisma.promociones.findMany).mockResolvedValue([])

      await fetchPromociones()

      const callArg = vi.mocked(prisma.promociones.findMany).mock.calls[0][0]
      expect(callArg?.where).toMatchObject({ activo: true })
    })

    it('devuelve arreglo vacío cuando no hay promociones activas', async () => {
      vi.mocked(prisma.promociones.findMany).mockResolvedValue([])

      const result = await fetchPromociones()

      expect(result).toEqual([])
    })
  })
})
