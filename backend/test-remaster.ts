import { crawlEntireClientWebsite } from './src/services/siteRemaster';

async function main() {
  console.log("=== INICIANDO TESTE DO CRAWLER DE SITE ===");
  try {
    const pages = await crawlEntireClientWebsite('https://www.acisolucoes.com.br', 4);
    console.log("Total de páginas encontradas:", pages.length);
    for (const p of pages) {
      console.log(`Página: ${p.name} | Slug: ${p.slug} | URL: ${p.url} | Caracteres: ${p.cleanText.length}`);
      console.log("Trecho extraído:", p.cleanText.slice(0, 150));
      console.log("-----------------------------------------");
    }
  } catch (err: any) {
    console.error("Erro no crawler:", err);
  }
}

main();
