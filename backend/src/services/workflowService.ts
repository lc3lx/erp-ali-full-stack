import type { ApprovalEntityType, Prisma, SourceDocumentStatus } from "@prisma/client";
import { prisma } from "../db/client.js";
import { AppError } from "../utils/errors.js";

/** Pending في مسار العمل = SUBMITTED في المخطط */
export const WORKFLOW_PENDING_STATUS: SourceDocumentStatus = "SUBMITTED";

type SaleDoc = {
  id: string;
  documentStatus: SourceDocumentStatus;
  glJournalEntryId: string | null;
};

type PurchaseDoc = {
  id: string;
  documentStatus: SourceDocumentStatus;
  glJournalEntryId: string | null;
};

function isEditableStatus(s: SourceDocumentStatus): boolean {
  return s === "DRAFT";
}

export function assertCanEditSaleVoucher(doc: SaleDoc) {
  if (!isEditableStatus(doc.documentStatus)) {
    throw new AppError(
      403,
      `Cannot edit sale invoice in status ${doc.documentStatus}. Only DRAFT is editable.`,
      "WORKFLOW_EDIT_BLOCKED",
    );
  }
}

export function assertCanEditPurchaseVoucher(doc: PurchaseDoc) {
  if (!isEditableStatus(doc.documentStatus)) {
    throw new AppError(
      403,
      `Cannot edit purchase invoice in status ${doc.documentStatus}. Only DRAFT is editable.`,
      "WORKFLOW_EDIT_BLOCKED",
    );
  }
}

export function assertCanPostSaleVoucher(doc: SaleDoc) {
  if (doc.documentStatus !== "APPROVED") {
    throw new AppError(
      409,
      `Posting requires APPROVED status (current: ${doc.documentStatus}). Submit and approve first.`,
      "WORKFLOW_POST_REQUIRES_APPROVAL",
    );
  }
  if (doc.glJournalEntryId) {
    throw new AppError(409, "Invoice already posted to GL", "ALREADY_POSTED");
  }
}

export function assertCanPostPurchaseVoucher(doc: PurchaseDoc) {
  if (doc.documentStatus !== "APPROVED") {
    throw new AppError(
      409,
      `Posting requires APPROVED status (current: ${doc.documentStatus}). Submit and approve first.`,
      "WORKFLOW_POST_REQUIRES_APPROVAL",
    );
  }
  if (doc.glJournalEntryId) {
    throw new AppError(409, "Invoice already posted to GL", "ALREADY_POSTED");
  }
}

export function assertCanDeleteSaleVoucher(doc: SaleDoc) {
  if (doc.documentStatus !== "DRAFT" && doc.documentStatus !== "CANCELLED") {
    throw new AppError(409, "Only DRAFT or CANCELLED sale invoices can be deleted", "WORKFLOW_DELETE_BLOCKED");
  }
  if (doc.glJournalEntryId) {
    throw new AppError(409, "Posted invoices cannot be deleted", "WORKFLOW_DELETE_BLOCKED");
  }
}

export function assertCanDeletePurchaseVoucher(doc: PurchaseDoc) {
  if (doc.documentStatus !== "DRAFT" && doc.documentStatus !== "CANCELLED") {
    throw new AppError(409, "Only DRAFT or CANCELLED purchase invoices can be deleted", "WORKFLOW_DELETE_BLOCKED");
  }
  if (doc.glJournalEntryId) {
    throw new AppError(409, "Posted invoices cannot be deleted", "WORKFLOW_DELETE_BLOCKED");
  }
}

async function latestApprovalRequest(entityType: ApprovalEntityType, entityId: string) {
  return prisma.approvalRequest.findFirst({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}

/** مسودة → معلّق (طلب موافقة) */
export async function submitSaleVoucherForApproval(voucherId: string, requestedById?: string | null) {
  const v = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Sale voucher not found");
  if (v.documentStatus !== "DRAFT") {
    throw new AppError(409, "Only DRAFT invoices can be submitted for approval", "WORKFLOW_INVALID_TRANSITION");
  }
  if (v.glJournalEntryId) throw new AppError(409, "Already posted", "WORKFLOW_INVALID_TRANSITION");

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.create({
      data: {
        entityType: "SALE_VOUCHER",
        entityId: voucherId,
        status: "PENDING",
        requestedById: requestedById ?? null,
      },
    });
    return tx.saleVoucher.update({
      where: { id: voucherId },
      data: { documentStatus: WORKFLOW_PENDING_STATUS },
    });
  });
}

export async function submitPurchaseVoucherForApproval(voucherId: string, requestedById?: string | null) {
  const v = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Purchase voucher not found");
  if (v.documentStatus !== "DRAFT") {
    throw new AppError(409, "Only DRAFT invoices can be submitted for approval", "WORKFLOW_INVALID_TRANSITION");
  }
  if (v.glJournalEntryId) throw new AppError(409, "Already posted", "WORKFLOW_INVALID_TRANSITION");

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.create({
      data: {
        entityType: "PURCHASE_VOUCHER",
        entityId: voucherId,
        status: "PENDING",
        requestedById: requestedById ?? null,
      },
    });
    return tx.purchaseInvoiceVoucher.update({
      where: { id: voucherId },
      data: { documentStatus: WORKFLOW_PENDING_STATUS },
    });
  });
}

