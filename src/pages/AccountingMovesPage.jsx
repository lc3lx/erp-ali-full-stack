import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatIsoToDisplay, parseDisplayToIso, toApiDateTime } from "../lib/dates.js";
import "../App.css";

const MOVE_COLS_OUT = ["dinar", "jineh", "$", "remimby", "No", "detailes", "date"];
const MOVE_COLS_IN = ["dinar", "jineh", "$", "remimby", "no", "detailes", "date"];

function str(v) {
  if (v == null || v === "") return "";
  return String(v);
}

export default function AccountingMovesPage() {
  const [reportFrom, setReportFrom] = useState("30/01/2026");
  const [reportTo, setReportTo] = useState("30/01/2026");
  const [moveDate, setMoveDate] = useState("30/01/2026");
  const [exchangeRate, setExchangeRate] = useState("6.8");
  const [currencyTop, setCurrencyTop] = useState("دولار");
  const [search, setSearch] = useState("");
  const [currencyOut, setCurrencyOut] = useState("دولار");
  const [currencyIn, setCurrencyIn] = useState("دولار");
  const [searchRows, setSearchRows] = useState([]);
  const [move, setMove] = useState(null);
  const [totals, setTotals] = useState(null);
  const [err, setErr] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [moveList, setMoveList] = useState([]);
  const hydrateMoveHeader = (m) => {
    setMoveDate(formatIsoToDisplay(m.moveDate) || "");
    setReportFrom(formatIsoToDisplay(m.reportFrom) || "");
    setReportTo(formatIsoToDisplay(m.reportTo) || "");
    setExchangeRate(str(m.exchangeRate ?? ""));
    setCurrencyTop(m.topCurrency ?? "دولار");
    setSearch(m.searchQuery ?? "");
  };

  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          const r = await api.get("/accounting-moves/customer-discounts", { q: search || " " });
          setSearchRows(
            (r.items ?? []).map((x) => ({
              customer: x.name,
              discount: x.saleDiscountDefault != null ? str(x.saleDiscountDefault) : "0",
            })),
          );
        } catch {
          setSearchRows([]);
        }
      })();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadMove = useCallback(async () => {
    setErr("");
    try {
      const list = await api.get("/accounting-moves", { page: 1, pageSize: 50 });
      setMoveList(list.items ?? []);
      const id = list.items?.[0]?.id;
      if (!id) {
        setMove(null);
        setTotals(null);
        return;
      }
      const [m, tt] = await Promise.all([api.get(`/accounting-moves/${id}`), api.get(`/accounting-moves/${id}/totals`)]);
      setMove(m);
      setTotals(tt);
      hydrateMoveHeader(m);
    } catch (e) {
      setErr(e.message);
      setMove(null);
      setTotals(null);
    }
  }, []);

  useEffect(() => {
    loadMove();
  }, [loadMove]);

  const lines = move?.lines ?? [];
  const linesOut = lines.filter((l) => l.direction === "OUT");
  const linesIn = lines.filter((l) => l.direction === "IN");
  const outSum = totals?.out;
  const inSum = totals?.in;

  const currentMoveId = move?.id;

  const onNewMove = async () => {
    const md = toApiDateTime(moveDate);
    if (!md) {
      window.alert("تاريخ الحركة غير صالح");
      return;
    }
    try {
      const rf = toApiDateTime(reportFrom);
      const rt = toApiDateTime(reportTo);
      const m = await api.post("/accounting-moves", {
        moveDate: md,
        reportFrom: rf ?? null,
        reportTo: rt ?? null,
        exchangeRate: exchangeRate || null,
        topCurrency: currencyTop,
        searchQuery: search || null,
      });
      const list = await api.get("/accounting-moves", { page: 1, pageSize: 50 });
      setMoveList(list.items ?? []);
      const [mm, tt] = await Promise.all([
        api.get(`/accounting-moves/${m.id}`),
        api.get(`/accounting-moves/${m.id}/totals`),
      ]);
      setMove(mm);
      setTotals(tt);
      setSelectedLineId("");
    } catch (e) {
      setErr(e.message);
    }
  };

  const onSaveMoveHeader = async () => {
    if (!currentMoveId) return;
    const md = toApiDateTime(moveDate);
    try {
      await api.patch(`/accounting-moves/${currentMoveId}`, {
        moveDate: md,
        reportFrom: toApiDateTime(reportFrom) ?? null,
        reportTo: toApiDateTime(reportTo) ?? null,
        exchangeRate: exchangeRate || null,
        topCurrency: currencyTop,
        searchQuery: search || null,
      });
      const [mm, tt] = await Promise.all([
        api.get(`/accounting-moves/${currentMoveId}`),
        api.get(`/accounting-moves/${currentMoveId}/totals`),
      ]);
      setMove(mm);
      setTotals(tt);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onAddLine = async (direction) => {
    if (!currentMoveId) {
      window.alert("أنشئ حركة محاسبية أولاً");
      return;
    }
    const ld = parseDisplayToIso(moveDate);
    try {
      await api.post(`/accounting-moves/${currentMoveId}/lines`, {
        direction,
        panelCurrency: direction === "OUT" ? currencyOut : currencyIn,
        dinar: window.prompt("دينار؟", "0") || undefined,
        usd: window.prompt("دولار؟", "0") || undefined,
        details: window.prompt("تفاصيل؟", "") || undefined,
        lineDate: ld ?? undefined,
      });
      const [mm, tt] = await Promise.all([
        api.get(`/accounting-moves/${currentMoveId}`),
        api.get(`/accounting-moves/${currentMoveId}/totals`),
      ]);
      setMove(mm);
      setTotals(tt);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDeleteLine = async () => {
    if (!currentMoveId || !selectedLineId || !window.confirm("حذف السطر؟")) return;
    try {
      await api.delete(`/accounting-moves/${currentMoveId}/lines/${selectedLineId}`);
      setSelectedLineId("");
      const [mm, tt] = await Promise.all([
        api.get(`/accounting-moves/${currentMoveId}`),
        api.get(`/accounting-moves/${currentMoveId}/totals`),
      ]);
      setMove(mm);
      setTotals(tt);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onEditLine = async () => {
    if (!currentMoveId || !selectedLineId) return;
    const row = lines.find((x) => x.id === selectedLineId);
    if (!row) return;
    const details = window.prompt("تفاصيل السطر", row.details ?? "");
    if (details == null) return;
    const usd = window.prompt("دولار", str(row.usd ?? ""));
    if (usd == null) return;
    const dinar = window.prompt("دينار", str(row.dinar ?? ""));
    if (dinar == null) return;
    try {
      await api.patch(`/accounting-moves/${currentMoveId}/lines/${selectedLineId}`, {
        details,
        usd: Number(usd) || 0,
        dinar: Number(dinar) || 0,
      });
      const [mm, tt] = await Promise.all([
        api.get(`/accounting-moves/${currentMoveId}`),
        api.get(`/accounting-moves/${currentMoveId}/totals`),
      ]);
      setMove(mm);
      setTotals(tt);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDeleteMove = async () => {
    if (!currentMoveId || !window.confirm("حذف الحركة بالكامل؟")) return;
    try {
      await api.delete(`/accounting-moves/${currentMoveId}`);
      await loadMove();
      setSelectedLineId("");
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="am-page" dir="ltr">
      {err ? <div className="alert-error" style={{ margin: 6 }}>{err}</div> : null}
      <div className="am-titlebar">Accounting Moves</div>

      <div className="am-top">
        <div className="am-top-left">
          <div className="am-row am-row-rtl" dir="rtl">
            <span className="am-lbl">report date from</span>
            <input
              type="text"
              className="am-field am-field-date"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
            />
            <span className="am-lbl">to</span>
            <input
              type="text"
              className="am-field am-field-date"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
            />
          </div>
          <div className="am-row am-row-rtl" dir="rtl">
            <span className="am-lbl">move date</span>
            <input
              type="text"
              className="am-field am-field-date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
            />
          </div>
          <div className="am-row am-row-rtl" dir="rtl">
            <span className="am-lbl am-lbl-red">china exchange rate</span>
            <input
              type="text"
              className="am-field am-field-rate"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
          </div>
          <div className="am-row am-row-rtl" dir="rtl" style={{ gap: 8, marginTop: 6 }}>
            <button type="button" className="am-btn-report" onClick={onNewMove}>
              حركة جديدة
            </button>
            <button type="button" className="am-btn-report" onClick={onSaveMoveHeader}>
              حفظ رأس الحركة
            </button>
            <span className="am-lbl">اختر حركة:</span>
            <select
              className="am-field"
              value={currentMoveId ?? ""}
              onChange={async (e) => {
                const id = e.target.value;
                if (!id) return;
                const [mm, tt] = await Promise.all([
                  api.get(`/accounting-moves/${id}`),
                  api.get(`/accounting-moves/${id}/totals`),
                ]);
                setMove(mm);
                setTotals(tt);
                hydrateMoveHeader(mm);
                setSelectedLineId("");
              }}
            >
              {moveList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id.slice(0, 8)}… {formatIsoToDisplay(m.moveDate)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="am-top-right">
          <div className="am-search-block">
            <div className="am-search-row">
              <span className="am-lbl">currency</span>
              <select
                className="am-field am-select"
                value={currencyTop}
                onChange={(e) => setCurrencyTop(e.target.value)}
              >
                <option value="دولار">دولار</option>
                <option value="دينار">دينار</option>
              </select>
              <span className="am-lbl">serch</span>
              <input
                type="text"
                className="am-field am-field-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="am-mini-table-wrap">
              <table className="am-mini-table">
                <thead>
                  <tr>
                    <th>خصم في قوائم البيع</th>
                    <th>الزبون</th>
                  </tr>
                </thead>
                <tbody>
                  {searchRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", fontSize: 11 }}>
                        —
                      </td>
                    </tr>
                  ) : (
                    searchRows.map((r, i) => (
                      <tr key={i}>
                        <td className="am-mini-num">{r.discount}</td>
                        <td className="am-mini-name" dir="rtl">
                          {r.customer}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="am-report-col">
            <div className="am-balance-box">
              {totals?.grand?.usd != null ? str(totals.grand.usd) : "—"}
            </div>
            <button type="button" className="am-btn-report" onClick={() => loadMove()}>
              report
            </button>
          </div>
        </div>
      </div>

      <div className="am-panels">
        <section className="am-panel am-panel-out">
          <div className="am-panel-head">
            <span className="am-debit-lbl">make debit</span>
            <span className="am-sq am-sq-green-out" aria-hidden />
            <span className="am-sq am-sq-rose-out" aria-hidden />
            <span className="am-panel-title">Out</span>
            <span className="am-lbl">currency</span>
            <select
              className="am-field am-select"
              value={currencyOut}
              onChange={(e) => setCurrencyOut(e.target.value)}
            >
              <option value="دولار">دولار</option>
              <option value="دينار">دينار</option>
            </select>
          </div>
          <div className="am-panel-body">
            <div className="am-side-btns">
              <button type="button" className="am-side-btn am-side-del" onClick={onDeleteLine}>
                delete
              </button>
              <button type="button" className="am-side-btn am-side-edit" onClick={onEditLine}>
                edit
              </button>
              <button type="button" className="am-side-btn am-side-edit" onClick={() => onAddLine("OUT")}>
                add out
              </button>
            </div>
            <div className="am-table-wrap">
              <table className="am-table">
                <colgroup>
                  <col className="am-col-dinar" />
                  <col className="am-col-jineh" />
                  <col className="am-col-usd" />
                  <col className="am-col-rmb" />
                  <col className="am-col-no" />
                  <col className="am-col-details" />
                  <col className="am-col-date" />
                </colgroup>
                <thead>
                  <tr>
                    {MOVE_COLS_OUT.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linesOut.length === 0 ? (
                    <tr className="am-table-empty">
                      <td colSpan={7} />
                    </tr>
                  ) : (
                    linesOut.map((l) => (
                      <tr
                        key={l.id}
                        style={{
                          cursor: "pointer",
                          background: selectedLineId === l.id ? "#e8f4ff" : undefined,
                        }}
                        onClick={() => setSelectedLineId(l.id)}
                      >
                        <td>{str(l.dinar)}</td>
                        <td>{str(l.jineh)}</td>
                        <td>{str(l.usd)}</td>
                        <td>{str(l.rmb)}</td>
                        <td>{l.lineNo ?? ""}</td>
                        <td>{l.details ?? ""}</td>
                        <td>{formatIsoToDisplay(l.lineDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="am-sum-row">
                    <td className="am-sum-currency">{outSum ? str(outSum.dinar) : ""}</td>
                    <td className="am-sum-currency">{outSum ? str(outSum.jineh) : ""}</td>
                    <td className="am-sum-currency">{outSum ? str(outSum.usd) : ""}</td>
                    <td className="am-sum-currency">{outSum ? str(outSum.rmb) : ""}</td>
                    <td className="am-sum-label" colSpan={3}>
                      summation
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        <section className="am-panel am-panel-in">
          <div className="am-panel-head">
            <span className="am-debit-lbl">make cridit</span>
            <span className="am-sq am-sq-rose-in" aria-hidden />
            <span className="am-sq am-sq-green-in" aria-hidden />
            <span className="am-panel-title">In</span>
            <span className="am-lbl">currency</span>
            <select
              className="am-field am-select"
              value={currencyIn}
              onChange={(e) => setCurrencyIn(e.target.value)}
            >
              <option value="دولار">دولار</option>
              <option value="دينار">دينار</option>
            </select>
          </div>
          <div className="am-panel-body">
            <div className="am-side-btns">
              <button type="button" className="am-side-btn am-side-del" onClick={onDeleteLine}>
                delete
              </button>
              <button type="button" className="am-side-btn am-side-edit" onClick={onDeleteMove}>
                del move
              </button>
              <button type="button" className="am-side-btn am-side-edit" onClick={() => onAddLine("IN")}>
                add in
              </button>
            </div>
            <div className="am-table-wrap">
              <table className="am-table">
                <colgroup>
                  <col className="am-col-dinar" />
                  <col className="am-col-jineh" />
                  <col className="am-col-usd" />
                  <col className="am-col-rmb" />
                  <col className="am-col-no" />
                  <col className="am-col-details" />
                  <col className="am-col-date" />
                </colgroup>
                <thead>
                  <tr>
                    {MOVE_COLS_IN.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linesIn.length === 0 ? (
                    <tr className="am-table-empty">
                      <td colSpan={7} />
                    </tr>
                  ) : (
                    linesIn.map((l) => (
                      <tr
                        key={l.id}
                        style={{
                          cursor: "pointer",
                          background: selectedLineId === l.id ? "#e8f4ff" : undefined,
                        }}
                        onClick={() => setSelectedLineId(l.id)}
                      >
                        <td>{str(l.dinar)}</td>
                        <td>{str(l.jineh)}</td>
                        <td>{str(l.usd)}</td>
                        <td>{str(l.rmb)}</td>
                        <td>{l.lineNo ?? ""}</td>
                        <td>{l.details ?? ""}</td>
                        <td>{formatIsoToDisplay(l.lineDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="am-sum-row">
                    <td className="am-sum-currency">{inSum ? str(inSum.dinar) : ""}</td>
                    <td className="am-sum-currency">{inSum ? str(inSum.jineh) : ""}</td>
                    <td className="am-sum-currency">{inSum ? str(inSum.usd) : ""}</td>
                    <td className="am-sum-currency">{inSum ? str(inSum.rmb) : ""}</td>
                    <td className="am-sum-label" colSpan={3}>
                      summation
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
