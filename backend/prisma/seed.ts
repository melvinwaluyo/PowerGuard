import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.usageLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.geofenceSetting.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.powerStrip.deleteMany();

  // Reset auto-increment sequences to start from 1
  await prisma.$executeRawUnsafe('ALTER SEQUENCE powerstrip_powerstripid_seq RESTART WITH 1');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE outlet_outletid_seq RESTART WITH 1');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE usagelog_usageid_seq RESTART WITH 1');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE notificationlog_notificationid_seq RESTART WITH 1');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE geofencesetting_settingid_seq RESTART WITH 1');

  console.log('🗑️  Cleared existing data and reset sequences');

  // Create 1 PowerStrip
  const powerstrip = await prisma.powerStrip.create({
    data: {
      name: 'PowerGuard Main Strip',
      macAddress: 123456789,
    },
  });

  console.log(`✅ Created PowerStrip: ${powerstrip.name} (ID: ${powerstrip.powerstripID})`);

  // Create 4 Outlets
  for (let i = 0; i < 4; i++) {
    const outlet = await prisma.outlet.create({
      data: {
        powerstripID: powerstrip.powerstripID,
        index: i + 1,
        name: `Outlet ${i + 1}`,
        state: false, // All outlets start OFF
        timer: null,
        runtime: 0,
      },
    });

    console.log(`✅ Created Outlet ${i + 1}: ${outlet.name} (ID: ${outlet.outletID})`);
  }

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
