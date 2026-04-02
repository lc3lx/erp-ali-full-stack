import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().optional(),
  ENABLE_SWAGGER: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.CORS_ORIGIN) {
    throw new Error("CORS_ORIGIN is required in production");
  }
  return parsed.data;
}

export const env = loadEnv();
