import type { JournalSourceType } from "@prisma/client";
import { prisma } from "../db/client.js";

/**
 * طبقة مستودع رفيعة حول القيود — نمط Repository للعزل عن الخدمات وخدمة الاختبارات لاحقاً.
 */
export const journalEntryRepository = {
  findPostedBySource(sourceType: JournalSourceType, sourceId: string) {
    return prisma.journalEntry.findFirst({
      where: { sourceType, sourceId, status: "POSTED", voidedAt: null },
      include: { lines: { orderBy: { lineNo: "asc" } }, period: { include: { year: true } } },
    });
  },

  countLinesForAccount(accountId: string) {
    return prisma.journalLine.count({ where: { accountId } });
  },
};
