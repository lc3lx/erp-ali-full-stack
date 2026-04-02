import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db/client.js";
import { routeParam } from "../utils/params.js";
import * as fin from "../services/financeService.js";

export const hrRouter = Router();

hrRouter.get(
  "/employees",
  asyncHandler(async (_req, res) => {
    const items = await prisma.employee.findMany({ orderBy: { fullName: "asc" }, include: { loans: true } });
    res.json({ items });
  }),
);

hrRouter.post(
  "/employees",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fullName: z.string().min(1),
        phone: z.string().optional().nullable(),
        baseSalary: z.union([z.number(), z.string()]).optional().nullable(),
        hireDate: z.string().datetime().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.employee.create({
      data: {
        fullName: body.fullName.trim(),
        phone: body.phone ?? null,
        baseSalary: body.baseSalary as never,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        notes: body.notes ?? null,
      },
    });
    res.status(201).json(row);
  }),
);

hrRouter.patch(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fullName: z.string().min(1).optional(),
        phone: z.string().optional().nullable(),
        baseSalary: z.union([z.number(), z.string()]).optional().nullable(),
        hireDate: z.string().datetime().optional().nullable(),
        isActive: z.boolean().optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.employee.update({
      where: { id: routeParam(req.params.id) },
      data: {
        ...(body.fullName !== undefined ? { fullName: body.fullName.trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.baseSalary !== undefined ? { baseSalary: body.baseSalary as never } : {}),
        ...(body.hireDate !== undefined ? { hireDate: body.hireDate ? new Date(body.hireDate) : null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    res.json(row);
  }),
);

hrRouter.get(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.employee.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { loans: true },
    });
    res.json(row);
  }),
);

hrRouter.delete(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    await prisma.employee.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  }),
);

hrRouter.post(
  "/employees/:id/loans",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        principal: z.union([z.number(), z.string()]),
        paidAmount: z.union([z.number(), z.string()]).optional(),
        installment: z.union([z.number(), z.string()]).optional().nullable(),
        startDate: z.string().datetime(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.employeeLoan.create({
      data: {
        employeeId: routeParam(req.params.id),
        principal: new Prisma.Decimal(String(body.principal)),
        paidAmount: new Prisma.Decimal(String(body.paidAmount ?? 0)),
        installment: body.installment != null ? new Prisma.Decimal(String(body.installment)) : null,
        startDate: new Date(body.startDate),
        notes: body.notes ?? null,
      },
    });
    res.status(201).json(row);
  }),
);

hrRouter.patch(
  "/loans/:loanId",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        principal: z.union([z.number(), z.string()]).optional(),
        paidAmount: z.union([z.number(), z.string()]).optional(),
        installment: z.union([z.number(), z.string()]).optional().nullable(),
        startDate: z.string().datetime().optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.employeeLoan.update({
      where: { id: routeParam(req.params.loanId) },
      data: {
        ...(body.principal !== undefined ? { principal: new Prisma.Decimal(String(body.principal)) } : {}),
        ...(body.paidAmount !== undefined ? { paidAmount: new Prisma.Decimal(String(body.paidAmount)) } : {}),
        ...(body.installment !== undefined
          ? { installment: body.installment != null ? new Prisma.Decimal(String(body.installment)) : null }
          : {}),
        ...(body.startDate !== undefined ? { startDate: new Date(body.startDate) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    res.json(row);
  }),
);

hrRouter.delete(
  "/loans/:loanId",
  asyncHandler(async (req, res) => {
    await prisma.employeeLoan.delete({ where: { id: routeParam(req.params.loanId) } });
    res.status(204).send();
  }),
);

hrRouter.post(
  "/payroll/run",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(2000).max(2100),
        salaryExpenseAccountId: z.string().uuid(),
        payrollPayableAccountId: z.string().uuid(),
      })
      .parse(req.body);
    const from = new Date(body.year, body.month - 1, 1);
    const to = new Date(body.year, body.month, 0, 23, 59, 59, 999);
    const emps = await prisma.employee.findMany({
      where: { isActive: true, OR: [{ hireDate: null }, { hireDate: { lte: to } }] },
      select: { id: true, fullName: true, baseSalary: true },
    });
    const total = emps.reduce((s, e) => s.add(new Prisma.Decimal(String(e.baseSalary ?? 0))), new Prisma.Decimal(0));
    if (total.lte(0)) return res.status(400).json({ error: "No active salaries found" });
    const je = await fin.createPostedJournal({
      entryDate: to,
      description: `Payroll ${body.year}-${String(body.month).padStart(2, "0")}`,
      sourceType: "MANUAL",
      sourceId: `${body.year}-${body.month}`,
      lines: [
        { accountId: body.salaryExpenseAccountId, debit: total.toString(), credit: "0", description: "Payroll expense" },
        { accountId: body.payrollPayableAccountId, debit: "0", credit: total.toString(), description: "Payroll payable" },
      ],
      userId: (req as { user?: { id?: string } }).user?.id,
    });
    res.status(201).json({ period: { from, to }, employees: emps.length, total: total.toString(), journalEntry: je });
  }),
);
