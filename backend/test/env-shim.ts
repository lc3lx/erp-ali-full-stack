import "dotenv/config";

process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-jwt-secret-key-at-least-32-characters";
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/container_app?schema=public";
}
