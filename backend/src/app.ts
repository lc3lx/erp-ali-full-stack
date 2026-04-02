import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth, requireRole } from "./middleware/requireAuth.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { containersRouter } from "./routes/containers.js";
import { invoiceVouchersRouter } from "./routes/invoice-vouchers.js";
import { invoiceSaleRouter } from "./routes/invoice-sale.js";
import { incomeOutcomeRouter } from "./routes/income-outcome.js";
import { accountingMovesRouter } from "./routes/accounting-moves.js";
import { financeRouter } from "./routes/finance.js";
import { reportsRouter } from "./routes/reports.js";
import { officialDocumentsRouter } from "./routes/official-documents.js";
import { partiesRouter } from "./routes/parties.js";
import { storesRouter } from "./routes/stores.js";
import { itemsRouter } from "./routes/items.js";
import { invWarehousesRouter } from "./routes/inv-warehouses.js";
import { inventoryRouter } from "./routes/inventory.js";
import { hrRouter } from "./routes/hr.js";
import { crmRouter } from "./routes/crm.js";
import { notificationsRouter } from "./routes/notifications.js";
import { openApiSpec } from "./openapi/spec.js";

export function createApp() {
  const app = express();
  const corsOrigin = env.CORS_ORIGIN?.trim();
  const isProd = env.NODE_ENV === "production";

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: isProd ? corsOrigin : true,
      credentials: true,
    }),
  );
  app.use(
    morgan(
      isProd
        ? ':remote-addr - :remote-user ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" req_id=:req[x-request-id] - :response-time ms'
        : ":method :url :status :response-time ms req_id=:req[x-request-id]",
    ),
  );
  app.use(express.json({ limit: "2mb" }));

  app.use(healthRouter);

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
  app.use("/api/v1/auth", authLimiter);
  app.use("/api/v1/auth", authRouter);

  const v1 = express.Router();
  v1.use(requireAuth);
  v1.use("/parties", partiesRouter);
  v1.use("/stores", storesRouter);
  v1.use("/items", itemsRouter);
  v1.use("/inv-warehouses", invWarehousesRouter);
  v1.use("/inventory", requireRole("ADMIN", "ACCOUNTANT", "STORE_KEEPER"), inventoryRouter);
  v1.use("/hr", requireRole("ADMIN", "ACCOUNTANT"), hrRouter);
  v1.use("/crm", requireRole("ADMIN", "ACCOUNTANT", "DATA_ENTRY"), crmRouter);
  v1.use("/containers", requireRole("ADMIN", "ACCOUNTANT", "DATA_ENTRY"), containersRouter);
  v1.use("/invoice-vouchers", requireRole("ADMIN", "ACCOUNTANT", "DATA_ENTRY"), invoiceVouchersRouter);
  v1.use("/invoice-sale", requireRole("ADMIN", "ACCOUNTANT", "DATA_ENTRY"), invoiceSaleRouter);
  v1.use("/income-outcome", incomeOutcomeRouter);
  v1.use("/accounting-moves", accountingMovesRouter);
  v1.use("/finance", requireRole("ADMIN", "ACCOUNTANT"), financeRouter);
  v1.use("/reports", reportsRouter);
  v1.use("/official-documents", officialDocumentsRouter);
  v1.use("/notifications", notificationsRouter);

  app.use("/api/v1", v1);

  if (!isProd || env.ENABLE_SWAGGER) {
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec as object));
  }

  app.use(errorHandler);

  return app;
}
