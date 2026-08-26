import { prisma } from './src/db';

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      pages: true,
      members: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("PROJECTS STATUS:");
  console.log(JSON.stringify(projects, null, 2));
}

main().catch(console.error);
