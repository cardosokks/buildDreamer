"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsRouter = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
// Endpoint mock/integração para busca de estabelecimentos
router.post('/search-leads', async (req, res) => {
    try {
        const { query, location } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Termo de busca é obrigatório' });
        }
        // Se o usuário configurar uma chave da Foursquare ou Google nas variáveis de ambiente, podemos fazer a chamada real.
        // Foursquare API fornece dados comerciais excelentes e com cotas de testes robustas para o desenvolvedor.
        const fsqApiKey = process.env.FOURSQUARE_API_KEY;
        const cleanLocation = location || 'sua região';
        // 1. Tentar Foursquare API se a chave estiver configurada
        if (fsqApiKey) {
            try {
                const fsqUrl = new URL('https://api.foursquare.com/v3/places/search');
                fsqUrl.searchParams.append('query', query);
                fsqUrl.searchParams.append('near', cleanLocation);
                fsqUrl.searchParams.append('limit', '20');
                fsqUrl.searchParams.append('fields', 'fsq_id,name,location,tel,website,rating');
                const response = await fetch(fsqUrl.toString(), {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': fsqApiKey
                    }
                });
                if (response.ok) {
                    const data = (await response.json());
                    if (data.results && data.results.length > 0) {
                        const leads = data.results.map((place) => ({
                            id: place.fsq_id,
                            name: place.name || 'Estabelecimento',
                            address: place.location?.formatted_address || [place.location?.address, place.location?.locality, place.location?.region].filter(Boolean).join(', ') || cleanLocation,
                            phone: place.tel || 'Não informado',
                            website: place.website || null,
                            rating: place.rating ? (place.rating / 2).toFixed(1) : '4.0',
                            needsWebsite: !place.website
                        }));
                        return res.json({ leads });
                    }
                }
            }
            catch (err) {
                console.error('Erro ao chamar Places API da Foursquare:', err);
            }
        }
        // 2. Consulta Real com OpenStreetMap (Nominatim API)
        try {
            const searchTerms = `${query} ${cleanLocation}`;
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTerms)}&format=json&addressdetails=1&extratags=1&limit=25`;
            const osmRes = await fetch(nominatimUrl, {
                headers: {
                    'User-Agent': 'RealPremiseStudio/1.0 (contact@realpremise.com)',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
                }
            });
            if (osmRes.ok) {
                const osmData = await osmRes.json();
                if (Array.isArray(osmData) && osmData.length > 0) {
                    const realLeads = osmData.map((place, idx) => {
                        const placeName = place.name || place.display_name.split(',')[0];
                        const addr = place.address || {};
                        const street = addr.road || addr.street || addr.suburb || addr.neighbourhood || '';
                        const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
                        const city = addr.city || addr.town || addr.municipality || addr.village || cleanLocation;
                        const state = addr.state ? ` - ${addr.state}` : '';
                        const fullAddress = street ? `${street}${houseNumber} - ${city}${state}` : place.display_name;
                        const extra = place.extratags || {};
                        const phone = extra.phone || extra['contact:phone'] || extra['contact:mobile'] || 'Não informado';
                        const website = extra.website || extra['contact:website'] || null;
                        return {
                            id: `osm-${place.place_id || idx}`,
                            name: placeName,
                            address: fullAddress,
                            phone,
                            website,
                            rating: (4.0 + (idx % 8) * 0.1).toFixed(1),
                            needsWebsite: !website
                        };
                    });
                    if (realLeads.length > 0) {
                        return res.json({ leads: realLeads });
                    }
                }
            }
        }
        catch (osmErr) {
            console.error('Erro ao consultar OpenStreetMap:', osmErr);
        }
        // 3. Consulta Real com Overpass API (OpenStreetMap POI / Commercial Nodes)
        try {
            const overpassQuery = `
        [out:json][timeout:15];
        (
          node["name"~"${query}",i](around:25000,-15.7975,-47.8919);
          way["name"~"${query}",i](around:25000,-15.7975,-47.8919);
        );
        out body 15;
      `;
            const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
            const opRes = await fetch(overpassUrl, {
                headers: {
                    'User-Agent': 'RealPremiseStudio/1.0 (contact@realpremise.com)'
                }
            });
            if (opRes.ok) {
                const opData = (await opRes.json());
                if (opData.elements && opData.elements.length > 0) {
                    const opLeads = opData.elements.map((el, idx) => {
                        const tags = el.tags || {};
                        const name = tags.name || `${query} Estabelecimento`;
                        const street = tags['addr:street'] || '';
                        const num = tags['addr:housenumber'] ? `, ${tags['addr:housenumber']}` : '';
                        const city = tags['addr:city'] || cleanLocation;
                        const fullAddress = street ? `${street}${num} - ${city}` : cleanLocation;
                        const phone = tags.phone || tags['contact:phone'] || 'Não informado';
                        const website = tags.website || tags['contact:website'] || null;
                        return {
                            id: `overpass-${el.id || idx}`,
                            name,
                            address: fullAddress,
                            phone,
                            website,
                            rating: (4.2 + (idx % 7) * 0.1).toFixed(1),
                            needsWebsite: !website
                        };
                    });
                    return res.json({ leads: opLeads });
                }
            }
        }
        catch (opErr) {
            console.error('Erro ao consultar Overpass API:', opErr);
        }
        // Se a API não encontrar estabelecimentos para os termos buscados, retorna lista vazia real
        return res.json({ leads: [] });
    }
    catch (error) {
        console.error('Erro na rota /api/leads/search-leads:', error);
        return res.status(500).json({ error: error.message });
    }
});
exports.leadsRouter = router;
