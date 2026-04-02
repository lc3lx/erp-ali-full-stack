import { Prisma } from "@prisma/client";
import { AppError } from "../../utils/errors.js";
import { amt } from "./AccountingEngine.js";

export type PaymentAllocationDraft = {
  saleVoucherId?: string | null;
  purchaseVoucherId?: string | null;
  amount: Prisma.Decimal | number | string;
};

/**
 * تخصيص الدفعات:
 * - لا يجوز أن يتجاوز مجموع التخصيصات مبلغ السند
 * - كل سطر يجب أن يخصص لفاتورة بيع أو شراء (لا الاثنين معاً)
 * - يُسمح بمجموع تخصيصات < مبلغ السند (رصيد دفع مقدم / غير مطبّق يظهر في الأوفست المحاسبي)
 */
export function validatePaymentAllocations(
  paymentAmount: Prisma.Decimal | number | string,
  allocations: PaymentAllocationDraft[] | undefined,
) {
  const pay = amt(paymentAmount);
  if (pay.lte(0)) throw new AppError(400, "Payment amount must be positive", "PAY_AMOUNT_INVALID");
  if (!allocations?.length) return;

  let sum = amt(0);
  for (const a of allocations) {
    const sale = a.saleVoucherId;
    const pur = a.purchaseVoucherId;
    if (sale && pur) {
      throw new AppError(400, "Allocation cannot reference both sale and purchase", "PAY_ALLOC_DUAL");
    }
    if (!sale && !pur) {
      throw new AppError(
        400,
        "Each allocation must reference saleVoucherId or purchaseVoucherId (or omit allocations for on-account)",
        "PAY_ALLOC_TARGET",
      );
    }
    const lineAmt = amt(a.amount);
    if (lineAmt.lte(0)) throw new AppError(400, "Allocation amount must be > 0", "PAY_ALLOC_AMOUNT");
    sum = sum.add(lineAmt);
  }

  if (sum.gt(pay)) {
    throw new AppError(
      400,
      `Total allocated ${sum} exceeds payment ${pay}`,
      "PAY_ALLOC_EXCEEDS",
    );
  }
}
