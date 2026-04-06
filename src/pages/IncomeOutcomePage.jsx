import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatIsoToDisplay, parseDisplayToIso, toApiDateTime } from "../lib/dates.js";
import "./IncomeOutcomePage.css";

const TABLE_COLUMNS = [
  { key: "entryDate", label: "التاريخ", className: "io-legacy-col-date" },
  { key: "documentNo", label: "رقم المستند", className: "io-legacy-col-doc" },
  { key: "fees", label: "رسوم", className: "io-legacy-col-fees" },
  { key: "amountUsd", label: "دولار", className: "io-legacy-col-usd" },
  { key: "detailsText", label: "جملة التفاصيل", className: "io-legacy-col-details" },
  { key: "amountJineh", label: "جنيه", className: "io-legacy-col-jineh" },
];

const CURRENCIES = [
  { value: "دولار", label: "دولار" },
  { value: "دينار", label: "دينار" },
];

function text(v) {
  if (v == null || v === "") return "";
  return String(v);
}

function toNullableText(v) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function todayDisplay() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function normalizeNumberInput(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[،,]/g, "");
  if (s === ".") return "";
  if (s.startsWith(".")) return `0${s}`;
  if (s.startsWith("-.")) return `-0${s.slice(1)}`;
  return s;
}

function autoDocNo(kind) {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const prefix = kind === "EXPENSE" ? "EXP" : "REV";
  return `${prefix}-${y}${mo}${d}-${hh}${mm}${ss}${ms}`;
}

