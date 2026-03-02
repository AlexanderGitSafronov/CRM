import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      name: 'Администратор',
      email: 'admin@crm.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Create manager users
  const manager1 = await prisma.user.upsert({
    where: { email: 'manager1@crm.com' },
    update: {},
    create: {
      name: 'Иван Петров',
      email: 'manager1@crm.com',
      password: await bcrypt.hash('manager123', 10),
      role: 'MANAGER',
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@crm.com' },
    update: {},
    create: {
      name: 'Мария Сидорова',
      email: 'manager2@crm.com',
      password: await bcrypt.hash('manager123', 10),
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@crm.com' },
    update: {},
    create: {
      name: 'Просмотр',
      email: 'viewer@crm.com',
      password: await bcrypt.hash('viewer123', 10),
      role: 'VIEWER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'cc@crm.com' },
    update: {},
    create: {
      name: 'Оператор КЦ',
      email: 'cc@crm.com',
      password: await bcrypt.hash('cc123456', 10),
      role: 'CALL_CENTER',
    },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'PROD-001' },
      update: {},
      create: {
        name: 'Смартфон Samsung Galaxy A54',
        sku: 'PROD-001',
        purchasePrice: 8500,
        salePrice: 12990,
        stock: 45,
        description: 'Флагманский смартфон Samsung',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-002' },
      update: {},
      create: {
        name: 'Наушники AirPods Pro',
        sku: 'PROD-002',
        purchasePrice: 3200,
        salePrice: 5990,
        stock: 120,
        description: 'Беспроводные наушники Apple',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-003' },
      update: {},
      create: {
        name: 'Чехол для iPhone 15',
        sku: 'PROD-003',
        purchasePrice: 150,
        salePrice: 490,
        stock: 300,
        description: 'Силиконовый чехол',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-004' },
      update: {},
      create: {
        name: 'Power Bank 20000mAh',
        sku: 'PROD-004',
        purchasePrice: 900,
        salePrice: 1990,
        stock: 80,
        description: 'Портативный аккумулятор',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-005' },
      update: {},
      create: {
        name: 'Умные часы Apple Watch SE',
        sku: 'PROD-005',
        purchasePrice: 11000,
        salePrice: 16990,
        stock: 25,
        description: 'Смарт-часы Apple',
      },
    }),
  ]);

  // Create customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { phone: '+380501234567' },
      update: {},
      create: {
        name: 'Олексій Коваленко',
        phone: '+380501234567',
        email: 'kovalenko@example.com',
        city: 'Київ',
      },
    }),
    prisma.customer.upsert({
      where: { phone: '+380671234567' },
      update: {},
      create: {
        name: 'Ірина Мельник',
        phone: '+380671234567',
        email: 'melnyk@example.com',
        city: 'Харків',
      },
    }),
    prisma.customer.upsert({
      where: { phone: '+380631234567' },
      update: {},
      create: {
        name: 'Дмитро Шевченко',
        phone: '+380631234567',
        city: 'Одеса',
      },
    }),
    prisma.customer.upsert({
      where: { phone: '+380951234567' },
      update: {},
      create: {
        name: 'Наталія Бондаренко',
        phone: '+380951234567',
        email: 'bondarenko@example.com',
        city: 'Дніпро',
      },
    }),
    prisma.customer.upsert({
      where: { phone: '+380661234567' },
      update: {},
      create: {
        name: 'Андрій Лисенко',
        phone: '+380661234567',
        city: 'Львів',
      },
    }),
    prisma.customer.upsert({
      where: { phone: '+380731234567' },
      update: {},
      create: {
        name: 'Тетяна Гриценко',
        phone: '+380731234567',
        email: 'grytsenko@example.com',
        city: 'Запоріжжя',
      },
    }),
  ]);

  // Create orders with history
  const statuses = ['NEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const sources = ['WEBSITE', 'LANDING', 'FACEBOOK', 'INSTAGRAM', 'MANUAL', 'TELEGRAM'];
  const managers = [manager1.id, manager2.id, null];

  const orderCount = await prisma.order.count();

  if (orderCount === 0) {
    for (let i = 0; i < 50; i++) {
      const customer = customers[i % customers.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const managerId = managers[Math.floor(Math.random() * managers.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const total = product.salePrice * quantity;

      // Create date in the last 90 days
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      const order = await prisma.order.create({
        data: {
          orderNum: i + 1,
          customerId: customer.id,
          managerId: managerId,
          status,
          source,
          total,
          createdAt,
          comment: i % 5 === 0 ? 'Клієнт просить передзвонити перед доставкою' : null,
          items: {
            create: {
              productId: product.id,
              name: product.name,
              quantity,
              price: product.salePrice,
            },
          },
          history: {
            create: {
              action: 'CREATED',
              newValue: 'NEW',
              userId: managerId,
              createdAt,
            },
          },
        },
      });

      if (status !== 'NEW') {
        await prisma.orderHistory.create({
          data: {
            orderId: order.id,
            action: 'STATUS_CHANGED',
            oldValue: 'NEW',
            newValue: status,
            userId: managerId,
          },
        });
      }
    }
    console.log('✅ Created 50 sample orders');
  }

  // Create expenses
  const expenseCount = await prisma.expense.count();
  if (expenseCount === 0) {
    const expenseData = [
      { category: 'ADVERTISING', amount: 5000, description: 'Facebook Ads - Листопад', date: new Date('2024-11-01') },
      { category: 'ADVERTISING', amount: 7500, description: 'Google Ads - Листопад', date: new Date('2024-11-01') },
      { category: 'SERVICES', amount: 1200, description: 'Хостинг та домен', date: new Date('2024-11-05') },
      { category: 'PURCHASE', amount: 45000, description: 'Закупка товарів - партія 1', date: new Date('2024-11-10') },
      { category: 'ADVERTISING', amount: 6000, description: 'Facebook Ads - Грудень', date: new Date('2024-12-01') },
      { category: 'PURCHASE', amount: 38000, description: 'Закупка товарів - партія 2', date: new Date('2024-12-15') },
      { category: 'OTHER', amount: 2500, description: 'Офісні витрати', date: new Date('2024-12-20') },
    ];

    await prisma.expense.createMany({ data: expenseData });
    console.log('✅ Created sample expenses');
  }

  // Create integrations
  await prisma.integration.upsert({
    where: { type: 'TELEGRAM' },
    update: {},
    create: {
      type: 'TELEGRAM',
      name: 'Telegram Bot',
      config: JSON.stringify({ botToken: '', chatId: '' }),
      active: false,
    },
  });

  await prisma.integration.upsert({
    where: { type: 'WEBHOOK' },
    update: {},
    create: {
      type: 'WEBHOOK',
      name: 'Webhook API',
      config: JSON.stringify({}),
      active: true,
    },
  });

  // Create webhook token
  await prisma.webhookToken.upsert({
    where: { token: 'demo-webhook-token-change-in-production' },
    update: {},
    create: {
      name: 'Default Webhook',
      token: 'demo-webhook-token-change-in-production',
    },
  });

  console.log('✅ Seeding complete!');
  console.log('');
  console.log('👤 Test accounts:');
  console.log('   Admin:      admin@crm.com    / admin123');
  console.log('   Manager:    manager1@crm.com / manager123');
  console.log('   Viewer:     viewer@crm.com   / viewer123');
  console.log('   Call Center: cc@crm.com      / cc123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
