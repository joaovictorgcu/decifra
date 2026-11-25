import { PrismaClient } from "@prisma/client";

export type Db = PrismaClient;

export function criarDb(): PrismaClient {
  return new PrismaClient();
}