function IncomeOutcomePanel({
  kind,
  title,
  caption,
  quickValue,
  quickInputClass,
  rows,
  selectedKey,
  onQuickChange,
  onQuickSubmit,
  onSelect,
  onDelete,
  onEdit,
  onUndo,
}) {
  return (
    <section className="io-legacy-block">
      <div className="io-legacy-title-row">
        <form
          className="io-legacy-title-form"
          onSubmit={(e) => {
            e.preventDefault();
            onQuickSubmit(kind);
          }}
        >
          <input
            className={`io-legacy-title-input ${quickInputClass}`}
            value={quickValue}
            onChange={(e) => onQuickChange(kind, e.target.value)}
            placeholder={kind === "EXPENSE" ? "اكتب قيمة المصروف ثم اضغط Enter" : "اكتب قيمة الإيراد ثم اضغط Enter"}
          />
        </form>
        <h2 className="io-legacy-title-text">{title}</h2>
      </div>

      <div className="io-legacy-frame">
        <div className="io-legacy-body">
          <aside className="io-legacy-actions">
            <button
              type="button"
              className="io-legacy-action-btn io-legacy-action-btn--danger"
              onClick={() => onDelete(kind)}
            >
              حذف
            </button>
            <button type="button" className="io-legacy-action-btn" onClick={() => onEdit(kind)}>
              تعديل
            </button>
            <button type="button" className="io-legacy-action-btn" onClick={onUndo}>
              تراجع
            </button>
            <div className="io-legacy-enter-hint">Enter: إضافة سريعة</div>
          </aside>

          <div className="io-legacy-table-wrap">
            <table className="io-legacy-table">
              <thead>
                <tr>
                  <th className="io-legacy-caption" colSpan={TABLE_COLUMNS.length}>
                    {caption}
                  </th>
                </tr>
                <tr>
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col.key} className={col.className}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="io-legacy-empty-cell" />
                  </tr>
                ) : (
                  rows.map((row) => {
                    const rowKey = `${kind}:${row.id}`;
                    const isSelected = selectedKey === rowKey;
                    return (
                      <tr
                        key={row.id}
                        className={`io-legacy-row ${isSelected ? "is-selected" : ""}`}
                        onClick={() => onSelect(rowKey, row)}
                      >
                        <td className="io-legacy-col-date">{formatIsoToDisplay(row.entryDate)}</td>
                        <td className="io-legacy-col-doc">{text(row.documentNo)}</td>
                        <td className="io-legacy-col-fees">{text(row.fees)}</td>
                        <td className="io-legacy-col-usd">{text(row.amountUsd)}</td>
                        <td className="io-legacy-col-details io-legacy-cell-details">{text(row.detailsText)}</td>
                        <td className="io-legacy-col-jineh">{text(row.amountJineh)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function IncomeOutcomePage() {
  const [dateValue, setDateValue] = useState(() => todayDisplay());
  const [currency, setCurrency] = useState("دولار");
  const [exchangeRate, setExchangeRate] = useState("6.8");
  const [quickValues, setQuickValues] = useState({ EXPENSE: "", REVENUE: "" });
  const [expenseRows, setExpenseRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [err, setErr] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  const fetchRows = useCallback(async () => {
    const dateIso = parseDisplayToIso(dateValue);
    const query = { currency, page: 1, pageSize: 200 };
    if (dateIso) query.date = dateIso;

    const [expensesRes, revenuesRes] = await Promise.all([
      api.get("/income-outcome", { ...query, kind: "EXPENSE" }),
      api.get("/income-outcome", { ...query, kind: "REVENUE" }),
    ]);

    return {
      expenses: expensesRes.items ?? [],
      revenues: revenuesRes.items ?? [],
    };
  }, [currency, dateValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRows();
        if (cancelled) return;
        setExpenseRows(data.expenses);
        setRevenueRows(data.revenues);
        setSelectedKey("");
        setSelectedRow(null);
        setErr("");
      } catch (e) {
        if (cancelled) return;
        setExpenseRows([]);
        setRevenueRows([]);
        setErr(e?.message || "فشل تحميل البيانات");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRows]);

  const refresh = useCallback(async () => {
    const data = await fetchRows();
    setExpenseRows(data.expenses);
    setRevenueRows(data.revenues);
    setErr("");
  }, [fetchRows]);

  const clearSelection = () => {
    setSelectedKey("");
    setSelectedRow(null);
  };

  const onSelect = (key, row) => {
    setSelectedKey(key);
    setSelectedRow(row);
  };

  const onQuickChange = (kind, value) => {
    setQuickValues((prev) => ({ ...prev, [kind]: value }));
  };

  const onQuickSubmit = async (kind) => {
    const amount = normalizeNumberInput(quickValues[kind]);
    if (!amount) return;
    if (!/^-?\d+(\.\d+)?$/.test(amount)) {
      window.alert("القيمة غير صالحة. أدخل رقمًا فقط.");
      return;
    }

    const today = todayDisplay();
    const entryDate = toApiDateTime(today);
    if (!entryDate) {
      setErr("تعذر قراءة تاريخ اليوم");
      return;
    }

    const isUsd = currency === "دولار";

    try {
      await api.post("/income-outcome", {
        kind,
        entryDate,
        currency,
        documentNo: autoDocNo(kind),
        fees: "0",
        amountUsd: isUsd ? amount : "0",
        amountJineh: isUsd ? "0" : amount,
        amountRmb: null,
        detailsText: null,
      });

      setQuickValues((prev) => ({ ...prev, [kind]: "" }));
      clearSelection();

      if (dateValue !== today) {
        setDateValue(today);
      } else {
        await refresh();
      }
    } catch (e) {
      window.alert(e?.message || "تعذر الإضافة السريعة");
      setErr(e?.message || "تعذر الإضافة السريعة");
    }
  };

  const onDelete = async (kind) => {
    if (!selectedRow || !selectedKey.startsWith(`${kind}:`)) {
      window.alert("اختر سطرًا من نفس الجدول أولًا");
      return;
    }

    if (!window.confirm("تأكيد حذف السجل المحدد؟")) return;

    try {
      await api.delete(`/income-outcome/${selectedRow.id}`);
      clearSelection();
      await refresh();
    } catch (e) {
      setErr(e?.message || "تعذر حذف السجل");
    }
  };

  const onEdit = async (kind) => {
    if (!selectedRow || !selectedKey.startsWith(`${kind}:`)) {
      window.alert("اختر سطرًا أولًا ثم اضغط تعديل");
      return;
    }

    const fees = window.prompt("رسوم", text(selectedRow.fees ?? "0"));
    if (fees == null) return;

    const usd = window.prompt("دولار", text(selectedRow.amountUsd ?? "0"));
    if (usd == null) return;

    const jineh = window.prompt("جنيه", text(selectedRow.amountJineh ?? "0"));
    if (jineh == null) return;

    const details = window.prompt("التفاصيل", text(selectedRow.detailsText));
    if (details == null) return;

    try {
      await api.patch(`/income-outcome/${selectedRow.id}`, {
        fees: fees || "0",
        amountUsd: usd || "0",
        amountJineh: jineh || "0",
        detailsText: toNullableText(details),
      });
      await refresh();
    } catch (e) {
      setErr(e?.message || "تعذر تعديل السجل");
    }
  };

  return (
    <div className="io-legacy-page" dir="rtl">
      <div className="io-legacy-workarea">
        {err ? <div className="io-legacy-alert">{err}</div> : null}

        <div className="io-legacy-toolbar">
          <div className="io-legacy-toolbar-row">
            <label className="io-legacy-label" htmlFor="io-currency">
              نوع العملة
            </label>
            <select
              id="io-currency"
              className="io-legacy-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="io-legacy-label" htmlFor="io-date">
              التاريخ
            </label>
            <input
              id="io-date"
              className="io-legacy-input io-legacy-date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              placeholder="dd/mm/yyyy"
            />
          </div>

          <div className="io-legacy-toolbar-row io-legacy-rate-row">
            <span className="io-legacy-rate-label">سعر الدولار</span>
            <input
              className="io-legacy-input io-legacy-rate-input"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
            <span className="io-legacy-rate-label">سعر الصرف</span>
          </div>
        </div>

        <IncomeOutcomePanel
          kind="EXPENSE"
          title="مصاريف"
          caption="المصروف اليومي يتم ترحيل اليومية لهذا اليوم"
          quickValue={quickValues.EXPENSE}
          quickInputClass="io-legacy-title-input--expense"
          rows={expenseRows}
          selectedKey={selectedKey}
          onQuickChange={onQuickChange}
          onQuickSubmit={onQuickSubmit}
          onSelect={onSelect}
          onDelete={onDelete}
          onEdit={onEdit}
          onUndo={clearSelection}
        />

        <IncomeOutcomePanel
          kind="REVENUE"
          title="إيرادات"
          caption="إيرادات اليوم يتم ترحيل اليومية لهذا اليوم"
          quickValue={quickValues.REVENUE}
          quickInputClass="io-legacy-title-input--income"
          rows={revenueRows}
          selectedKey={selectedKey}
          onQuickChange={onQuickChange}
          onQuickSubmit={onQuickSubmit}
          onSelect={onSelect}
          onDelete={onDelete}
          onEdit={onEdit}
          onUndo={clearSelection}
        />
      </div>
    </div>
  );
}
