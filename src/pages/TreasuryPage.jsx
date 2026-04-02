import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";
import { toApiDateTime } from "../lib/dates.js";

export default function TreasuryPage() {
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [parties, setParties] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [payments, setPayments] = useState([]);

  const [nbName, setNbName] = useState("");
  const [nbKind, setNbKind] = useState("CASH");
  const [nbGl, setNbGl] = useState("");

  const [payDir, setPayDir] = useState("RECEIPT");
  const [payParty, setPayParty] = useState("");
  const [payBank, setPayBank] = useState("");
  const [payOffset, setPayOffset] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState("");
  const [allocSaleId, setAllocSaleId] = useState("");
  const [allocPurchaseId, setAllocPurchaseId] = useState("");

  const [trFrom, setTrFrom] = useState("");
  const [trTo, setTrTo] = useState("");
  const [trAmt, setTrAmt] = useState("");
  const [trDate, setTrDate] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [b, acc, p] = await Promise.all([
        api.get("/finance/cash-banks"),
        api.get("/finance/accounts", { activeOnly: "true" }),
        api.get("/parties", { page: 1, pageSize: 400 }),
      ]);
      setBanks(b.items ?? []);
      setAccounts(acc.items ?? []);
      setParties(p.items ?? []);
      try {
        const pay = await api.get("/finance/treasury/payments");
        setPayments(pay.items ?? []);
      } catch {
        setPayments([]);
      }
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onNewBank = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/finance/cash-banks", {
        name: nbName.trim(),
        kind: nbKind,
        glAccountId: nbGl || null,
      });
      setMsg("تم إضافة صندوق/بنك");
      setNbName("");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onPayment = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/finance/treasury/payments", {
        paymentDate: toApiDateTime(payDate || new Date().toISOString().slice(0, 10)) || new Date().toISOString(),
        direction: payDir,
        partyId: payParty || null,
        cashBankId: payBank,
        amount: payAmt,
        offsetAccountId: payOffset,
        allocations: allocSaleId || allocPurchaseId ? [{ saleVoucherId: allocSaleId || null, purchaseVoucherId: allocPurchaseId || null, amount: payAmt }] : undefined,
      });
      setMsg("تم تسجيل السند والترحيل");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onTransfer = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/finance/treasury/transfers", {
        transferDate: toApiDateTime(trDate || new Date().toISOString().slice(0, 10)) || new Date().toISOString(),
        fromCashBankId: trFrom,
        toCashBankId: trTo,
        amount: trAmt,
      });
      setMsg("تم التحويل");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">الصناديق والبنوك والخزينة</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}
      <button type="button" className="master-btn master-btn-ghost" onClick={load}>
        تحديث
      </button>

      <h3 className="master-form-title">قائمة الصناديق</h3>
      <ul>
        {banks.map((b) => (
          <li key={b.id}>
            {b.name} ({b.kind}) {b.glAccount ? `— ${b.glAccount.code}` : "— بلا حساب GL"}
          </li>
        ))}
      </ul>

      <form className="master-form" onSubmit={onNewBank}>
        <h3 className="master-form-title">تعريف جديد</h3>
        <label className="master-field">
          الاسم
          <input className="io-date-input master-input" value={nbName} onChange={(e) => setNbName(e.target.value)} />
        </label>
        <label className="master-field">
          النوع
          <select className="io-date-input master-input" value={nbKind} onChange={(e) => setNbKind(e.target.value)}>
            <option value="CASH">صندوق</option>
            <option value="BANK">بنك</option>
          </select>
        </label>
        <label className="master-field">
          حساب GL
          <select className="io-date-input master-input" value={nbGl} onChange={(e) => setNbGl(e.target.value)}>
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="io-btn-primary">
          إضافة
        </button>
      </form>

      <form className="master-form" onSubmit={onPayment}>
        <h3 className="master-form-title">سند قبض / صرف (مرحّل)</h3>
        <label className="master-field">
          الاتجاه
          <select className="io-date-input master-input" value={payDir} onChange={(e) => setPayDir(e.target.value)}>
            <option value="RECEIPT">قبض من عميل</option>
            <option value="DISBURSEMENT">صرف لمورد</option>
          </select>
        </label>
        <label className="master-field">
          الطرف
          <select className="io-date-input master-input" value={payParty} onChange={(e) => setPayParty(e.target.value)}>
            <option value="">—</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          الصندوق/البنك
          <select className="io-date-input master-input" value={payBank} onChange={(e) => setPayBank(e.target.value)}>
            <option value="">اختر</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          حساب التسوية (مدينون/دائنون)
          <select
            className="io-date-input master-input"
            value={payOffset}
            onChange={(e) => setPayOffset(e.target.value)}
          >
            <option value="">اختر</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          المبلغ
          <input className="io-date-input master-input" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
        </label>
        <label className="master-field">
          التاريخ
          <input className="io-date-input master-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </label>
        <label className="master-field">
          تخصيص فاتورة بيع (اختياري)
          <input className="io-date-input master-input" value={allocSaleId} onChange={(e) => setAllocSaleId(e.target.value)} />
        </label>
        <label className="master-field">
          تخصيص فاتورة شراء (اختياري)
          <input className="io-date-input master-input" value={allocPurchaseId} onChange={(e) => setAllocPurchaseId(e.target.value)} />
        </label>
        <button type="submit" className="io-btn-primary">
          ترحيل
        </button>
      </form>

      <form className="master-form" onSubmit={onTransfer}>
        <h3 className="master-form-title">تحويل بين الصناديق</h3>
        <label className="master-field">
          من
          <select className="io-date-input master-input" value={trFrom} onChange={(e) => setTrFrom(e.target.value)}>
            <option value="">—</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          إلى
          <select className="io-date-input master-input" value={trTo} onChange={(e) => setTrTo(e.target.value)}>
            <option value="">—</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          المبلغ
          <input className="io-date-input master-input" value={trAmt} onChange={(e) => setTrAmt(e.target.value)} />
        </label>
        <label className="master-field">
          التاريخ
          <input className="io-date-input master-input" type="date" value={trDate} onChange={(e) => setTrDate(e.target.value)} />
        </label>
        <button type="submit" className="io-btn-primary">
          تحويل
        </button>
      </form>

      <h3 className="master-form-title">سندات الخزينة والتخصيصات</h3>
      <ul>
        {payments.map((p) => (
          <li key={p.id}>
            {p.docNo} — {p.direction} — {String(p.amount)} — {p.party?.name ?? "بدون طرف"}
            {(p.allocations ?? []).length ? (
              <ul>
                {p.allocations.map((a) => (
                  <li key={a.id}>
                    تخصيص {String(a.amount)} على {a.saleVoucher?.voucherNo ?? a.purchaseVoucher?.voucherNo ?? "—"}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
