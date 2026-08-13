import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 환경변수가 없습니다. .env 파일에 PostgreSQL 연결 주소를 넣어 주세요.",
    );
  }

  // Supabase 는 연결 수가 제한되어 있어 풀 크기를 작게 잡는다.
  // 서버리스(Vercel)에서는 인스턴스가 여러 개 뜨므로 더욱 중요하다.
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
