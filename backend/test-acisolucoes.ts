import https from 'https';
import http from 'http';

function fetchRaw(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      rejectUnauthorized: false,
      timeout: 10000
    }, (res) => {
      // Seguir redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const u = new URL(url);
          redirectUrl = `${u.origin}${redirectUrl}`;
        }
        return fetchRaw(redirectUrl).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de requisição'));
    });
  });
}

async function test() {
  console.log("Testando conexão direta com https://www.acisolucoes.com.br e http://acisolucoes.com.br ...");
  try {
    const html1 = await fetchRaw('https://acisolucoes.com.br');
    console.log("Sucesso com https://acisolucoes.com.br! Tamanho HTML:", html1.length);
  } catch (err: any) {
    console.log("Erro no https://acisolucoes.com.br:", err.message);
  }

  try {
    const html2 = await fetchRaw('http://www.acisolucoes.com.br');
    console.log("Sucesso com http://www.acisolucoes.com.br! Tamanho HTML:", html2.length);
  } catch (err: any) {
    console.log("Erro no http://www.acisolucoes.com.br:", err.message);
  }
}

test();
