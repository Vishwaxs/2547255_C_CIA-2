import { PrismaClient } from '@prisma/client';

// One shared PrismaClient for the process (Prisma pools connections internally).
export const prisma = new PrismaClient();
