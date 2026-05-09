import { prisma } from '../../config/db'
import { promocionesActivasHoy } from '../../config/helpers'

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
  return await prisma.combos.findMany({
    where: { disponible: true },
    include: {
      combo_items: {
        include: {
          productos: {
            select: { id: true, nombre: true, precio_base: true, imagen_url: true },
          },
        },
      },
      // Solo incluir las promociones que apliquen hoy (por día y rango de fechas).
      // Evita que promos con solo_dia='jueves' aparezcan en días distintos.
      promociones: {
        where: promocionesActivasHoy(),
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
}

export const fetchPromociones = async () => {
  const rows = await prisma.promociones.findMany({
    where: promocionesActivasHoy(),
    include: {
      combos: {
        select: { id: true, nombre: true, precio: true, imagen_url: true },
      },
    },
  })

  return rows.map((p) => ({
    ...p,
    porcentaje: p.tipo_descuento === 'porcentaje' ? p.valor : null,
    monto_fijo: p.tipo_descuento === 'monto_fijo' ? p.valor : null,
  }))
}