export async function approveSaleVoucher(voucherId: string, decidedById: string, comment?: string | null) {
  const v = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Sale voucher not found");
  if (v.documentStatus !== WORKFLOW_PENDING_STATUS) {
    throw new AppError(409, "Invoice is not awaiting approval", "WORKFLOW_INVALID_TRANSITION");
  }
  const req = await latestApprovalRequest("SALE_VOUCHER", voucherId);
  if (!req || req.status !== "PENDING") {
    throw new AppError(409, "No pending approval request found", "WORKFLOW_NO_APPROVAL");
  }

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: req.id },
      data: {
        status: "APPROVED",
        decidedById,
        decidedAt: new Date(),
        comment: comment?.trim() || null,
      },
    });
    return tx.saleVoucher.update({
      where: { id: voucherId },
      data: {
        documentStatus: "APPROVED",
        approvedAt: new Date(),
        approvedById: decidedById,
      },
    });
  });
}

export async function rejectSaleVoucher(voucherId: string, decidedById: string, comment?: string | null) {
  const v = await prisma.saleVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Sale voucher not found");
  if (v.documentStatus !== WORKFLOW_PENDING_STATUS) {
    throw new AppError(409, "Invoice is not awaiting approval", "WORKFLOW_INVALID_TRANSITION");
  }
  const req = await latestApprovalRequest("SALE_VOUCHER", voucherId);
  if (!req || req.status !== "PENDING") {
    throw new AppError(409, "No pending approval request", "WORKFLOW_NO_APPROVAL");
  }

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: req.id },
      data: {
        status: "REJECTED",
        decidedById,
        decidedAt: new Date(),
        comment: comment?.trim() || null,
      },
    });
    return tx.saleVoucher.update({
      where: { id: voucherId },
      data: { documentStatus: "DRAFT", approvedAt: null, approvedById: null },
    });
  });
}

export async function approvePurchaseVoucher(voucherId: string, decidedById: string, comment?: string | null) {
  const v = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Purchase voucher not found");
  if (v.documentStatus !== WORKFLOW_PENDING_STATUS) {
    throw new AppError(409, "Invoice is not awaiting approval", "WORKFLOW_INVALID_TRANSITION");
  }
  const req = await latestApprovalRequest("PURCHASE_VOUCHER", voucherId);
  if (!req || req.status !== "PENDING") {
    throw new AppError(409, "No pending approval request", "WORKFLOW_NO_APPROVAL");
  }

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: req.id },
      data: {
        status: "APPROVED",
        decidedById,
        decidedAt: new Date(),
        comment: comment?.trim() || null,
      },
    });
    return tx.purchaseInvoiceVoucher.update({
      where: { id: voucherId },
      data: {
        documentStatus: "APPROVED",
        approvedAt: new Date(),
        approvedById: decidedById,
      },
    });
  });
}

export async function rejectPurchaseVoucher(voucherId: string, decidedById: string, comment?: string | null) {
  const v = await prisma.purchaseInvoiceVoucher.findUnique({ where: { id: voucherId } });
  if (!v) throw new AppError(404, "Purchase voucher not found");
  if (v.documentStatus !== WORKFLOW_PENDING_STATUS) {
    throw new AppError(409, "Invoice is not awaiting approval", "WORKFLOW_INVALID_TRANSITION");
  }
  const req = await latestApprovalRequest("PURCHASE_VOUCHER", voucherId);
  if (!req || req.status !== "PENDING") {
    throw new AppError(409, "No pending approval request", "WORKFLOW_NO_APPROVAL");
  }

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: req.id },
      data: {
        status: "REJECTED",
        decidedById,
        decidedAt: new Date(),
        comment: comment?.trim() || null,
      },
    });
    return tx.purchaseInvoiceVoucher.update({
      where: { id: voucherId },
      data: { documentStatus: "DRAFT", approvedAt: null, approvedById: null },
    });
  });
}

/** بعد ترحيل GL — انتقال إلى POSTED */
export async function markSaleVoucherPosted(voucherId: string) {
  return prisma.saleVoucher.update({
    where: { id: voucherId },
    data: { documentStatus: "POSTED" },
  });
}

export async function markPurchaseVoucherPosted(voucherId: string) {
  return prisma.purchaseInvoiceVoucher.update({
    where: { id: voucherId },
    data: { documentStatus: "POSTED" },
  });
}

/** عند اكتساب المدفوعات بالكامل (متبقي ≈ 0) */
export async function markSaleVoucherPaidIfSettled(
  voucherId: string,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const v = await client.saleVoucher.findUnique({
    where: { id: voucherId },
    select: { documentStatus: true, remaining: true, glJournalEntryId: true },
  });
  if (!v?.glJournalEntryId || v.documentStatus !== "POSTED") return null;
  const rem = v.remaining != null ? Number(v.remaining) : 0;
  if (rem > 0.0001) return null;
  return client.saleVoucher.update({
    where: { id: voucherId },
    data: { documentStatus: "PAID" },
  });
}

export async function markPurchaseVoucherPaidIfSettled(
  voucherId: string,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const v = await client.purchaseInvoiceVoucher.findUnique({
    where: { id: voucherId },
    select: { documentStatus: true, balance: true, glJournalEntryId: true },
  });
  if (!v?.glJournalEntryId || v.documentStatus !== "POSTED") return null;
  const bal = v.balance != null ? Number(v.balance) : 0;
  if (bal > 0.0001) return null;
  return client.purchaseInvoiceVoucher.update({
    where: { id: voucherId },
    data: { documentStatus: "PAID" },
  });
}
