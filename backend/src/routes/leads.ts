import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Endpoint mock/integração para busca de estabelecimentos
router.post('/search-leads', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { query, location } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Termo de busca é obrigatório' });
    }

    // Se o usuário configurar uma chave da Foursquare ou Google nas variáveis de ambiente, podemos fazer a chamada real.
    // Foursquare API fornece dados comerciais excelentes e com cotas de testes robustas para o desenvolvedor.
    const fsqApiKey = process.env.FOURSQUARE_API_KEY;
    const cleanLocation = location || 'sua região';

    if (fsqApiKey) {
      try {
        const fsqUrl = new URL('https://api.foursquare.com/v3/places/search');
        fsqUrl.searchParams.append('query', query);
        fsqUrl.searchParams.append('near', cleanLocation);
        fsqUrl.searchParams.append('limit', '15');
        fsqUrl.searchParams.append('fields', 'fsq_id,name,location,tel,website,rating');

        const response = await fetch(fsqUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': fsqApiKey
          }
        });

        if (response.ok) {
          const data = (await response.json()) as { results?: any[] };
          const leads = (data.results || []).map((place: any) => ({
            id: place.fsq_id,
            name: place.name || 'Estabelecimento Sem Nome',
            address: place.location?.formatted_address || 'Endereço não disponível',
            phone: place.tel || 'Telefone não listado',
            website: place.website || null,
            rating: place.rating ? (place.rating / 2).toFixed(1) : '4.2', // converte nota 10 para nota 5
            needsWebsite: !place.website
          }));
          return res.json({ leads });
        }
      } catch (err) {
        console.error('Erro ao chamar Places API da Foursquare, caindo de volta para o mock:', err);
      }
    }

    // Fallback Mock Inteligente com dados realistas baseados na busca do usuário
    const segment = query.toLowerCase();
    let sampleNames = ['Consultório', 'Imobiliária', 'Clínica', 'Restaurante', 'Mecânica', 'Petshop', 'Academia', 'Padaria', 'Salão de Beleza', 'Oficina', 'Hortifruti', 'Supermercado'];
    
    if (segment.includes('advoga') || segment.includes('advocacia')) {
      sampleNames = ['Advocacia Associados', 'Consultoria Jurídica', 'Advogados Parceiros', 'Pinheiro & Advogados', 'Justiça Real', 'Defesa do Cidadão'];
    } else if (segment.includes('pizza') || segment.includes('restaurante') || segment.includes('burg')) {
      sampleNames = ['Pizzaria Napoli', 'Sabor do Chef', 'Burguer & Cia', 'Cantina Bella Italia', 'Food Truck Gourmet', 'Esquina do Lanche', 'Churrascaria Premium'];
    } else if (segment.includes('dente') || segment.includes('dentista') || segment.includes('odonto')) {
      sampleNames = ['Sorriso Perfeito', 'Odonto Clean', 'Clínica Odontológica Integrada', 'Doutor Sorriso', 'Sorrir Mais', 'Estética Dental'];
    } else {
      // Se for um termo qualquer, capitalizar e usar como prefixo
      const capitalized = query.charAt(0).toUpperCase() + query.slice(1);
      sampleNames = [`${capitalized} Central`, `${capitalized} Express`, `${capitalized} & Cia`, `${capitalized} União`, `${capitalized} Progresso`, `${capitalized} Top`];
    }

    // Criar uma semente determinística simples somando os caracteres de query + location para gerar ids e nomes dinâmicos e diferentes a cada busca
    const seed = (query + cleanLocation).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

    const mockLeads = Array.from({ length: 8 }).map((_, index) => {
      const nameIndex = (seed + index) % sampleNames.length;
      const namePrefix = sampleNames[nameIndex];
      const hasWebsite = (seed + index) % 3 === 0; // 33% dos mocks têm site
      const rating = (4.0 + ((seed + index) % 10) * 0.1).toFixed(1);
      return {
        id: `mock-lead-${seed}-${index + 1}`,
        name: `${namePrefix} - ${cleanLocation}`,
        address: `Avenida Principal, ${100 + index * 37} - Bairro Novo, ${cleanLocation}`,
        phone: `(61) 9${3000 + (seed % 6000) + index * 17}-5544`,
        website: hasWebsite ? `https://www.${namePrefix.toLowerCase().replace(/[^a-z]+/g, '')}.com.br` : null,
        rating,
        needsWebsite: !hasWebsite
      };
    });

    return res.json({ leads: mockLeads });

  } catch (error: any) {
    console.error('Erro na rota /api/leads/search-leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

export const leadsRouter = router;
