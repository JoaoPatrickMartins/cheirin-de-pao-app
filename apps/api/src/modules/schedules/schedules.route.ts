import { FastifyPluginAsync } from 'fastify'
import { SchedulesController } from './schedules.controller.js'

export const schedulesRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new SchedulesController(fastify)

  fastify.get(
    '/schedules/me',
    { preHandler: [fastify.authenticate] },
    ctrl.getMySchedule.bind(ctrl),
  )

  fastify.put(
    '/schedules/me',
    { preHandler: [fastify.authenticate] },
    ctrl.updateMySchedule.bind(ctrl),
  )
}
