import { prisma } from '../../config/db'
import { diaHoyHermosillo } from '../../config/helpers'

export const fetchCategorias = async () => {
  return await prisma.categorias.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  })
}

export const fetchProductos = async () => {
  return await prisma.productos.findMany({
    where: { disponible: true },
    include: {
      categorias: {
        select: { id: true, nombre: true },
      },
      producto_modificador_grupos: {
        include: {
          modificador_grupos: {
            include: {
              modificadores: {
                where: { disponible: true },
              },
            },
          },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })
}

export const fetchProductoById = async (id: number) => {
  return await prisma.productos.findFirst({
    where: { id, disponible: true },
    include: {
      categorias: {
        select: { id: true, nombre: true },
      },
      producto_modificador_grupos: {
        include: {
          modificador_grupos: {
            include: {
              modificadores: {
                where: { disponible: true },
              },
            },
          },
        },
      },
    },
  })
}

export const fetchProductosByCategoria = async (categoriaId: number) => {
  return await prisma.productos.findMany({
    where: {
      categoria_id: categoriaId,
      disponible: true,
    },
    include: {
      categorias: {
        select: { id: true, nombre: true },
      },
    },
    orderBy: { nombre: 'asc' },
  })
}

export const fetchCombos = async () => {
  const combos = await prisma.combos.findMany({
    where: { disponible: true },
    include: {
      combo_items: {
        include: {
          productos: {
            select: { id: true, nombre: true, precio_base: true, imagen_url: true },
          },
        },
      },
      promociones: {
        where: { activo: true },
        select: {
          id:             true,
          nombre:         true,
          tipo_descuento: true,
          valor:          true,
          solo_dia:       true,
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const diaHoy = diaHoyHermosillo()
  return combos
    .filter((combo) => {
      // Si el combo no tiene promociones, siempre se muestra.
      // Si TODAS sus promociones tienen solo_dia y ninguna aplica hoy,
      // el combo es exclusivo de otro día → se oculta.
      if (combo.promociones.length === 0) return true
      const todasRestringidas = combo.promociones.every((p) => p.solo_dia !== null)
      if (!todasRestringidas) return true
      return combo.promociones.some((p) => p.solo_dia === diaHoy)
    })
    .map((combo) => ({
      ...combo,
      promociones: combo.promociones.filter(
        (p) => !p.solo_dia || p.solo_dia === diaHoy,
      ),
    }))
}

export const fetchPromociones = async () => {
  const rows = await prisma.promociones.findMany({
    where: { activo: true },
    include: {
      combos: {
        select: { id: true, nombre: true, precio: true, imagen_url: true },
      },
    },
  })

  const diaHoy = diaHoyHermosillo()
  return rows
    .filter((p) => !p.solo_dia || p.solo_dia === diaHoy)
    .map((p) => ({
      ...p,
      porcentaje: p.tipo_descuento === 'porcentaje' ? p.valor : null,
      monto_fijo: p.tipo_descuento === 'monto_fijo' ? p.valor : null,
    }))
}