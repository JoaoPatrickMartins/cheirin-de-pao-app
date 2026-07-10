import { PrismaClient } from '@prisma/client'

export async function seedAdminIfAbsent(prisma: PrismaClient): Promise<void> {
  const name = process.env.ADMIN_NAME
  const phone = process.env.ADMIN_PHONE ?? null
  const email = process.env.ADMIN_EMAIL ?? null

  if (!name || (!phone && !email) || !process.env.ADMIN_CPF) {
    console.warn(
      '[bootstrap] ADMIN_NAME, ADMIN_PHONE/ADMIN_EMAIL e ADMIN_CPF são obrigatórios — admin seed ignorado',
    )
    return
  }

  const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (adminExists) return

  await prisma.user.create({
    data: {
      name,
      phone: phone ?? undefined,
      email: email ?? undefined,
      role: 'ADMIN',
      cpf: process.env.ADMIN_CPF,
    },
  })
  console.log('[bootstrap] Admin user created:', name)
}
