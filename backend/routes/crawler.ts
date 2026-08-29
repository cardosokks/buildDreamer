import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { LeadCrawlerEngine } from '../services/leadCrawler';

const router = Router();

// Endpoint de Crawler Autônomo para Busca de Estabelecimentos e Leads
router.post('/search', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { niche, city, state, country, location, query, onlyWithoutWebsite, hasPhoneOnly, minRating, limit, page } = req.body;
    const finalNiche = niche || query;

    if (!finalNiche) {
      return res.status(400).json({ error: 'Nicho ou termo de busca é obrigatório (ex: Supermercado, Pizzaria, Dentista)' });
    }

    const result = await LeadCrawlerEngine.executeSearch({
      niche: finalNiche,
      city: city || '',
      state: state || '',
      country: country || 'Brasil',
      location: location || '',
      onlyWithoutWebsite: onlyWithoutWebsite === true || onlyWithoutWebsite === 'true',
      hasPhoneOnly: hasPhoneOnly === true || hasPhoneOnly === 'true',
      minRating: parseFloat(minRating || '0'),
      limit: parseInt(limit || '40', 10),
      page: parseInt(page || '1', 10)
    });

    return res.json({
      success: true,
      total: result.leads.length,
      page: result.page,
      hasMore: result.hasMore,
      leads: result.leads
    });
  } catch (error: any) {
    console.error('Erro na rota /api/crawler/search:', error);
    return res.status(500).json({ error: error.message || 'Erro ao executar crawler de leads' });
  }
});

export const crawlerRouter = router;
