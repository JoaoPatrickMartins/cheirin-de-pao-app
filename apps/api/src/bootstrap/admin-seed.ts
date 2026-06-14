import { PrismaClient } from '@prisma/client'

export async function seedAdminIfAbsent(prisma: PrismaClient): Promise<void> {
  const name = process.env.ADMIN_NAME
  const phone = process.env.ADMIN_PHONE ?? null
  const email = process.env.ADMIN_EMAIL ?? null

  if (!name || (!phone && !email)) {
    console.warn(
      '[bootstrap] ADMIN_NAME e ADMIN_PHONE/ADMIN_EMAIL não configurados — admin seed ignorado',
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
      cpf: process.env.ADMIN_CPF ?? '00000000000',
    },
  })
  console.log('[bootstrap] Admin user created:', name)
}
