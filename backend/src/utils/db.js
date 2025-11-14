import { PrismaClient } from "@prisma/client";

const globalPrisma = globalThis;

if (!globalPrisma.__prisma) {
  globalPrisma.__prisma = new PrismaClient();
}

const prisma = globalPrisma.__prisma;

export default prisma;
