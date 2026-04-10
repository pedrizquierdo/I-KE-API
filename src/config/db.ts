import { PrismaClient } from '@prisma/client'

// Instancia global de Prisma
// En desarrollo, evita crear múltiples conexiones por hot-reload de nodemon
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PRODUCCIÓN: configura connection_limit y pool_timeout en DATABASE_URL:
//   postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=2
// O usa PgBouncer como proxy de conexiones si el volumen es alto.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
