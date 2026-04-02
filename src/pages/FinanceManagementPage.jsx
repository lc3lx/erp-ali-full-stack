import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatIsoToDisplay, parseDisplayToIso } from "../lib/dates.js";
import "../App.css";

const TABS = [
  { id: "accounts", label: "دليل الحسابات" },
  { id: "journals", label: "قيود اليومية" },
  { id: "reports", label: "تقارير" },
  { id: "audit", label: "سجل التدقيق" },
  { id: "fx", label: "أسعار الصرف" },
];

const GL_CLASSES = [
  { v: "ASSET", l: "أصول" },
  { v: "LIABILITY", l: "خصوم" },
  { v: "EQUITY", l: "حقوق ملكية" },
  { v: "REVENUE", l: "إيرادات" },
  { v: "EXPENSE", l: "مصروفات" },
];

function emptyLine() {
  return { accountId: "", debit: "", credit: "", description: "" };
}

export default function FinanceManagementPage() {
  const [tab, setTab] = useState("accounts");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [journals, setJournals] = useState([]);
  const [selectedJeId, setSelectedJeId] = useState("");
  const [jeDetail, setJeDetail] = useState(null);
  const [auditItems, setAuditItems] = useState([]);
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditUserId, setAuditUserId] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [rates, setRates] = useState([]);
  const [rateLabel, setRateLabel] = useState("USD");
  const [rateValue, setRateValue] = useState("");

  const [newAcc, setNewAcc] = useState({
    code: "",
    name: "",
    nameAr: "",
    class: "ASSET",
  });

  const [jeForm, setJeForm] = useState({
    entryDate: "31/03/2026",
    description: "",
    lines: [emptyLine(), emptyLine()],
  });

  const [tbFrom, setTbFrom] = useState("01/01/2026");
  const [tbTo, setTbTo] = useState("31/12/2026");
  const [tbRows, setTbRows] = useState([]);

  const [ledgerAcc, setLedgerAcc] = useState("");
  const [lgFrom, setLgFrom] = useState("01/01/2026");
  const [lgTo, setLgTo] = useState("31/12/2026");
  const [ledgerData, setLedgerData] = useState(null);

  const loadAccounts = useCallback(async () => {
    setErr("");
    try {
      const r = await api.get("/finance/accounts", { activeOnly: "true" });
      setAccounts(r.items ?? []);
    } catch (e) {
      setErr(e.message);
      setAccounts([]);
    }
  }, []);

  const loadFiscal = useCallback(async () => {
    try {
      const r = await api.get("/finance/fiscal-years");
      setFiscalYears(r.items ?? []);
    } catch {
      setFiscalYears([]);
    }
  }, []);

  const loadJournals = useCallback(async () => {
    setErr("");
    try {
      const r = await api.get("/finance/journal-entries", { page: 1, pageSize: 100 });
      setJournals(r.items ?? []);
    } catch (e) {
      setErr(e.message);
      setJournals([]);
    }
  }, []);

  const loadJeDetail = useCallback(async (id) => {
    if (!id) {
      setJeDetail(null);
      return;
    }
    setErr("");
    try {
      const r = await api.get(`/finance/journal-entries/${id}`);
      setJeDetail(r);
    } catch (e) {
      setErr(e.message);
      setJeDetail(null);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setErr("");
    try {
      const r = await api.get("/finance/audit-log", { page: 1, pageSize: 80 });
      setAuditItems(r.items ?? []);
    } catch (e) {
      setErr(e.message);
      setAuditItems([]);
    }
  }, []);
  const loadRates = useCallback(async () => {
    try {
      const r = await api.get("/finance/exchange-rates");
      setRates(r.items ?? []);
    } catch {
      setRates([]);
    }
  }, []);

  useEffect(() => {
    loadFiscal();
  }, [loadFiscal]);

  useEffect(() => {
    if (tab === "accounts") loadAccounts();
    if (tab === "journals") {
      loadJournals();
      if (accounts.length === 0) loadAccounts();
    }
    if (tab === "reports" && accounts.length === 0) loadAccounts();
    if (tab === "audit") loadAudit();
    if (tab === "fx") loadRates();
  }, [tab, loadAccounts, loadJournals, loadAudit, loadRates, accounts.length]);

  useEffect(() => {
    if (tab === "journals" && selectedJeId) loadJeDetail(selectedJeId);
    else setJeDetail(null);
  }, [tab, selectedJeId, loadJeDetail]);

  const onCreateAccount = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.post("/finance/accounts", {
        code: newAcc.code.trim(),
        name: newAcc.name.trim(),
        nameAr: newAcc.nameAr.trim() || null,
        class: newAcc.class,
      });
      setMsg("تم إنشاء الحساب.");
      setNewAcc({ code: "", name: "", nameAr: "", class: "ASSET" });
      await loadAccounts();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const onCreateJournal = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const iso = parseDisplayToIso(jeForm.entryDate);
    if (!iso) {
      setErr("تاريخ القيد غير صالح (dd/mm/yyyy)");
      return;
    }
    const lines = jeForm.lines
      .filter((l) => l.accountId)
      .map((l) => ({
        accountId: l.accountId,
        debit: l.debit || "0",
        credit: l.credit || "0",
        description: l.description || null,
      }));
    if (lines.length < 2) {
      setErr("يلزم سطران على الأقل مع حساب.");
      return;
    }
    try {
      await api.post("/finance/journal-entries", {
        entryDate: iso,
        description: jeForm.description || undefined,
        lines,
      });
      setMsg("تم إنشاء القيد (مسودة).");
      setJeForm({ entryDate: jeForm.entryDate, description: "", lines: [emptyLine(), emptyLine()] });
      await loadJournals();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const onPostJournal = async (id) => {
    setErr("");
    setMsg("");
    try {
      await api.post(`/finance/journal-entries/${id}/post`, {});
      setMsg("تم ترحيل القيد.");
      await loadJournals();
      await loadJeDetail(id);
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const onVoidJournal = async (id) => {
    if (!window.confirm("إلغاء القيد المرحّل؟")) return;
    setErr("");
    setMsg("");
    try {
      await api.post(`/finance/journal-entries/${id}/void`, {});
      setMsg("تم إلغاء القيد.");
      await loadJournals();
      await loadJeDetail(id);
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const onDeleteDraft = async (id) => {
    if (!window.confirm("حذف المسودة؟")) return;
    setErr("");
    setMsg("");
    try {
      await api.delete(`/finance/journal-entries/${id}`);
      setMsg("تم الحذف.");
      setSelectedJeId("");
      await loadJournals();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const runTrialBalance = async () => {
    setErr("");
    const f = parseDisplayToIso(tbFrom);
    const t = parseDisplayToIso(tbTo);
    if (!f || !t) {
      setErr("تواريخ ميزان المراجعة غير صالحة.");
      return;
    }
    try {
      const r = await api.get("/finance/reports/trial-balance", { from: f, to: t });
      setTbRows(r.rows ?? []);
      setMsg(`ميزان مراجعة: ${r.rows?.length ?? 0} حساب`);
    } catch (e2) {
      setErr(e2.message);
      setTbRows([]);
    }
  };

  const runLedger = async () => {
    setErr("");
    if (!ledgerAcc) {
      setErr("اختر حساباً لدفتر الأستاذ.");
      return;
    }
    const f = parseDisplayToIso(lgFrom);
    const t = parseDisplayToIso(lgTo);
    if (!f || !t) {
      setErr("تواريخ دفتر الأستاذ غير صالحة.");
      return;
    }
    try {
      const r = await api.get("/finance/reports/ledger", {
        accountId: ledgerAcc,
        from: f,
        to: t,
      });
      setLedgerData(r);
      setMsg("تم تحميل حركة الحساب.");
    } catch (e2) {
      setErr(e2.message);
      setLedgerData(null);
    }
  };

  const updateJeLine = (i, field, val) => {
    setJeForm((prev) => {
      const lines = [...prev.lines];
      lines[i] = { ...lines[i], [field]: val };
      return { ...prev, lines };
    });
  };

  const addJeLine = () => {
    setJeForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  };

  const noFiscal = fiscalYears.length === 0;

  return (
    <div className="finance-page io-page" dir="rtl">
      <div className="io-workarea">
        <h2 className="finance-title">المحاسبة العامة (GL)</h2>
        {noFiscal ? (
          <div className="finance-banner">
            لا توجد سنة مالية في النظام. نفّذ من مجلد <code>backend</code>:{" "}
            <code>npx prisma migrate deploy</code> ثم <code>npx prisma db seed</code> لإنشاء سنة 2026
            ودليل حسابات أولي.
          </div>
        ) : null}
        {err ? <div className="finance-err">{err}</div> : null}
        {msg ? <div className="finance-msg">{msg}</div> : null}

        <div className="finance-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`finance-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => {
                setTab(t.id);
                setMsg("");
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "accounts" ? (
          <div className="finance-section">
            <h3>إضافة حساب</h3>
            <form className="finance-form" onSubmit={onCreateAccount}>
              <label>
                الرمز
                <input
                  value={newAcc.code}
                  onChange={(e) => setNewAcc((p) => ({ ...p, code: e.target.value }))}
                  className="io-date-input"
                  style={{ width: 100 }}
                />
              </label>
              <label>
                الاسم (EN)
                <input
                  value={newAcc.name}
                  onChange={(e) => setNewAcc((p) => ({ ...p, name: e.target.value }))}
                  className="io-date-input"
                  style={{ minWidth: 160 }}
                />
              </label>
              <label>
                الاسم (عربي)
                <input
                  value={newAcc.nameAr}
                  onChange={(e) => setNewAcc((p) => ({ ...p, nameAr: e.target.value }))}
                  className="io-date-input"
                  style={{ minWidth: 140 }}
                />
              </label>
              <label>
                التصنيف
                <select
                  className="io-select"
                  value={newAcc.class}
                  onChange={(e) => setNewAcc((p) => ({ ...p, class: e.target.value }))}
                >
                  {GL_CLASSES.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.l}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="io-btn-primary">
                حفظ حساب
              </button>
            </form>

            <h3>الحسابات</h3>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>رمز</th>
                    <th>اسم</th>
                    <th>عربي</th>
                    <th>تصنيف</th>
                    <th>ترحيل</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td dir="ltr">{a.code}</td>
                      <td>{a.name}</td>
                      <td>{a.nameAr ?? ""}</td>
                      <td>{a.class}</td>
                      <td>{a.isPosting ? "نعم" : "لا"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "journals" ? (
          <div className="finance-section">
            <h3>قيد جديد (مسودة)</h3>
            <form className="finance-form-vertical" onSubmit={onCreateJournal}>
              <label>
                التاريخ
                <input
                  value={jeForm.entryDate}
                  onChange={(e) => setJeForm((p) => ({ ...p, entryDate: e.target.value }))}
                  className="io-date-input"
                />
              </label>
              <label>
                البيان
                <input
                  value={jeForm.description}
                  onChange={(e) => setJeForm((p) => ({ ...p, description: e.target.value }))}
                  className="io-date-input"
                  style={{ minWidth: 280 }}
                />
              </label>
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>حساب</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>تفاصيل سطر</th>
                  </tr>
                </thead>
                <tbody>
                  {jeForm.lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          className="io-select"
                          style={{ minWidth: 200 }}
                          value={line.accountId}
                          onChange={(e) => updateJeLine(i, "accountId", e.target.value)}
                        >
                          <option value="">—</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.nameAr || a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="io-date-input"
                          style={{ width: 90 }}
                          value={line.debit}
                          onChange={(e) => updateJeLine(i, "debit", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="io-date-input"
                          style={{ width: 90 }}
                          value={line.credit}
                          onChange={(e) => updateJeLine(i, "credit", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="io-date-input"
                          style={{ minWidth: 160 }}
                          value={line.description}
                          onChange={(e) => updateJeLine(i, "description", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="finance-row-btns">
                <button type="button" className="io-btn" onClick={addJeLine}>
                  + سطر
                </button>
                <button type="submit" className="io-btn-primary">
                  إنشاء مسودة
                </button>
              </div>
            </form>

            <h3>القيود</h3>
            <div className="finance-split">
              <ul className="finance-list">
                {journals.map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      className={selectedJeId === j.id ? "active" : ""}
                      onClick={() => setSelectedJeId(j.id)}
                    >
                      {j.entryNo} — {formatIsoToDisplay(j.entryDate)} — {j.status}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="finance-detail">
                {jeDetail ? (
                  <>
                    <p>
                      <strong>{jeDetail.entryNo}</strong> — {jeDetail.status} —{" "}
                      {formatIsoToDisplay(jeDetail.entryDate)}
                    </p>
                    <p>{jeDetail.description ?? ""}</p>
                    <table className="finance-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>مدين</th>
                          <th>دائن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(jeDetail.lines ?? []).map((l) => (
                          <tr key={l.id}>
                            <td>{l.lineNo}</td>
                            <td>{l.debit}</td>
                            <td>{l.credit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="finance-row-btns">
                      {jeDetail.status === "DRAFT" ? (
                        <>
                          <button type="button" className="io-btn-primary" onClick={() => onPostJournal(jeDetail.id)}>
                            ترحيل
                          </button>
                          <button type="button" className="io-btn" onClick={() => onDeleteDraft(jeDetail.id)}>
                            حذف مسودة
                          </button>
                        </>
                      ) : null}
                      {jeDetail.status === "POSTED" ? (
                        <button type="button" className="io-btn" onClick={() => onVoidJournal(jeDetail.id)}>
                          إلغاء (Void)
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p>اختر قيداً من القائمة.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "reports" ? (
          <div className="finance-section">
            <h3>ميزان المراجعة</h3>
            <div className="finance-form">
              <label>
                من
                <input className="io-date-input" value={tbFrom} onChange={(e) => setTbFrom(e.target.value)} />
              </label>
              <label>
                إلى
                <input className="io-date-input" value={tbTo} onChange={(e) => setTbTo(e.target.value)} />
              </label>
              <button type="button" className="io-btn-primary" onClick={runTrialBalance}>
                عرض
              </button>
            </div>
            <table className="finance-table">
              <thead>
                <tr>
                  <th>رمز</th>
                  <th>حساب</th>
                  <th>مدين</th>
                  <th>دائن</th>
                  <th>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {tbRows.map((r) => (
                  <tr key={r.accountId}>
                    <td dir="ltr">{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.debit}</td>
                    <td>{r.credit}</td>
                    <td>{r.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>دفتر أستاذ</h3>
            <div className="finance-form">
              <select
                className="io-select"
                style={{ minWidth: 220 }}
                value={ledgerAcc}
                onChange={(e) => setLedgerAcc(e.target.value)}
              >
                <option value="">— حساب —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.nameAr || a.name}
                  </option>
                ))}
              </select>
              <label>
                من
                <input className="io-date-input" value={lgFrom} onChange={(e) => setLgFrom(e.target.value)} />
              </label>
              <label>
                إلى
                <input className="io-date-input" value={lgTo} onChange={(e) => setLgTo(e.target.value)} />
              </label>
              <button type="button" className="io-btn-primary" onClick={runLedger}>
                عرض الحركة
              </button>
            </div>
            {ledgerData ? (
              <>
                <p>رصيد افتتاحي: {ledgerData.openingBalance}</p>
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>قيد</th>
                      <th>تاريخ</th>
                      <th>مدين</th>
                      <th>دائن</th>
                      <th>رصيد جاري</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledgerData.rows ?? []).map((r, i) => (
                      <tr key={i}>
                        <td dir="ltr">{r.entryNo}</td>
                        <td>{formatIsoToDisplay(r.entryDate)}</td>
                        <td>{r.debit}</td>
                        <td>{r.credit}</td>
                        <td>{r.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        ) : null}

        {tab === "audit" ? (
          <div className="finance-section">
            <h3>آخر الأحداث</h3>
            <div className="finance-form">
              <input className="io-date-input" placeholder="نوع الكيان" value={auditEntityType} onChange={(e) => setAuditEntityType(e.target.value)} />
              <input className="io-date-input" placeholder="معرّف المستخدم" value={auditUserId} onChange={(e) => setAuditUserId(e.target.value)} />
              <input className="io-date-input" type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
              <input className="io-date-input" type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
              <button
                type="button"
                className="io-btn-primary"
                onClick={async () => {
                  const r = await api.get("/finance/audit-log", {
                    page: 1,
                    pageSize: 80,
                    entityType: auditEntityType || undefined,
                    userId: auditUserId || undefined,
                    from: auditFrom || undefined,
                    to: auditTo || undefined,
                  });
                  setAuditItems(r.items ?? []);
                }}
              >
                فلترة
              </button>
            </div>
            <table className="finance-table">
              <thead>
                <tr>
                  <th>وقت</th>
                  <th>إجراء</th>
                  <th>كيان</th>
                  <th>معرّف</th>
                  <th>مستخدم</th>
                </tr>
              </thead>
              <tbody>
                {auditItems.map((a) => (
                  <tr key={a.id}>
                    <td>{formatIsoToDisplay(a.createdAt)}</td>
                    <td>{a.action}</td>
                    <td>{a.entityType}</td>
                    <td dir="ltr" style={{ fontSize: 10 }}>
                      {a.entityId.slice(0, 8)}…
                    </td>
                    <td>{a.user?.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {tab === "fx" ? (
          <div className="finance-section">
            <h3>إدارة أسعار الصرف</h3>
            <form
              className="finance-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await api.post("/finance/exchange-rates", { label: rateLabel, rate: rateValue });
                setRateValue("");
                loadRates();
              }}
            >
              <input className="io-date-input" value={rateLabel} onChange={(e) => setRateLabel(e.target.value)} />
              <input className="io-date-input" value={rateValue} onChange={(e) => setRateValue(e.target.value)} placeholder="rate" />
              <button type="submit" className="io-btn-primary">حفظ</button>
            </form>
            <table className="finance-table">
              <thead>
                <tr><th>العملة</th><th>السعر</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}><td>{r.label}</td><td>{String(r.rate)}</td><td>{formatIsoToDisplay(r.asOf)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
