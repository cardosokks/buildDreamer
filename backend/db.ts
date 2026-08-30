import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

interface MockUser {
  id: string;
  email: string;
  password: string;
  name?: string | null;
  role?: string;
  geminiApiKey?: string | null;
  openaiApiKey?: string | null;
  aiProxyUrl?: string | null;
  ngrokAuthToken?: string | null;
  customAiSkills?: any;
  customAiModels?: any;
  savedLeads?: any;
  filterPresets?: any;
  createdAt: Date;
}

interface MockLead {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  rating?: string | null;
  dealValue: number;
  status: string;
  notes?: string | null;
  origin?: string | null;
  tags: string[];
  lastContactDate?: Date | null;
  userId: string;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockProject {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  domain?: string | null;
  favicon?: string | null;
  navbarHtml: string;
  footerHtml: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockProjectMember {
  id: string;
  role: string;
  userId: string;
  projectId: string;
}

interface MockPage {
  id: string;
  name: string;
  slug: string;
  title?: string | null;
  description?: string | null;
  html: string;
  css: string;
  js: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isHomepage: boolean;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockMedia {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  userId: string;
  storage?: string;
  createdAt: Date;
}

export interface MockMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderRole?: string;
  recipientId: string; // 'ALL' or user ID
  content: string;
  type: 'text' | 'audio' | 'image' | 'file';
  mediaUrl?: string | null;
  duration?: number | null; // audio duration in seconds
  fileName?: string | null;
  fileSize?: number | null;
  read: boolean;
  createdAt: Date;
}

interface MockVersion {
  id: string;
  name: string;
  description?: string | null;
  snapshot: any;
  projectId: string;
  createdAt: Date;
}

class InMemoryDatabase {
  users: Map<string, MockUser> = new Map();
  leads: Map<string, MockLead> = new Map();
  projects: Map<string, MockProject> = new Map();
  projectMembers: Map<string, MockProjectMember> = new Map();
  pages: Map<string, MockPage> = new Map();
  versions: Map<string, MockVersion> = new Map();
  messages: Map<string, MockMessage> = new Map();
  medias: Map<string, MockMedia> = new Map();

  private dbPath = path.join(process.cwd(), 'backend', 'data', 'db.json');

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        this.users = new Map(Object.entries(data.users));
        this.leads = new Map(Object.entries(data.leads));
        this.projects = new Map(Object.entries(data.projects));
        this.projectMembers = new Map(Object.entries(data.projectMembers));
        this.pages = new Map(Object.entries(data.pages));
        this.medias = new Map(Object.entries(data.medias));
        this.versions = new Map(Object.entries(data.versions));
        this.messages = new Map(Object.entries(data.messages));
      } catch (err) {
        console.error('Failed to load DB, starting fresh:', err);
      }
    }
  }

  private save() {
    const data = {
      users: Object.fromEntries(this.users),
      leads: Object.fromEntries(this.leads),
      projects: Object.fromEntries(this.projects),
      projectMembers: Object.fromEntries(this.projectMembers),
      pages: Object.fromEntries(this.pages),
      medias: Object.fromEntries(this.medias),
      versions: Object.fromEntries(this.versions),
      messages: Object.fromEntries(this.messages),
    };
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  user = {
    findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
      let list = Array.from(this.users.values());
      if (where) {
        if (where.role) list = list.filter(u => u.role === where.role);
      }
      return list.map(u => {
        const { password, ...safeUser } = u;
        return safeUser;
      });
    },
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
      for (const u of this.users.values()) {
        if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) return { ...u };
        if (where.id && u.id === where.id) return { ...u };
      }
      return null;
    },
    findFirst: async ({ where }: { where?: any } = {}) => {
      for (const u of this.users.values()) {
        if (!where) return { ...u };
        if (where.id && u.id !== where.id) continue;
        if (where.email && u.email.toLowerCase() !== where.email.toLowerCase()) continue;
        return { ...u };
      }
      return null;
    },
    count: async () => this.users.size,
    create: async ({ data }: { data: any }) => {
      const id = data.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const user: MockUser = {
        id,
        email: data.email,
        password: data.password,
        name: data.name || data.email.split('@')[0],
        role: data.role || (this.users.size === 0 ? 'ADMIN' : 'USER'),
        geminiApiKey: data.geminiApiKey || null,
        openaiApiKey: data.openaiApiKey || null,
        aiProxyUrl: data.aiProxyUrl || null,
        ngrokAuthToken: data.ngrokAuthToken || null,
        customAiSkills: data.customAiSkills || null,
        customAiModels: data.customAiModels || null,
        savedLeads: data.savedLeads || null,
        filterPresets: data.filterPresets || null,
        createdAt: new Date()
      };
      this.users.set(id, user);
      return { ...user };
    },
    update: async ({ where, data }: { where: { id?: string; email?: string }; data: any }) => {
      let user: MockUser | undefined;
      for (const u of this.users.values()) {
        if (where.id && u.id === where.id) { user = u; break; }
        if (where.email && u.email === where.email) { user = u; break; }
      }
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      return { ...user };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const u = this.users.get(where.id);
      if (u) {
        this.users.delete(where.id);
        return { ...u };
      }
      return null;
    }
  };

  message = {
    findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
      let list = Array.from(this.messages.values());
      if (where) {
        if (where.recipientId) {
          if (where.recipientId === 'ALL') {
            list = list.filter(m => m.recipientId === 'ALL');
          } else if (where.senderId) {
            // direct 1-to-1 conversation between user A and user B
            list = list.filter(m => 
              (m.senderId === where.senderId && m.recipientId === where.recipientId) ||
              (m.senderId === where.recipientId && m.recipientId === where.senderId)
            );
          } else {
            list = list.filter(m => m.recipientId === where.recipientId || m.recipientId === 'ALL');
          }
        }
      }
      list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return list.map(m => ({ ...m }));
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const msg: MockMessage = {
        id,
        senderId: data.senderId,
        senderName: data.senderName || 'Usuário',
        senderEmail: data.senderEmail,
        senderRole: data.senderRole || 'USER',
        recipientId: data.recipientId || 'ALL',
        content: data.content || '',
        type: data.type || 'text',
        mediaUrl: data.mediaUrl || null,
        duration: data.duration || null,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        read: data.read || false,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
      };
      this.messages.set(id, msg);
      return { ...msg };
    },
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      for (const m of this.messages.values()) {
        if (where.recipientId && m.recipientId === where.recipientId && where.senderId && m.senderId === where.senderId) {
          Object.assign(m, data);
          count++;
        }
      }
      return { count };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const msg = this.messages.get(where.id);
      if (msg) {
        this.messages.delete(where.id);
        return { ...msg };
      }
      return null;
    }
  };

  project = {
    findMany: async ({ where, include }: { where?: any; include?: any } = {}) => {
      const results: any[] = [];
      const userId = where?.members?.some?.userId;

      for (const proj of this.projects.values()) {
        if (userId) {
          const isMember = Array.from(this.projectMembers.values()).some(
            m => m.projectId === proj.id && m.userId === userId
          );
          if (!isMember) continue;
        }

        const projectCopy: any = { ...proj };
        if (include?.pages) {
          projectCopy.pages = Array.from(this.pages.values())
            .filter(p => p.projectId === proj.id)
            .map(p => ({ ...p }));
        }
        if (include?.assets) {
          projectCopy.assets = [];
        }
        results.push(projectCopy);
      }
      return results;
    },
    findFirst: async ({ where, include }: { where: any; include?: any }) => {
      const id = where.id;
      const userId = where.members?.some?.userId;
      const proj = id ? this.projects.get(id) : Array.from(this.projects.values())[0];
      if (!proj) return null;

      if (userId) {
        const isMember = Array.from(this.projectMembers.values()).some(
          m => m.projectId === proj.id && m.userId === userId
        );
        if (!isMember) return null;
      }

      const copy: any = { ...proj };
      if (include?.pages) {
        copy.pages = Array.from(this.pages.values())
          .filter(p => p.projectId === proj.id)
          .map(p => ({ ...p }));
      }
      if (include?.assets) {
        copy.assets = [];
      }
      return copy;
    },
    findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
      const proj = this.projects.get(where.id);
      if (!proj) return null;
      const copy: any = { ...proj };
      if (include?.pages) {
        copy.pages = Array.from(this.pages.values())
          .filter(p => p.projectId === proj.id)
          .map(p => ({ ...p }));
      }
      return copy;
    },
    create: async ({ data, include }: { data: any; include?: any }) => {
      const id = data.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date();
      const proj: MockProject = {
        id,
        name: data.name,
        description: data.description || null,
        status: data.status || 'development',
        domain: data.domain || null,
        favicon: data.favicon || null,
        navbarHtml: data.navbarHtml || '',
        footerHtml: data.footerHtml || '',
        createdAt: now,
        updatedAt: now
      };
      this.projects.set(id, proj);

      if (data.members?.create) {
        const m = data.members.create;
        const memId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.projectMembers.set(memId, {
          id: memId,
          role: m.role || 'OWNER',
          userId: m.userId,
          projectId: id
        });
      }

      const createdPages: MockPage[] = [];
      if (data.pages?.create) {
        const pagesToCreate = Array.isArray(data.pages.create) ? data.pages.create : [data.pages.create];
        for (const p of pagesToCreate) {
          const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const pageObj: MockPage = {
            id: pageId,
            name: p.name || 'Home',
            slug: p.slug || 'index',
            title: p.title || p.name || 'Home',
            description: p.description || null,
            html: p.html || '<div></div>',
            css: p.css || '',
            js: p.js || '',
            seoTitle: p.seoTitle || null,
            seoDescription: p.seoDescription || null,
            isHomepage: p.isHomepage !== undefined ? p.isHomepage : true,
            projectId: id,
            createdAt: now,
            updatedAt: now
          };
          this.pages.set(pageId, pageObj);
          createdPages.push({ ...pageObj });
        }
      }

      const copy: any = { ...proj };
      if (include?.pages) copy.pages = createdPages;
      return copy;
    },
    update: async ({ where, data, include }: { where: { id: string }; data: any; include?: any }) => {
      const proj = this.projects.get(where.id);
      if (!proj) throw new Error('Project not found');
      Object.assign(proj, data, { updatedAt: new Date() });
      const copy: any = { ...proj };
      if (include?.pages) {
        copy.pages = Array.from(this.pages.values())
          .filter(p => p.projectId === proj.id)
          .map(p => ({ ...p }));
      }
      return copy;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const proj = this.projects.get(where.id);
      if (!proj) return { id: where.id };
      this.projects.delete(where.id);
      for (const [mid, m] of Array.from(this.projectMembers.entries())) {
        if (m.projectId === where.id) this.projectMembers.delete(mid);
      }
      for (const [pid, p] of Array.from(this.pages.entries())) {
        if (p.projectId === where.id) this.pages.delete(pid);
      }
      for (const [lid, l] of Array.from(this.leads.entries())) {
        if (l.projectId === where.id) l.projectId = null;
      }
      this.save();
      return { ...proj };
    },
    deleteMany: async ({ where }: { where?: any } = {}) => {
      let count = 0;
      for (const [id, proj] of Array.from(this.projects.entries())) {
        if (where?.id && proj.id !== where.id) continue;
        this.projects.delete(id);
        for (const [mid, m] of Array.from(this.projectMembers.entries())) {
          if (m.projectId === id) this.projectMembers.delete(mid);
        }
        for (const [pid, p] of Array.from(this.pages.entries())) {
          if (p.projectId === id) this.pages.delete(pid);
        }
        count++;
      }
      this.save();
      return { count };
    }
  };

  projectMember = {
    findFirst: async ({ where }: { where: { projectId?: string; userId?: string; role?: string } }) => {
      for (const m of this.projectMembers.values()) {
        if (where.projectId && m.projectId !== where.projectId) continue;
        if (where.userId && m.userId !== where.userId) continue;
        if (where.role && m.role !== where.role) continue;
        return { ...m };
      }
      return null;
    },
    findMany: async ({ where }: { where?: any } = {}) => {
      return Array.from(this.projectMembers.values()).filter(m => {
        if (where?.projectId && m.projectId !== where.projectId) return false;
        if (where?.userId && m.userId !== where.userId) return false;
        return true;
      });
    },
    create: async ({ data }: { data: any }) => {
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const member = { id, ...data };
      this.projectMembers.set(id, member);
      this.save();
      return { ...member };
    },
    deleteMany: async ({ where }: { where?: any } = {}) => {
      let count = 0;
      for (const [mid, m] of Array.from(this.projectMembers.entries())) {
        if (where?.projectId && m.projectId !== where.projectId) continue;
        if (where?.userId && m.userId !== where.userId) continue;
        this.projectMembers.delete(mid);
        count++;
      }
      this.save();
      return { count };
    }
  };

  page = {
    findFirst: async ({ where }: { where: { projectId?: string; isHomepage?: boolean; slug?: string } }) => {
      for (const p of this.pages.values()) {
        if (where.projectId && p.projectId !== where.projectId) continue;
        if (where.isHomepage !== undefined && p.isHomepage !== where.isHomepage) continue;
        if (where.slug && p.slug !== where.slug) continue;
        return { ...p };
      }
      return null;
    },
    findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
      const page = this.pages.get(where.id);
      if (!page) return null;
      const copy: any = { ...page };
      if (include?.project) {
        const proj = this.projects.get(page.projectId);
        if (proj) {
          copy.project = {
            ...proj,
            members: Array.from(this.projectMembers.values()).filter(m => m.projectId === proj.id),
            pages: Array.from(this.pages.values()).filter(p => p.projectId === proj.id)
          };
        }
      }
      return copy;
    },
    findMany: async ({ where }: { where?: any } = {}) => {
      return Array.from(this.pages.values()).filter(p => {
        if (where?.projectId && p.projectId !== where.projectId) return false;
        return true;
      });
    },
    create: async ({ data, include }: { data: any; include?: any }) => {
      const id = `page_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date();
      const pageObj: MockPage = {
        id,
        name: data.name,
        slug: data.slug,
        title: data.title || data.name,
        description: data.description || null,
        html: data.html || '<div></div>',
        css: data.css || '',
        js: data.js || '',
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        isHomepage: data.isHomepage !== undefined ? data.isHomepage : false,
        projectId: data.projectId,
        createdAt: now,
        updatedAt: now
      };
      this.pages.set(id, pageObj);
      const copy: any = { ...pageObj };
      if (include?.project) {
        const proj = this.projects.get(data.projectId);
        if (proj) copy.project = { ...proj };
      }
      return copy;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const page = this.pages.get(where.id);
      if (!page) throw new Error('Page not found');
      Object.assign(page, data, { updatedAt: new Date() });
      return { ...page };
    },
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      for (const page of this.pages.values()) {
        if (where.projectId && page.projectId !== where.projectId) continue;
        if (where.isHomepage !== undefined && page.isHomepage !== where.isHomepage) continue;
        Object.assign(page, data, { updatedAt: new Date() });
        count++;
      }
      return { count };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const page = this.pages.get(where.id);
      if (page) this.pages.delete(where.id);
      this.save();
      return page || { id: where.id };
    },
    deleteMany: async ({ where }: { where?: any } = {}) => {
      let count = 0;
      for (const [pid, p] of Array.from(this.pages.entries())) {
        if (where?.projectId && p.projectId !== where.projectId) continue;
        this.pages.delete(pid);
        count++;
      }
      this.save();
      return { count };
    }
  };

  lead = {
    findMany: async ({ where }: { where?: any } = {}) => {
      return Array.from(this.leads.values()).filter(l => {
        if (where?.userId && l.userId !== where.userId) return false;
        return true;
      });
    },
    findFirst: async ({ where }: { where?: any } = {}) => {
      for (const l of this.leads.values()) {
        if (where?.id && l.id !== where.id) continue;
        if (where?.userId && l.userId !== where.userId) continue;
        return { ...l };
      }
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date();
      const lead: MockLead = {
        id,
        name: data.name,
        company: data.company || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        address: data.address || null,
        rating: data.rating || null,
        dealValue: Number(data.dealValue || 0),
        status: data.status || 'PROSPECT',
        notes: data.notes || null,
        origin: data.origin || 'MANUAL',
        tags: Array.isArray(data.tags) ? data.tags : [],
        lastContactDate: data.lastContactDate ? new Date(data.lastContactDate) : null,
        userId: data.userId,
        projectId: data.projectId || null,
        createdAt: now,
        updatedAt: now
      };
      this.leads.set(id, lead);
      return { ...lead };
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const lead = this.leads.get(where.id);
      if (!lead) throw new Error('Lead not found');
      Object.assign(lead, data, { updatedAt: new Date() });
      return { ...lead };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const lead = this.leads.get(where.id);
      if (lead) this.leads.delete(where.id);
      return lead || { id: where.id };
    }
  };

  media = {
    findMany: async ({ where }: { where: any }) => {
      return Array.from(this.medias.values()).filter(m => m.userId === where.userId);
    },
    create: async ({ data }: { data: any }) => {
      const id = `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const media: MockMedia = {
        id,
        name: data.name,
        url: data.url,
        size: data.size,
        mimeType: data.mimeType,
        userId: data.userId,
        storage: data.storage,
        createdAt: new Date()
      };
      this.medias.set(id, media);
      this.save();
      return { ...media };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const m = this.medias.get(where.id);
      if (m) {
        this.medias.delete(where.id);
        this.save();
        return { ...m };
      }
      return null;
    }
  };

  version = {
    create: async ({ data }: { data: any }) => {
      const id = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const version: MockVersion = {
        id,
        name: data.name,
        description: data.description || null,
        snapshot: data.snapshot,
        projectId: data.projectId,
        createdAt: new Date()
      };
      this.versions.set(id, version);
      return { ...version };
    }
  };

  $queryRawUnsafe = async (sql: string, ...params: any[]): Promise<any[]> => {
    const s = sql.trim();

    // User settings / me queries
    if (s.includes('FROM "User"') && s.includes('WHERE "id" = $1')) {
      const userId = params[0];
      const user = this.users.get(userId);
      if (!user) return [];
      return [{ ...user }];
    }

    if (s.includes('SELECT "role" FROM "User"') && s.includes('WHERE "id" = $1')) {
      const userId = params[0];
      const user = this.users.get(userId);
      return user ? [{ role: user.role || 'USER' }] : [];
    }

    // Leads queries
    if (s.includes('FROM "Lead" l') && s.includes('WHERE l."userId" = $1')) {
      const userId = params[0];
      const leadsList = Array.from(this.leads.values())
        .filter(l => l.userId === userId)
        .map(l => {
          const proj = l.projectId ? this.projects.get(l.projectId) : null;
          return {
            ...l,
            projectName: proj?.name || null,
            projectStatus: proj?.status || null
          };
        });
      return leadsList;
    }

    if (s.includes('FROM "Lead" l') && s.includes('WHERE l."id" = $1')) {
      const id = params[0];
      const lead = this.leads.get(id);
      if (!lead) return [];
      const proj = lead.projectId ? this.projects.get(lead.projectId) : null;
      return [{
        ...lead,
        projectName: proj?.name || null,
        projectStatus: proj?.status || null
      }];
    }

    if (s.includes('SELECT "id", "name", "email", "phone" FROM "Lead"')) {
      const userId = params[0];
      const nameParam = params[1] ? String(params[1]).toLowerCase() : '';
      for (const l of this.leads.values()) {
        if (l.userId === userId && l.name.toLowerCase() === nameParam) {
          return [{ id: l.id, name: l.name, email: l.email, phone: l.phone }];
        }
      }
      return [];
    }

    // Media query
    if (s.includes('FROM "Media"')) {
      const userId = params[0];
      return Array.from(this.medias.values()).filter(m => m.userId === userId);
    }

    // User list query
    if (s.includes('FROM "User"') && !s.includes('WHERE "id" =')) {
      return Array.from(this.users.values()).map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role || 'USER',
        createdAt: u.createdAt
      }));
    }

    // Message query
    if (s.includes('FROM "Message"')) {
      return Array.from(this.messages.values());
    }

    return [];
  };

  $executeRawUnsafe = async (sql: string, ...params: any[]): Promise<number> => {
    const s = sql.trim();

    // User updates
    if (s.startsWith('UPDATE "User" SET "role" = $1 WHERE "id" = $2')) {
      const role = params[0];
      const userId = params[1];
      const user = this.users.get(userId);
      if (user) user.role = role;
      return 1;
    }

    if (s.includes('DELETE FROM "User" WHERE "id" = $1')) {
      const id = params[0];
      this.users.delete(id);
      return 1;
    }

    if (s.includes('UPDATE "User" SET') && s.includes('WHERE "id" =')) {
      const userId = params[params.length - 1];
      const user = this.users.get(userId);
      if (user) {
        // Updates can pass multiple fields
        for (let i = 0; i < params.length - 1; i++) {
          const val = params[i];
          if (s.includes('"geminiApiKey"')) user.geminiApiKey = val;
          if (s.includes('"openaiApiKey"')) user.openaiApiKey = val;
          if (s.includes('"aiProxyUrl"')) user.aiProxyUrl = val;
          if (s.includes('"ngrokAuthToken"')) user.ngrokAuthToken = val;
          if (s.includes('"customAiSkills"')) {
            try { user.customAiSkills = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
          }
          if (s.includes('"customAiModels"')) {
            try { user.customAiModels = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
          }
        }
      }
      return 1;
    }

    // Lead inserts / updates
    if (s.includes('INSERT INTO "Lead"')) {
      const id = params[0];
      const name = params[1];
      const company = params[2];
      const phone = params[3];
      const email = params[4];
      const website = params[5];
      const address = params[6];
      const rating = params[7];
      const dealValue = Number(params[8] || 0);
      const status = params[9] || 'PROSPECT';
      const notes = params[10];
      const origin = params[11] || 'MANUAL';
      const tags = Array.isArray(params[12]) ? params[12] : [];
      const userId = params[13];
      const projectId = params[14] || null;

      const now = new Date();
      this.leads.set(id, {
        id,
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
        lastContactDate: null,
        userId,
        projectId,
        createdAt: now,
        updatedAt: now
      });
      return 1;
    }

    if (s.includes('UPDATE "Lead"') && s.includes('SET "projectId" = $1')) {
      const projectId = params[0];
      const leadId = params[1];
      const lead = this.leads.get(leadId);
      if (lead) {
        lead.projectId = projectId;
        lead.status = 'PROPOSAL_SENT';
        lead.updatedAt = new Date();
      }
      return 1;
    }

    if (s.includes('DELETE FROM "Lead" WHERE "id" = $1')) {
      const id = params[0];
      this.leads.delete(id);
      return 1;
    }

    // Media insert / delete
    if (s.includes('INSERT INTO "Media"')) {
      const id = params[0];
      const name = params[1];
      const url = params[2];
      const size = Number(params[3] || 0);
      const mimeType = params[4] || 'image/png';
      const userId = params[5];
      this.medias.set(id, {
        id,
        name,
        url,
        size,
        mimeType,
        userId,
        createdAt: new Date()
      });
      this.save();
      return 1;
    }

    if (s.includes('DELETE FROM "Media" WHERE "id" = $1')) {
      const id = params[0];
      this.medias.delete(id);
      this.save();
      return 1;
    }

    return 1;
  };
}

let prismaClient: any;

const connectionString = process.env.DATABASE_URL;

if (connectionString && !connectionString.includes('builder_password@localhost')) {
  try {
    const { PrismaClient } = require('@prisma/client');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
    console.log('[Database] Connected to PostgreSQL via DATABASE_URL');
  } catch (err) {
    console.warn('[Database] Failed to connect to PostgreSQL, falling back to In-Memory DB:', err);
    prismaClient = new InMemoryDatabase();
  }
} else {
  console.log('[Database] Using In-Memory Database store (fast & persistent per session)');
  prismaClient = new InMemoryDatabase();
}

export const prisma = prismaClient;
