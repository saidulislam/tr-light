import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const mode = process.argv[2] ?? "both";

if (mode === "write" || mode === "both") {
  const u = await db.user.upsert({
    where: { email: "ada@example.com" },
    update: { name: "Ada Lovelace" },
    create: { email: "ada@example.com", name: "Ada Lovelace", role: "ADMIN" },
  });
  console.log("WROTE:", u);
}

if (mode === "read" || mode === "both") {
  const found = await db.user.findUnique({ where: { email: "ada@example.com" } });
  console.log("READ: ", found);
}

await db.$disconnect();
