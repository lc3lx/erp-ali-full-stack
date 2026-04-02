import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";

export type NotificationKind =
  | "PENDING_APPROVAL"
  | "OVERDUE_INVOICE"
  | "APPROVAL_DECIDED"
  | "LOW_STOCK";

export async function createNotification(input: {
  userId: string;
  kind: NotificationKind | string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return prisma.appNotification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
}

export async function listUnreadForUser(userId: string, take = 50) {
  return prisma.appNotification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listForUser(
  userId: string,
  query?: { unreadOnly?: boolean; skip?: number; take?: number },
) {
  const take = query?.take ?? 40;
  const skip = query?.skip ?? 0;
  const where: Prisma.AppNotificationWhereInput = { userId };
  if (query?.unreadOnly) where.readAt = null;
  const [items, total] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.appNotification.count({ where }),
  ]);
  return { items, total };
}

export async function markRead(userId: string, notificationId: string) {
  const n = await prisma.appNotification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!n) return null;
  return prisma.appNotification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  return prisma.appNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** إشعار المستخدمين المعنيّين بطلب موافقة فاتورة بيع */
export async function notifyApproversSaleInvoiceSubmitted(voucherId: string, voucherNo: string) {
  const approvers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "ACCOUNTANT"] } },
    select: { id: true },
  });
  await Promise.all(
    approvers.map((u) =>
      createNotification({
        userId: u.id,
        kind: "PENDING_APPROVAL",
        title: `طلب موافقة — فاتورة بيع ${voucherNo}`,
        body: "يرجى مراجعة الفاتورة واتخاذ قرار الموافقة.",
        entityType: "SaleVoucher",
        entityId: voucherId,
      }),
    ),
  );
}

export async function notifyApproversPurchaseInvoiceSubmitted(voucherId: string, voucherNo: string) {
  const approvers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "ACCOUNTANT"] } },
    select: { id: true },
  });
  await Promise.all(
    approvers.map((u) =>
      createNotification({
        userId: u.id,
        kind: "PENDING_APPROVAL",
        title: `طلب موافقة — فاتورة شراء ${voucherNo}`,
        body: "يرجى مراجعة الفاتورة واتخاذ قرار الموافقة.",
        entityType: "PurchaseInvoiceVoucher",
        entityId: voucherId,
      }),
    ),
  );
}
