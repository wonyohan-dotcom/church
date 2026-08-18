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

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (client) return client;
  // 개발 중에는 파일을 고칠 때마다 모듈이 다시 평가되므로 전역에 담아 재사용한다.
  // 그러지 않으면 연결이 계속 쌓인다.
  client = globalForPrisma.prisma ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

/**
 * 쓰기 시작할 때 처음 만들어진다.
 *
 * 모듈을 불러오는 순간 만들면 next build 가 각 라우트의 설정을 읽는 단계에서
 * DATABASE_URL 을 요구하게 된다. 빌드 중에는 데이터베이스에 접속할 일이 없는데도
 * 접속 정보가 없다는 이유로 빌드 전체가 실패했다. 실제로 질의할 때 만든다.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const instance = getClient();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in getClient();
  },
});
