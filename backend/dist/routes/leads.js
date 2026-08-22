"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// ─── ENDPOINTS DO CRM DE VENDAS DE SITES ───
// Garante que a tabela Lead existe com todas as colunas necessárias para o CRM
async function ensureLeadTable() {
    try {
        await db_1.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Lead" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "company" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "website" TEXT,
        "address" TEXT,
        "rating" TEXT,
        "dealValue" DOUBLE PRECISION DEFAULT 0,
        "status" TEXT DEFAULT 'PROSPECT',
        "notes" TEXT,
        "origin" TEXT DEFAULT 'MANUAL',
        "tags" JSONB DEFAULT '[]'::jsonb,
        "lastContactDate" TIMESTAMP,
        "userId" TEXT NOT NULL,
        "projectId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
        // Adiciona colunas se faltarem
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dealValue" DOUBLE PRECISION DEFAULT 0;`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PROSPECT';`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "notes" TEXT;`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "origin" TEXT DEFAULT 'MANUAL';`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '[]'::jsonb;`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastContactDate" TIMESTAMP;`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "projectId" TEXT;`).catch(() => { });
    }
    catch (e) {
        console.warn('[CRM DB] Aviso ao verificar tabela Lead:', e);
    }
}
// 1. Listar todos os leads do CRM do usuário logado (com dados de projeto vinculado se houver)
router.get('/crm', async (req, res) => {
    try {
        await ensureLeadTable();
        const rows = await db_1.prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."userId" = $1
      ORDER BY l."createdAt" DESC;
    `, req.userId);
        return res.json({ leads: rows || [] });
    }
    catch (error) {
        console.error('Erro ao buscar leads do CRM:', error);
        return res.status(500).json({ error: error.message || 'Falha ao buscar leads do CRM' });
    }
});
// 2. Criar ou Salvar Lead no CRM
router.post('/crm', async (req, res) => {
    try {
        await ensureLeadTable();
        const { name, company, phone, email, website, address, rating, dealValue, status, notes, origin, tags, projectId } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Nome do lead/empresa é obrigatório' });
        }
        const id = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const parsedDealValue = typeof dealValue === 'number' ? dealValue : parseFloat(dealValue || '0') || 0;
        const initialStatus = status || 'PROSPECT';
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
        await db_1.prisma.$executeRawUnsafe(`
      INSERT INTO "Lead" (
        "id", "name", "company", "phone", "email", "website", "address", "rating",
        "dealValue", "status", "notes", "origin", "tags", "userId", "projectId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, NOW(), NOW()
      );
    `, id, name.trim(), company ? String(company).trim() : null, phone ? String(phone).trim() : null, email ? String(email).trim() : null, website ? String(website).trim() : null, address ? String(address).trim() : null, rating ? String(rating).trim() : null, parsedDealValue, initialStatus, notes ? String(notes).trim() : null, origin ? String(origin).trim() : 'MANUAL', tagsJson, req.userId, projectId || null);
        const createdRows = await db_1.prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."id" = $1 LIMIT 1
    `, id);
        return res.status(201).json({
            lead: createdRows[0] || { id, name, status: initialStatus, dealValue: parsedDealValue }
        });
    }
    catch (error) {
        console.error('Erro ao criar lead no CRM:', error);
        return res.status(500).json({ error: error.message || 'Erro ao cadastrar lead' });
    }
});
// 3. Atualizar Lead (Status, Valor, Notas, Data de Contato, Projeto Vinculado)
router.put('/crm/:id', async (req, res) => {
    try {
        await ensureLeadTable();
        const { id } = req.params;
        const { name, company, phone, email, website, address, rating, dealValue, status, notes, origin, tags, projectId, lastContactDate } = req.body;
        const fields = ['"updatedAt" = NOW()'];
        const values = [];
        let idx = 1;
        if (name !== undefined) {
            fields.push(`"name" = $${idx++}`);
            values.push(String(name).trim());
        }
        if (company !== undefined) {
            fields.push(`"company" = $${idx++}`);
            values.push(company ? String(company).trim() : null);
        }
        if (phone !== undefined) {
            fields.push(`"phone" = $${idx++}`);
            values.push(phone ? String(phone).trim() : null);
        }
        if (email !== undefined) {
            fields.push(`"email" = $${idx++}`);
            values.push(email ? String(email).trim() : null);
        }
        if (website !== undefined) {
            fields.push(`"website" = $${idx++}`);
            values.push(website ? String(website).trim() : null);
        }
        if (address !== undefined) {
            fields.push(`"address" = $${idx++}`);
            values.push(address ? String(address).trim() : null);
        }
        if (rating !== undefined) {
            fields.push(`"rating" = $${idx++}`);
            values.push(rating ? String(rating).trim() : null);
        }
        if (dealValue !== undefined) {
            fields.push(`"dealValue" = $${idx++}`);
            values.push(typeof dealValue === 'number' ? dealValue : parseFloat(dealValue || '0') || 0);
        }
        if (status !== undefined) {
            fields.push(`"status" = $${idx++}`);
            values.push(status);
        }
        if (notes !== undefined) {
            fields.push(`"notes" = $${idx++}`);
            values.push(notes ? String(notes).trim() : null);
        }
        if (origin !== undefined) {
            fields.push(`"origin" = $${idx++}`);
            values.push(origin ? String(origin).trim() : 'MANUAL');
        }
        if (tags !== undefined) {
            fields.push(`"tags" = $${idx++}::jsonb`);
            values.push(JSON.stringify(Array.isArray(tags) ? tags : []));
        }
        if (projectId !== undefined) {
            fields.push(`"projectId" = $${idx++}`);
            values.push(projectId || null);
        }
        if (lastContactDate !== undefined) {
            fields.push(`"lastContactDate" = $${idx++}`);
            values.push(lastContactDate ? new Date(lastContactDate) : null);
        }
        values.push(id);
        values.push(req.userId);
        await db_1.prisma.$executeRawUnsafe(`
      UPDATE "Lead" SET ${fields.join(', ')} 
      WHERE "id" = $${idx++} AND "userId" = $${idx++};
    `, ...values);
        const updatedRows = await db_1.prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."id" = $1 AND l."userId" = $2 LIMIT 1
    `, id, req.userId);
        return res.json({ lead: updatedRows[0] });
    }
    catch (error) {
        console.error('Erro ao atualizar lead do CRM:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar lead' });
    }
});
// 4. Excluir Lead do CRM
router.delete('/crm/:id', async (req, res) => {
    try {
        await ensureLeadTable();
        const { id } = req.params;
        await db_1.prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "id" = $1 AND "userId" = $2;`, id, req.userId);
        return res.json({ message: 'Lead excluído com sucesso.' });
    }
    catch (error) {
        console.error('Erro ao excluir lead do CRM:', error);
        return res.status(500).json({ error: error.message || 'Erro ao excluir lead' });
    }
});
// 5. Vincular Projeto / Site criado ao Lead do CRM
router.post('/crm/:id/link-project', async (req, res) => {
    try {
        await ensureLeadTable();
        const { id } = req.params;
        const { projectId } = req.body;
        await db_1.prisma.$executeRawUnsafe(`
      UPDATE "Lead" 
      SET "projectId" = $1, "status" = 'PROPOSAL_SENT', "updatedAt" = NOW() 
      WHERE "id" = $2 AND "userId" = $3;
    `, projectId, id, req.userId);
        const updatedRows = await db_1.prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."id" = $1 AND l."userId" = $2 LIMIT 1
    `, id, req.userId);
        return res.json({ lead: updatedRows[0] });
    }
    catch (error) {
        console.error('Erro ao vincular projeto ao lead:', error);
        return res.status(500).json({ error: error.message || 'Erro ao vincular projeto' });
    }
});
// ─── ENDPOINTS DE BUSCADOR DE CLIENTES (SCRAPING / PLACES) ───
router.post('/search-leads', async (req, res) => {
    try {
        const { query, location } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Termo de busca é obrigatório' });
        }
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
        return res.json({ leads: [] });
    }
    catch (error) {
        console.error('Erro na rota /api/leads/search-leads:', error);
        return res.status(500).json({ error: error.message });
    }
});
exports.leadsRouter = router;
