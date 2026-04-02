/** مدخلات أسطر القيود — مطابقة لـ financeService.createPostedJournal */
export type GlLineInput = {
  accountId: string;
  description?: string | null;
  partyId?: string | null;
  containerId?: string | null;
  storeId?: string | null;
  currency?: string;
  exchangeRate?: number | string | null;
  debit?: number | string | null;
  credit?: number | string | null;
};
