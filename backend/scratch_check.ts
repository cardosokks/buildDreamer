import { prisma } from './src/db';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      geminiApiKey: true,
      aiProxyUrl: true,
      customAiModels: true
    }
  });
  console.log("USER SETTINGS:");
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error);
