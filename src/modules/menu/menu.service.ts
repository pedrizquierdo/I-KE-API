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
  const ahora = new Date()
  
  // Railway corre en UTC, ajustamos a la zona horaria de Sonora (UTC-7)
  const zonaHoraria = 'America/Hermosillo'
  const diaHoy = ahora.toLocaleDateString('es-MX', { 
    weekday: 'long', 
    timeZone: zonaHoraria 
  }).normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '') // quita acentos
   .toLowerCase()

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
            { fecha_inicio: { lte: ahora } },
          ],
        },
        {
          OR: [
            { fecha_fin: null },
            { fecha_fin: { gte: ahora } },
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