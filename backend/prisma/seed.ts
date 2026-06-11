import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed.ts is a DEV-only seed and must never run in production.');
  }

  console.log('🌱 Seeding dev database...');

  // Dev organization (tenant)
  const org = await prisma.organization.upsert({
    where: { slug: 'dev' },
    update: {},
    create: {
      name: 'Dev Workspace',
      slug: 'dev',
    },
  });

  // Admin user — password from SEED_ADMIN_PASSWORD or generated once
  const generatedPassword = !process.env.SEED_ADMIN_PASSWORD;
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dev.local' },
    update: { password: hashedPassword },
    create: {
      organizationId: org.id,
      name: 'Dev Admin',
      email: 'admin@dev.local',
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  // Webhook token — random per database, never hardcoded
  let webhookToken = await prisma.webhookToken.findFirst({
    where: { organizationId: org.id },
  });
  if (!webhookToken) {
    webhookToken = await prisma.webhookToken.create({
      data: {
        organizationId: org.id,
        name: 'Dev Webhook',
        token: crypto.randomBytes(32).toString('hex'),
      },
    });
  }

  // Sample data (minimal)
  const customer = await prisma.customer.upsert({
    where: { organizationId_phone: { organizationId: org.id, phone: '+380501112233' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Олексій Коваленко',
      phone: '+380501112233',
      city: 'Київ',
    },
  });

  const product = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: org.id, sku: 'DEV-001' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Тестовий товар',
      sku: 'DEV-001',
      purchasePrice: 100,
      salePrice: 250,
      stock: 50,
    },
  });

  const orderCount = await prisma.order.count({ where: { organizationId: org.id } });
  if (orderCount === 0) {
    await prisma.order.create({
      data: {
        organizationId: org.id,
        orderNum: 1,
        customerId: customer.id,
        managerId: admin.id,
        status: 'NEW',
        source: 'MANUAL',
        total: product.salePrice,
        items: {
          create: {
            productId: product.id,
            name: product.name,
            quantity: 1,
            price: product.salePrice,
          },
        },
        history: {
          create: {
            action: 'CREATED',
            newValue: 'NEW',
            userId: admin.id,
          },
        },
      },
    });
    console.log('✅ Created sample order');
  }

  console.log('✅ Seeding complete!');
  console.log('');
  console.log(`👤 Admin: admin@dev.local`);
  if (generatedPassword) {
    console.log(`🔑 Generated admin password (save it now, shown only once): ${adminPassword}`);
  } else {
    console.log('🔑 Admin password taken from SEED_ADMIN_PASSWORD');
  }
  console.log(`🔗 Webhook token: ${webhookToken.token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
