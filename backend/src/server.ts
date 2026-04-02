import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/client.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  if (env.NODE_ENV !== "production" || env.ENABLE_SWAGGER) {
    console.log(`OpenAPI UI: http://localhost:${env.PORT}/api/docs`);
  }
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  server.close(async (error) => {
    if (error) {
      console.error("HTTP server close failed", error);
      process.exitCode = 1;
    }
    await prisma.$disconnect().catch((disconnectError) => {
      console.error("Prisma disconnect failed", disconnectError);
      process.exitCode = 1;
    });
    process.exit();
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
