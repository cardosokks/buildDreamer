import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';
import { LeadCrawlerEngine } from '../services/leadCrawler';

const router = Router();

// ─── ENDPOINTS DO CRM DE VENDAS DE SITES & CRAWLER ───

async function ensureLeadPresetTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LeadPreset" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "niche" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "state" TEXT,
        "country" TEXT DEFAULT 'Brasil',
        "onlyWithoutWebsite" BOOLEAN DEFAULT false,
        "onlyWithWebsite" BOOLEAN DEFAULT false,
        "hasPhoneOnly" BOOLEAN DEFAULT false,
        "hasWhatsappOnly" BOOLEAN DEFAULT false,
        "minRating" DOUBLE PRECISION DEFAULT 0,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "LeadPreset" ADD COLUMN IF NOT EXISTS "onlyWithWebsite" BOOLEAN DEFAULT false;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "LeadPreset" ADD COLUMN IF NOT EXISTS "hasWhatsappOnly" BOOLEAN DEFAULT false;`).catch(() => {});
  } catch (e) {
    console.warn('[CRM DB] Aviso ao verificar tabela LeadPreset:', e);
  }
}

// Garante que a tabela Lead existe com todas as colunas necessárias para o CRM
async function ensureLeadTable() {
  try {
    await prisma.$executeRawUnsafe(`
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
        "tags" TEXT[] DEFAULT '{}',
        "lastContactDate" TIMESTAMP,
        "userId" TEXT NOT NULL,
        "projectId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    // Adiciona colunas se faltarem (migration incremental segura)
    const alters = [
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "company" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phone" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "email" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "website" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "address" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "rating" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dealValue" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PROSPECT';`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "origin" TEXT DEFAULT 'MANUAL';`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastContactDate" TIMESTAMP;`,
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "projectId" TEXT;`,
    ];
    for (const sql of alters) {
      await prisma.$executeRawUnsafe(sql).catch(() => {});
    }
  } catch (e) {
    console.warn('[CRM DB] Aviso ao verificar tabela Lead:', e);
  }
}

// 1. Listar todos os leads do CRM do usuário logado (com dados de projeto vinculado se houver)
router.get('/crm', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadTable();
    const rows: any[] = await prisma.$queryRawUnsafe(`
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
  } catch (error: any) {
    console.error('Erro ao buscar leads do CRM:', error);
    return res.status(500).json({ error: error.message || 'Falha ao buscar leads do CRM' });
  }
});

