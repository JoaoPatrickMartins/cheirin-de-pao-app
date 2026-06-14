import { FastifyPluginAsync } from 'fastify'
import { AuthController } from './auth.controller.js'

export const authRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AuthController(fastify)

  // Public routes — no preHandler
  fastify.post('/auth/register', ctrl.register.bind(ctrl))
  fastify.post('/auth/otp/send', ctrl.sendOtp.bind(ctrl))
  fastify.post('/auth/otp/verify', ctrl.verifyOtp.bind(ctrl))

  // Admin-only route — authenticate preHandler validates Bearer token
  fastify.post(
    '/auth/couriers',
    { preHandler: [fastify.authenticate] },
    ctrl.registerCourier.bind(ctrl),
  )
}
