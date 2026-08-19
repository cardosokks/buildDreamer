import { prisma } from '../src/db.ts';

async function resetDB() {
  await prisma.page.updateMany({
    data: {
      html: `<div class="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center">
  <h1 class="text-4xl font-bold mb-4">Bem-vindo ao seu novo site</h1>
  <p class="text-slate-400">Edite este site usando o painel visual ou solicitando mudanças ao Gemini.</p>
</div>`,
      css: `body { margin: 0; font-family: sans-serif; background-color: #0f172a; color: #f8fafc; }`,
      js: `console.log("Página inicial resetada.");`
    }
  });
  console.log("Banco de dados redefinido!");
}

resetDB()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
