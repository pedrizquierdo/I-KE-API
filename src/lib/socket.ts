import { Server } from 'socket.io'
import { Server as HttpServer } from 'http'
import { logger } from './logger'

let io: Server

export const initSocket = (httpServer: HttpServer, corsOrigins: string[]): Server => {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  })

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Socket conectado')

    // La pantalla de cocina se suscribe a este room para recibir cambios en tiempo real
    socket.on('join:cocina', () => {
      socket.join('cocina')
      logger.debug({ socketId: socket.id }, 'Socket se unió a cocina')
    })

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket desconectado')
    })
  })

  return io
}

export const getIo = (): Server => {
  if (!io) throw new Error('Socket.io no ha sido inicializado')
  return io
}
