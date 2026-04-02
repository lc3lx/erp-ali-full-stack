import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { GlIncomeOutcomePost } from "../components/GlDocumentPost.jsx";
import { formatIsoToDisplay, parseDisplayToIso, toApiDateTime } from "../lib/dates.js";
import "../App.css";

const TABLE_COLS = ["", "التاريخ", "رقم المستند", "رسوم", "دولار", "جملة التفاصيل"];

function str(v) {
  if (v == null || v === "") return "";
  return String(v);
}

function IoTable({ caption, rows, kind, selectedId, onSelect }) {
  return (
    <table className="io-table">
      <colgroup>
        <col className="io-col-side" />
        <col className="io-col-date" />
        <col className="io-col-no" />
        <col className="io-col-fee" />
        <col className="io-col-usd" />
        <col className="io-col-details" />
      </colgroup>
      <thead>
        <tr>
          <th className="io-th-blank" />
          <th className="io-th-caption" colSpan={5}>
            {caption}
          </th>
        </tr>
        <tr>
          {TABLE_COLS.map((c, idx) => (
            <th key={`${c}-${idx}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="io-empty-cell" />
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              style={{
                cursor: "pointer",
                background: selectedId === `${kind}:${row.id}` ? "#f0e8ff" : undefined,
              }}
              onClick={() => onSelect(`${kind}:${row.id}`, row)}
            >
              <td />
              <td>{formatIsoToDisplay(row.entryDate)}</td>
              <td>{row.documentNo ?? ""}</td>
              <td>{str(row.fees)}</td>
              <td>{str(row.usdAmount)}</td>
              <td>{row.detailsText ?? ""}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default function IncomeOutcomePage() {
  const [dateValue, setDateValue] = useState("30/01/2026");
  const [currency, setCurrency] = useState("دولار");
  const [expenseRows, setExpenseRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [err, setErr] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const dateIso = parseDisplayToIso(dateValue);
    const q = { currency, page: 1, pageSize: 200 };
    if (dateIso) q.date = dateIso;
    (async () => {
      try {
        const [exp, rev] = await Promise.all([
          api.get("/income-outcome", { ...q, kind: "EXPENSE" }),
          api.get("/income-outcome", { ...q, kind: "REVENUE" }),
        ]);
        if (cancelled) return;
        setExpenseRows(exp.items ?? []);
        setRevenueRows(rev.items ?? []);
        setErr("");
      } catch (e) {
        if (!cancelled) {
          setErr(e.message);
          setExpenseRows([]);
          setRevenueRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateValue, currency]);

  const refresh = async () => {
    const dateIso = parseDisplayToIso(dateValue);
    const q = { currency, page: 1, pageSize: 200 };
    if (dateIso) q.date = dateIso;
    const [exp, rev] = await Promise.all([
      api.get("/income-outcome", { ...q, kind: "EXPENSE" }),
      api.get("/income-outcome", { ...q, kind: "REVENUE" }),
    ]);
    setExpenseRows(exp.items ?? []);
    setRevenueRows(rev.items ?? []);
  };

  const onSelect = (key, row) => {
    setSelectedKey(key);
    setSelectedRow(row);
  };

  const onAdd = async (kind) => {
    const entryDate = toApiDateTime(dateValue);
    if (!entryDate) {
      window.alert("تاريخ غير صالح");
      return;
    }
    try {
      await api.post("/income-outcome", {
        kind,
        entryDate,
        currency,
        documentNo: window.prompt("رقم المستند؟", "") || null,
        fees: window.prompt("رسوم؟", "0") || "0",
        usdAmount: window.prompt("مبلغ دولار؟", "0") || "0",
        detailsText: window.prompt("تفاصيل؟", "") || null,
      });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDelete = async (kind) => {
    if (!selectedRow || !selectedKey.startsWith(`${kind}:`)) {
      window.alert("اختر صفاً من الجدول المناسب");
      return;
    }
    if (!window.confirm("حذف السجل؟")) return;
    try {
      await api.delete(`/income-outcome/${selectedRow.id}`);
      setSelectedKey("");
      setSelectedRow(null);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  const onEdit = async (kind) => {
    if (!selectedRow || !selectedKey.startsWith(`${kind}:`)) {
      window.alert("اختر صفاً للتعديل");
      return;
    }
    const fees = window.prompt("رسوم", str(selectedRow.fees));
    const usd = window.prompt("دولار", str(selectedRow.usdAmount));
    const details = window.prompt("تفاصيل", selectedRow.detailsText ?? "");
    const docNo = window.prompt("رقم المستند", selectedRow.documentNo ?? "");
    try {
      const d = selectedRow.entryDate ? new Date(selectedRow.entryDate) : null;
      await api.patch(`/income-outcome/${selectedRow.id}`, {
        fees: fees ?? undefined,
        usdAmount: usd ?? undefined,
        detailsText: details ?? undefined,
        documentNo: docNo ?? undefined,
        entryDate: d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined,
      });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="io-page" dir="rtl">
      {err ? <div className="alert-error" style={{ margin: 6 }}>{err}</div> : null}
      <div className="io-workarea">
        <div className="io-top">
          <div className="io-top-right">
            <div className="io-top-row">
              <span className="io-small-txt">نوع العملة</span>
              <select className="io-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="دولار">دولار</option>
                <option value="دينار">دينار</option>
              </select>
              <span className="io-small-txt">التاريخ</span>
              <input className="io-date-input" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>
            <div className="io-top-row">
              <span className="io-rate-label">الحركة هنا تعتمد عملة القيد فقط</span>
            </div>
          </div>
        </div>

        {selectedRow ? (
          <GlIncomeOutcomePost
            entryId={selectedRow.id}
            kind={selectedRow.kind}
            glJournalEntryId={selectedRow.glJournalEntryId}
            onPosted={refresh}
          />
        ) : null}

        <div className="io-panel io-panel-expense">
          <div className="io-heading-row">
            <span className="io-heading-text">مصاريف</span>
            <span className="io-heading-fill io-heading-fill-expense" aria-hidden />
          </div>
          <div className="io-panel-body">
            <div className="io-actions">
              <button type="button" className="io-action io-action-red" onClick={() => onDelete("EXPENSE")}>
                حذف
              </button>
              <button type="button" className="io-action io-action-grey" onClick={() => onEdit("EXPENSE")}>
                تعديل
              </button>
              <button type="button" className="io-action io-action-grey" onClick={() => onAdd("EXPENSE")}>
                إضافة
              </button>
            </div>
            <div className="io-table-shell">
              <IoTable
                caption="المصاريف اليومية لمترجم الحاوية لهذا اليوم"
                rows={expenseRows}
                kind="EXPENSE"
                selectedId={selectedKey}
                onSelect={onSelect}
              />
            </div>
          </div>
        </div>

        <div className="io-panel io-panel-income">
          <div className="io-heading-row">
            <span className="io-heading-text">إيرادات</span>
            <span className="io-heading-fill io-heading-fill-income" aria-hidden />
          </div>
          <div className="io-panel-body">
            <div className="io-actions">
              <button type="button" className="io-action io-action-red" onClick={() => onDelete("REVENUE")}>
                حذف
              </button>
              <button type="button" className="io-action io-action-grey" onClick={() => onEdit("REVENUE")}>
                تعديل
              </button>
              <button type="button" className="io-action io-action-grey" onClick={() => onAdd("REVENUE")}>
                إضافة
              </button>
            </div>
            <div className="io-table-shell">
              <IoTable
                caption="ايرادات اليومية لمترجم الحاوية لهذا اليوم"
                rows={revenueRows}
                kind="REVENUE"
                selectedId={selectedKey}
                onSelect={onSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