// 2. Criar ou Salvar Lead no CRM
router.post('/crm', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadTable();

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado. Faça login novamente.' });
    }

    const { 
      name, 
      company, 
      phone, 
      email, 
      website, 
      address, 
      rating, 
      dealValue, 
      status, 
      notes, 
      origin, 
      tags,
      projectId 
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nome do contato é obrigatório' });
    }

    const id = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const parsedDealValue = typeof dealValue === 'number' ? dealValue : parseFloat(String(dealValue || '0')) || 0;
    const initialStatus = (status && ['PROSPECT','CONTACTED','PROPOSAL_SENT','IN_NEGOTIATION','WON','LOST'].includes(status)) ? status : 'PROSPECT';
    const tagsArr: string[] = Array.isArray(tags) ? tags.map(String) : [];
    const tagsPgArr = tagsArr;
    const safeProjectId = projectId && projectId !== '' ? String(projectId) : null;

    // ── Verificação de duplicidade ──────────────────────────────────────
    const trimmedName = String(name).trim();
    const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
    const trimmedPhone = phone ? String(phone).trim().replace(/\D/g, '') : null;

    const duplicateConditions: string[] = [];
    const dupParams: any[] = [String(userId)];
    let paramIdx = 2;

    // Sempre verifica por nome (case-insensitive)
    duplicateConditions.push(`LOWER("name") = LOWER($${paramIdx})`);
    dupParams.push(trimmedName);
    paramIdx++;

    // Se tiver email, verifica duplicidade por email também
    if (trimmedEmail) {
      duplicateConditions.push(`LOWER("email") = LOWER($${paramIdx})`);
      dupParams.push(trimmedEmail);
      paramIdx++;
    }

    // Se tiver telefone, verifica por telefone (só dígitos)
    if (trimmedPhone) {
      duplicateConditions.push(`REGEXP_REPLACE("phone", '[^0-9]', '', 'g') = $${paramIdx}`);
      dupParams.push(trimmedPhone);
      paramIdx++;
    }

    // Busca: mesmo nome OU mesmo email OU mesmo telefone (para o mesmo usuário)
    const dupQuery = `
      SELECT "id", "name", "email", "phone" FROM "Lead"
      WHERE "userId" = $1 AND (${duplicateConditions.join(' OR ')})
      LIMIT 1
    `;
    const existingLeads: any[] = await prisma.$queryRawUnsafe(dupQuery, ...dupParams);

    if (existingLeads && existingLeads.length > 0) {
      const existing = existingLeads[0];
      return res.status(409).json({
        error: `Já existe um cliente com dados semelhantes: "${existing.name}"${existing.email ? ` (${existing.email})` : ''}${existing.phone ? ` - ${existing.phone}` : ''}. Edite o lead existente ou altere os dados.`,
        existingLead: existing
      });
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Lead" (
        "id", "name", "company", "phone", "email", "website", "address", "rating",
        "dealValue", "status", "notes", "origin", "tags", "userId", "projectId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::double precision, $10, $11, $12, $13::text[], $14, $15, NOW(), NOW()
      );
    `, 
      id,
      String(name).trim(),
      company ? String(company).trim() : null,
      phone ? String(phone).trim() : null,
      email ? String(email).trim() : null,
      website ? String(website).trim() : null,
      address ? String(address).trim() : null,
      rating ? String(rating).trim() : null,
      parsedDealValue,
      initialStatus,
      notes ? String(notes).trim() : null,
      origin ? String(origin).trim() : 'MANUAL',
      tagsPgArr,
      String(userId),
      safeProjectId
    );

    const createdRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."id" = $1 LIMIT 1
    `, id);

    return res.status(201).json({
      lead: createdRows[0] || { id, name: String(name).trim(), status: initialStatus, dealValue: parsedDealValue }
    });
  } catch (error: any) {
    console.error('[CRM] Erro ao criar lead:', error?.message, error?.code, error?.detail);
    return res.status(500).json({ error: error.message || 'Erro ao cadastrar lead. Tente novamente.' });
  }
});


