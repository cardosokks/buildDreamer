import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://builder_user:builder_password@localhost:5432/builder_db?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// PrismaClient config for Prisma v7 utilizing Postgres Driver Adapter
const prismaClient = new PrismaClient({ adapter });

export const prisma = prismaClient;
