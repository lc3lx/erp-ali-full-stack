import { ContainerStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";
import { skipTake, type PaginationQuery } from "../utils/pagination.js";

function dec(n: Prisma.Decimal | null | undefined): number {
  if (n == null) return 0;
  return Number(n);
}

function validateContainerTransition(current: ContainerStatus, next: ContainerStatus) {
  if (current === next) return;
  const flow: Record<ContainerStatus, ContainerStatus[]> = {
    OPEN: ["IN_TRANSIT"],
    IN_TRANSIT: ["ARRIVED"],
    ARRIVED: ["CUSTOMS_CLEARED"],
    CUSTOMS_CLEARED: ["CLOSED"],
    CLOSED: [],
    RECEIVED: ["CUSTOMS_CLEARED", "CLOSED"],
  };
  if (!flow[current]?.includes(next)) {
    throw new AppError(400, `لا يمكن تغيير حالة الحاوية من ${current} إلى ${next}`);
  }
}

export async function listContainers(
  query: PaginationQuery & { containerNo?: string; status?: string },
) {
  const { skip, take } = skipTake(query);
  const where: Prisma.ContainerWhereInput = {};
  if (query.containerNo) where.containerNo = { contains: query.containerNo, mode: "insensitive" };
  if (query.status && Object.values(ContainerStatus).includes(query.status as ContainerStatus)) {
    where.status = query.status as ContainerStatus;
  }

  const [items, total] = await Promise.all([
    prisma.container.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        customer: true,
        clearanceCompany: true,
        _count: { select: { lineItems: true, costLines: true } },
      },
    }),
    prisma.container.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getContainer(id: string) {
  const c = await prisma.container.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { seq: "asc" } },
      costLines: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      customer: true,
      clearanceCompany: true,
    },
  });
  if (!c) throw new AppError(404, "Container not found");
  return c;
}

export async function createContainer(data: Prisma.ContainerCreateInput) {
  return prisma.container.create({ data });
}

export async function updateContainer(id: string, data: Prisma.ContainerUpdateInput) {
  try {
    if (data.status) {
      const current = await prisma.container.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new AppError(404, "Container not found");
      const next = data.status as ContainerStatus;
      validateContainerTransition(current.status, next);
    }
    return await prisma.container.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(404, "Container not found");
  }
}

export async function deleteContainer(id: string) {
  await prisma.container.delete({ where: { id } });
}

export async function addContainerLine(containerId: string, body: Prisma.ContainerLineItemCreateWithoutContainerInput) {
  await getContainer(containerId);
  const max = await prisma.containerLineItem.aggregate({
    where: { containerId },
    _max: { seq: true },
  });
  const seq = (max._max.seq ?? 0) + 1;
  return prisma.containerLineItem.create({
    data: { ...body, seq, container: { connect: { id: containerId } } },
  });
}

export async function listContainerLines(containerId: string) {
  await getContainer(containerId);
  return prisma.containerLineItem.findMany({
    where: { containerId },
    orderBy: { seq: "asc" },
  });
}

export async function addCostLine(
  containerId: string,
  data: {
    label?: string | null;
    amount: Prisma.Decimal | number | string;
    description?: string | null;
    sortOrder?: number;
  },
) {
  await getContainer(containerId);
  return prisma.containerCostLine.create({
    data: {
      containerId,
      label: data.label ?? undefined,
      amount: data.amount as Prisma.Decimal,
      description: data.description ?? undefined,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateContainerLine(
  containerId: string,
  lineId: string,
  data: Prisma.ContainerLineItemUpdateInput,
) {
  const line = await prisma.containerLineItem.findFirst({ where: { id: lineId, containerId } });
  if (!line) throw new AppError(404, "Line not found");
  return prisma.containerLineItem.update({ where: { id: lineId }, data });
}

export async function deleteContainerLine(containerId: string, lineId: string) {
  const line = await prisma.containerLineItem.findFirst({ where: { id: lineId, containerId } });
  if (!line) throw new AppError(404, "Line not found");
  await prisma.containerLineItem.delete({ where: { id: lineId } });
}

export async function updateCostLine(
  containerId: string,
  costId: string,
  data: {
    label?: string | null;
    amount?: Prisma.Decimal | number | string;
    description?: string | null;
    sortOrder?: number;
  },
) {
  const row = await prisma.containerCostLine.findFirst({ where: { id: costId, containerId } });
  if (!row) throw new AppError(404, "Cost line not found");
  const patch: Prisma.ContainerCostLineUpdateInput = {};
  if (data.label !== undefined) patch.label = data.label;
  if (data.amount !== undefined) patch.amount = data.amount as never;
  if (data.description !== undefined) patch.description = data.description;
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
  return prisma.containerCostLine.update({ where: { id: costId }, data: patch });
}

export async function deleteCostLine(containerId: string, costId: string) {
  const row = await prisma.containerCostLine.findFirst({ where: { id: costId, containerId } });
  if (!row) throw new AppError(404, "Cost line not found");
  await prisma.containerCostLine.delete({ where: { id: costId } });
}

export async function containerLineTotals(containerId: string) {
  const lines = await listContainerLines(containerId);
  let weightSum = 0;
  let cbmSum = 0;
  let boxes = 0;
  let pieces = 0;
  let priceToCustomerSum = 0;
  let byPriceSum = 0;
  let pieceTransportSum = 0;

  for (const row of lines) {
    weightSum += dec(row.weightSum);
    cbmSum += dec(row.cbmSum);
    boxes += row.boxes ?? 0;
    pieces += dec(row.pieces);
    priceToCustomerSum += dec(row.priceToCustomerSum);
    byPriceSum += dec(row.byPriceSum);
    pieceTransportSum += dec(row.pieceTransport);
  }

  const costs = await prisma.containerCostLine.findMany({ where: { containerId } });
  const coastsSum = costs.reduce((s, c) => s + dec(c.amount), 0);

  return {
    lineAggregates: {
      weightSum,
      cbmSum,
      boxes,
      pieces,
      priceToCustomerSum,
      byPriceSum,
      pieceTransportSum,
    },
    coastsSum,
    difference: priceToCustomerSum - byPriceSum,
  };
}