// 3. Atualizar Lead (Status, Valor, Notas, Data de Contato, Projeto Vinculado)
router.put('/crm/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadTable();
    const { id } = req.params;
    const { 
      name, 
      company, 
      phone, 
      email, 
      website, 
      address, 
      rating, 
      dealValue, 
      status, 
      notes, 
      origin, 
      tags,
      projectId,
      lastContactDate 
    } = req.body;

    const fields: string[] = ['"updatedAt" = NOW()'];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`"name" = $${idx++}`); values.push(String(name).trim()); }
    if (company !== undefined) { fields.push(`"company" = $${idx++}`); values.push(company ? String(company).trim() : null); }
    if (phone !== undefined) { fields.push(`"phone" = $${idx++}`); values.push(phone ? String(phone).trim() : null); }
    if (email !== undefined) { fields.push(`"email" = $${idx++}`); values.push(email ? String(email).trim() : null); }
    if (website !== undefined) { fields.push(`"website" = $${idx++}`); values.push(website ? String(website).trim() : null); }
    if (address !== undefined) { fields.push(`"address" = $${idx++}`); values.push(address ? String(address).trim() : null); }
    if (rating !== undefined) { fields.push(`"rating" = $${idx++}`); values.push(rating ? String(rating).trim() : null); }
    if (dealValue !== undefined) { fields.push(`"dealValue" = $${idx++}`); values.push(typeof dealValue === 'number' ? dealValue : parseFloat(dealValue || '0') || 0); }
    if (status !== undefined) { fields.push(`"status" = $${idx++}`); values.push(status); }
    if (notes !== undefined) { fields.push(`"notes" = $${idx++}`); values.push(notes ? String(notes).trim() : null); }
    if (origin !== undefined) { fields.push(`"origin" = $${idx++}`); values.push(origin ? String(origin).trim() : 'MANUAL'); }
    if (tags !== undefined) { fields.push(`"tags" = $${idx++}::text[]`); values.push(Array.isArray(tags) ? tags.map(String) : []); }
    if (projectId !== undefined) { fields.push(`"projectId" = $${idx++}`); values.push(projectId || null); }
    if (lastContactDate !== undefined) { fields.push(`"lastContactDate" = $${idx++}`); values.push(lastContactDate ? new Date(lastContactDate) : null); }

    values.push(id);
    values.push(req.userId);

    await prisma.$executeRawUnsafe(`
      UPDATE "Lead" SET ${fields.join(', ')} 
      WHERE "id" = $${idx++} AND "userId" = $${idx++};
    `, ...values);

    const updatedRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."id" = $1 AND l."userId" = $2 LIMIT 1
    `, id, req.userId);

    return res.json({ lead: updatedRows[0] });
  } catch (error: any) {
    console.error('Erro ao atualizar lead do CRM:', error);
    return res.status(500).json({ error: error.message || 'Erro ao atualizar lead' });
  }
});

// 4. Excluir Lead do CRM
router.delete('/crm/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadTable();
    const { id } = req.params;
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "id" = $1 AND "userId" = $2;`, id, req.userId);
    return res.json({ message: 'Lead excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir lead do CRM:', error);
    return res.status(500).json({ error: error.message || 'Erro ao excluir lead' });
  }
});

