import { prisma } from '../../config/db'

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
    },
    orderBy: { nombre: 'asc' },
  })
}

export const fetchPromociones = async () => {
  const hoy = new Date()
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const diaHoy = diasSemana[hoy.getDay()] as string

  return await prisma.promociones.findMany({
    where: {
      activo: true,
      OR: [
        { solo_dia: null },
        { solo_dia: diaHoy },
      ],
      AND: [
        {
          OR: [
            { fecha_inicio: null },
            { fecha_inicio: { lte: hoy } },
          ],
        },
        {
          OR: [
            { fecha_fin: null },
            { fecha_fin: { gte: hoy } },
          ],
        },
      ],
    },
    include: {
      combos: {
        select: { id: true, nombre: true, precio: true, imagen_url: true },
      },
    },
  })
}