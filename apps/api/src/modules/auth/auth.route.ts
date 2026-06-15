import { FastifyPluginAsync } from 'fastify'
import { AuthController } from './auth.controller.js'

// OTP rate limit: 5 req/min por IP — protege contra brute force
const otpRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }

export const authRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AuthController(fastify)

  // Public routes — no preHandler
  fastify.post('/auth/register', ctrl.register.bind(ctrl))
  fastify.post('/auth/otp/send', otpRateLimit, ctrl.sendOtp.bind(ctrl))
  fastify.post('/auth/otp/verify', otpRateLimit, ctrl.verifyOtp.bind(ctrl))

  // Admin-only route — authenticate preHandler validates Bearer token
  fastify.post(
    '/auth/couriers',
    { preHandler: [fastify.authenticate] },
    ctrl.registerCourier.bind(ctrl),
  )
}