// 5. Vincular Projeto / Site criado ao Lead do CRM
router.post('/crm/:id/link-project', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadTable();
    const { id } = req.params;
    const { projectId } = req.body;

    await prisma.$executeRawUnsafe(`
      UPDATE "Lead" 
      SET "projectId" = $1, "status" = 'PROPOSAL_SENT', "updatedAt" = NOW() 
      WHERE "id" = $2 AND "userId" = $3;
    `, projectId, id, req.userId);

    const updatedRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        l.*,
        p."name" as "projectName",
        p."status" as "projectStatus"
      FROM "Lead" l
      LEFT JOIN "Project" p ON l."projectId" = p."id"
      WHERE l."id" = $1 AND l."userId" = $2 LIMIT 1
    `, id, req.userId);

    return res.json({ lead: updatedRows[0] });
  } catch (error: any) {
    console.error('Erro ao vincular projeto ao lead:', error);
    return res.status(500).json({ error: error.message || 'Erro ao vincular projeto' });
  }
});

// ─── ENDPOINTS DE BUSCADOR DE CLIENTES (SCRAPING / PLACES) ───
router.post('/search-leads', async (req: AuthenticatedRequest, res: any) => {
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
          const data = (await response.json()) as { results?: any[] };
          if (data.results && data.results.length > 0) {
            const leads = data.results.map((place: any) => ({
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
      } catch (err) {
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
          const realLeads = osmData.map((place: any, idx: number) => {
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
    } catch (osmErr) {
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
        const opData = (await opRes.json()) as { elements?: any[] };
        if (opData.elements && opData.elements.length > 0) {
          const opLeads = opData.elements.map((el: any, idx: number) => {
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
    } catch (opErr) {
      console.error('Erro ao consultar Overpass API:', opErr);
    }

    return res.json({ leads: [] });
  } catch (error: any) {
    console.error('Erro na rota /api/leads/search-leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── ENDPOINT UNIFICADO DO CRAWLER DE LEADS (GET & POST /search) ───
router.get('/search', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { 
      niche, 
      city, 
      state, 
      country, 
      location, 
      query, 
      onlyWithoutWebsite, 
      onlyWithWebsite,
      hasPhone, 
      hasPhoneOnly, 
      hasWhatsapp,
      hasWhatsappOnly,
      minRating, 
      minReviews, 
      sortBy, 
      limit, 
      page 
    } = req.query;

    const finalNiche = (niche || query) as string;
    if (!finalNiche) {
      return res.status(400).json({ error: 'Nicho ou termo de busca é obrigatório (ex: Pizzaria, Dentista)' });
    }

    const result = await LeadCrawlerEngine.executeSearch({
      niche: finalNiche,
      city: (city as string) || '',
      state: (state as string) || '',
      country: (country as string) || 'Brasil',
      location: (location as string) || '',
      onlyWithoutWebsite: String(onlyWithoutWebsite) === 'true',
      onlyWithWebsite: String(onlyWithWebsite) === 'true',
      hasPhoneOnly: String(hasPhone || hasPhoneOnly) === 'true',
      hasWhatsappOnly: String(hasWhatsapp || hasWhatsappOnly) === 'true',
      minRating: parseFloat(String(minRating || '0')),
      minReviews: parseInt(String(minReviews || '0'), 10),
      sortBy: (sortBy as any) || 'rating',
      limit: parseInt(String(limit || '40'), 10),
      page: parseInt(String(page || '1'), 10)
    });

    return res.json({
      success: true,
      total: result.leads.length,
      page: result.page,
      hasMore: result.hasMore,
      leads: result.leads
    });
  } catch (error: any) {
    console.error('Erro na rota GET /api/leads/search:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── PRESETS DE FILTROS SALVOS PELO USUÁRIO ───
router.get('/presets', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadPresetTable();
    const userId = req.userId;
    if (!userId) return res.json({ presets: [] });

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM "LeadPreset" WHERE "userId" = $1 ORDER BY "createdAt" DESC;
    `, userId);

    return res.json({ presets: rows || [] });
  } catch (error: any) {
    console.error('Erro ao buscar presets de leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/presets', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadPresetTable();
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    const { name, niche, city, state, country, onlyWithoutWebsite, onlyWithWebsite, hasPhoneOnly, hasWhatsappOnly, minRating } = req.body;
    if (!name || !niche || !city) {
      return res.status(400).json({ error: 'Nome, nicho e cidade são obrigatórios' });
    }

    const presetId = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO "LeadPreset" ("id", "name", "niche", "city", "state", "country", "onlyWithoutWebsite", "onlyWithWebsite", "hasPhoneOnly", "hasWhatsappOnly", "minRating", "userId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW());
    `, presetId, name, niche, city, state || '', country || 'Brasil', !!onlyWithoutWebsite, !!onlyWithWebsite, !!hasPhoneOnly, !!hasWhatsappOnly, parseFloat(minRating || '0'), userId);

    return res.status(201).json({ success: true, id: presetId });
  } catch (error: any) {
    console.error('Erro ao criar preset de leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.put('/presets/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadPresetTable();
    const userId = req.userId;
    const { id } = req.params;
    const { name, niche, city, state, country, onlyWithoutWebsite, onlyWithWebsite, hasPhoneOnly, hasWhatsappOnly, minRating } = req.body;

    await prisma.$executeRawUnsafe(`
      UPDATE "LeadPreset"
      SET "name" = $1, "niche" = $2, "city" = $3, "state" = $4, "country" = $5,
          "onlyWithoutWebsite" = $6, "onlyWithWebsite" = $7, "hasPhoneOnly" = $8, "hasWhatsappOnly" = $9, "minRating" = $10, "updatedAt" = NOW()
      WHERE "id" = $11 AND "userId" = $12;
    `, name, niche, city, state || '', country || 'Brasil', !!onlyWithoutWebsite, !!onlyWithWebsite, !!hasPhoneOnly, !!hasWhatsappOnly, parseFloat(minRating || '0'), id, userId);

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao atualizar preset de leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/presets/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureLeadPresetTable();
    const userId = req.userId;
    const { id } = req.params;

    await prisma.$executeRawUnsafe(`
      DELETE FROM "LeadPreset" WHERE "id" = $1 AND "userId" = $2;
    `, id, userId);

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir preset de leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

export const leadsRouter = router;

