export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Container system API",
    version: "1.0.0",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        security: [],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "JWT token" } },
      },
    },
    "/containers": {
      get: { summary: "List containers" },
      post: { summary: "Create container" },
    },
    "/invoice-vouchers": {
      get: { summary: "List purchase invoice vouchers" },
      post: { summary: "Create voucher" },
    },
    "/invoice-sale": {
      get: { summary: "List sale vouchers" },
      post: { summary: "Create sale voucher" },
    },
    "/reports/run": {
      get: { summary: "Run report by tab" },
    },
  },
} as const;
