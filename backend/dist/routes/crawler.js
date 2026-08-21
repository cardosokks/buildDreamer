"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlerRouter = void 0;
const express_1 = require("express");
const leadCrawler_1 = require("../services/leadCrawler");
const router = (0, express_1.Router)();
// Endpoint de Crawler Autônomo para Busca de Estabelecimentos e Leads
router.post('/search', async (req, res) => {
    try {
        const { niche, city, state, country, location, query, onlyWithoutWebsite, hasPhoneOnly, minRating, limit } = req.body;
        const finalNiche = niche || query;
        if (!finalNiche) {
            return res.status(400).json({ error: 'Nicho ou termo de busca é obrigatório (ex: Supermercado, Pizzaria, Dentista)' });
        }
        const leads = await leadCrawler_1.LeadCrawlerEngine.executeSearch({
            niche: finalNiche,
            city: city || '',
            state: state || '',
            country: country || 'Brasil',
            location: location || '',
            onlyWithoutWebsite: onlyWithoutWebsite === true || onlyWithoutWebsite === 'true',
            hasPhoneOnly: hasPhoneOnly === true || hasPhoneOnly === 'true',
            minRating: parseFloat(minRating || '0'),
            limit: parseInt(limit || '40', 10)
        });
        return res.json({
            success: true,
            total: leads.length,
            leads
        });
    }
    catch (error) {
        console.error('Erro na rota /api/crawler/search:', error);
        return res.status(500).json({ error: error.message || 'Erro ao executar crawler de leads' });
    }
});
exports.crawlerRouter = router;
