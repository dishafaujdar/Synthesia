// Database seeding script for development
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample research requests for development
  const sampleRequests = [
    {
      topic: 'Machine Learning Trends 2024',
      priority: 'high',
      status: 'COMPLETED' as const,
    },
    {
      topic: 'Renewable Energy Technologies',
      priority: 'normal' as const,
      status: 'PROCESSING' as const,
    },
    {
      topic: 'Quantum Computing Applications',
      priority: 'low' as const,
      status: 'PENDING' as const,
    },
  ];

  for (const requestData of sampleRequests) {
    const request = await prisma.researchRequest.create({
      data: {
        ...requestData,
        correlationId: `seed-${Date.now()}-${Math.random()}`,
      },
    });
    
    console.log(`Created sample request: ${request.topic}`);
  }

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
