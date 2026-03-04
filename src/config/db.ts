import { PrismaClient } from '@prisma/client'

// Instancia global de Prisma
// En desarrollo, evita crear múltiples conexiones por hot-reload de nodemon
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({
    log: ['query', 'error', 'warn'], // muestra queries en consola durante desarrollo
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}