import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatIsoToDisplay, parseDisplayToIso, toApiDateTime } from "../lib/dates.js";
import "./AccountingMovesPage.css";

const MOVE_COLS = ["dinar", "jineh", "$", "remimby", "No", "detailes", "date"];

function str(v) {
  if (v == null || v === "") return "";
  return String(v);
}

export default function AccountingMovesPage() {
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    return `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  });
  const [reportTo, setReportTo] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${String(lastDay.getDate()).padStart(2,'0')}/${String(lastDay.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  });
  const [moveDate, setMoveDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  });
  const [exchangeRate, setExchangeRate] = useState("6.8");
  const [currencyTop, setCurrencyTop] = useState("دولار");
  const [search, setSearch] = useState("");
  
  const [currencyOut, setCurrencyOut] = useState("دولار");
  const [currencyIn, setCurrencyIn] = useState("دولار");
  
  const [outAmount, setOutAmount] = useState("");
  const [inAmount, setInAmount] = useState("");

  const [searchRows, setSearchRows] = useState([]);
  const [move, setMove] = useState(null);
  const [totals, setTotals] = useState(null);
  const [customerGrand, setCustomerGrand] = useState(null);
  const [err, setErr] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [moveList, setMoveList] = useState([]);

  const hydrateMoveHeader = (m) => {
    setMoveDate(formatIsoToDisplay(m.moveDate) || "");
    setExchangeRate(str(m.exchangeRate ?? ""));
    setCurrencyTop(m.topCurrency ?? "دولار");
    setSearch(m.searchQuery ?? "");
  };

  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          const r = await api.get("/accounting-moves/customer-discounts", { q: search });
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

  const onSelectCustomer = async (r) => {
    setSearch(r.customer);
    const existingMove = moveList.find((m) => m.searchQuery === r.customer);
    if (existingMove) {
      try {
        const [mm, tt, ct] = await Promise.all([
          api.get(`/accounting-moves/${existingMove.id}`),
          api.get(`/accounting-moves/${existingMove.id}/totals`),
          api.get(`/accounting-moves/customer-totals/${encodeURIComponent(r.customer)}`),
        ]);
        setMove(mm);
        setTotals(tt);
        setCustomerGrand(ct?.grand);
        hydrateMoveHeader(mm);
        setSelectedLineId("");
      } catch (e) {
        setErr(e.message);
      }
    } else {
      setMove(null);
      setTotals(null);
      setMoveDate(formatIsoToDisplay(new Date().toISOString()));
      setSelectedLineId("");
      try {
         const ct = await api.get(`/accounting-moves/customer-totals/${encodeURIComponent(r.customer)}`);
         setCustomerGrand(ct?.grand);
      } catch (e) {
         setCustomerGrand(null);
      }
    }
  };

  const lines = move?.lines ?? [];
  const filteredLines = lines.filter(l => {
     if (!l.lineDate) return true;
     const lineDStr = l.lineDate.substring(0, 10);
     const fromIsoStr = parseDisplayToIso(reportFrom)?.substring(0, 10) || "0000-00-00";
     const toIsoStr = parseDisplayToIso(reportTo)?.substring(0, 10) || "9999-99-99";
     return lineDStr >= fromIsoStr && lineDStr <= toIsoStr;
  });

  const linesOut = filteredLines.filter((l) => l.direction === "OUT");
  const linesIn = filteredLines.filter((l) => l.direction === "IN");
  
  const calcSum = (arr) => arr.reduce((acc, l) => ({
    dinar: acc.dinar + Number(l.dinar || 0),
    jineh: acc.jineh + Number(l.jineh || 0),
    usd: acc.usd + Number(l.usd || 0),
    rmb: acc.rmb + Number(l.rmb || 0),
  }), { dinar: 0, jineh: 0, usd: 0, rmb: 0 });

  const outSum = calcSum(linesOut);
  const inSum = calcSum(linesIn);

  const currentMoveId = move?.id;

  const onNewMove = async () => {
    const md = toApiDateTime(moveDate);
    if (!md) {
      window.alert("تاريخ الحركة غير صالح");
      return null;
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
      return mm;
    } catch (e) {
      setErr(e.message);
      return null;
    }
  };

  const onSaveMoveHeader = async () => {
    if (!currentMoveId) return onNewMove();
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
    let currentId = currentMoveId || move?.id;
    if (!currentId) {
      const newM = await onNewMove();
      if (!newM) return;
      currentId = newM.id;
    }

    const ld = parseDisplayToIso(moveDate);
    const amountStr = direction === "OUT" ? outAmount : inAmount;
    const amountVal = Number(amountStr) || 0;
    
    if (amountVal <= 0) {
      window.alert("يرجى إدخال مبلغ صحيح");
      return;
    }

    const dinar = (direction === "OUT" && currencyOut === "دينار") || (direction === "IN" && currencyIn === "دينار") ? amountVal : 0;
    const usd = (direction === "OUT" && currencyOut === "دولار") || (direction === "IN" && currencyIn === "دولار") ? amountVal : 0;

    const details = window.prompt("تفاصيل (اختياري)؟", "") || undefined;

    try {
      await api.post(`/accounting-moves/${currentId || move?.id}/lines`, {
        direction,
        panelCurrency: direction === "OUT" ? currencyOut : currencyIn,
        dinar: dinar || undefined,
        usd: usd || undefined,
        details: details,
        lineDate: ld ?? undefined,
      });
      
      if (direction === "OUT") setOutAmount("");
      else setInAmount("");

      const [mm, tt] = await Promise.all([
        api.get(`/accounting-moves/${currentId}`),
        api.get(`/accounting-moves/${currentId}/totals`),
      ]);
      setMove(mm);
      setTotals(tt);
      if (search) {
         const ct = await api.get(`/accounting-moves/customer-totals/${encodeURIComponent(search)}`);
         setCustomerGrand(ct?.grand);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDeleteLine = async (direction) => {
    if (!currentMoveId || !selectedLineId) {
      window.alert("حدد سطر أولا");
      return;
    }
    const row = lines.find((x) => x.id === selectedLineId && x.direction === direction);
    if(!row) return;

    if (!window.confirm("حذف السطر؟")) return;
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

  const onEditLine = async (direction) => {
    if (!currentMoveId || !selectedLineId) return;
    const row = lines.find((x) => x.id === selectedLineId && x.direction === direction);
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

  const getSum = (sumObj, col) => {
    if (!sumObj) return "";
    switch(col) {
      case "dinar": return str(sumObj.dinar);
      case "jineh": return str(sumObj.jineh);
      case "$": return str(sumObj.usd);
      case "remimby": return str(sumObj.rmb);
      default: return "";
    }
  };

  return (
    <div className="old-am-page">
      <div className="old-am-title">
         <img src="https://via.placeholder.com/16" alt="icon" style={{marginRight: 4, verticalAlign: "middle"}}/> Accounting Moves
      </div>

      <div className="old-am-top">
        <div className="old-am-top-left">
          <div className="old-am-row">
            <input className="old-am-input" value={reportFrom} onChange={e=>setReportFrom(e.target.value)} onBlur={onSaveMoveHeader} />
            <span className="old-am-label">to</span>
            <input className="old-am-input" value={reportTo} onChange={e=>setReportTo(e.target.value)} onBlur={onSaveMoveHeader} />
            <span className="old-am-label">report date from</span>
          </div>
          <div className="old-am-row">
            <input className="old-am-input" value={moveDate} onChange={e=>setMoveDate(e.target.value)} onBlur={onSaveMoveHeader} />
            <span className="old-am-label">move date</span>
            <input className="old-am-input old-am-red-text" style={{marginLeft: 10}} value={exchangeRate} onChange={e=>setExchangeRate(e.target.value)} onBlur={onSaveMoveHeader} />
            <span className="old-am-label old-am-red-text">china exchange rate</span>
          </div>
        </div>

        <div className="old-am-top-center">
          <div className="old-am-grand-total">
            {customerGrand?.usd != null ? str(customerGrand.usd) : (totals?.grand?.usd != null ? str(totals.grand.usd) : "0")}
          </div>
          <button className="old-am-report-btn" onClick={async () => {
             if (currentMoveId) {
                const [mm, tt] = await Promise.all([
                  api.get(`/accounting-moves/${currentMoveId}`),
                  api.get(`/accounting-moves/${currentMoveId}/totals`),
                ]);
                setMove(mm);
                setTotals(tt);
             }
             if (search) {
                const ct = await api.get(`/accounting-moves/customer-totals/${encodeURIComponent(search)}`);
                setCustomerGrand(ct?.grand);
             }
          }}>report</button>
        </div>

        <div className="old-am-top-right">
          <div className="old-am-row" style={{justifyContent: 'flex-end'}}>
            <select className="old-am-input" value={currencyTop} onChange={e=>{setCurrencyTop(e.target.value); setTimeout(onSaveMoveHeader, 50);}}>
              <option value="دولار">دولار</option>
              <option value="دينار">دينار</option>
            </select>
            <span className="old-am-label">currency دولار</span>
          </div>
          <div className="old-am-row" style={{justifyContent: 'flex-end'}}>
             <input className="old-am-input" value={search} onChange={e=>setSearch(e.target.value)} style={{width: 150}}/>
             <span className="old-am-label">serch علي ال</span>
          </div>
          <table className="old-am-search-table">
            <thead>
              <tr>
                 <th>خصم في قوائم البيع</th>
                 <th>الزبون</th>
              </tr>
            </thead>
            <tbody>
              {searchRows.map((r, i) => (
                <tr key={i} onClick={() => onSelectCustomer(r)} className={search === r.customer ? "selected" : ""}>
                   <td>{r.discount}</td>
                   <td>{r.customer}</td>
                </tr>
              ))}
              {searchRows.length === 0 && (
                <tr><td colSpan={2} style={{height: 40}}></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="old-am-panels">
        {/* OUT PANEL */}
        <div className="old-am-panel">
           <div className="old-am-panel-header">
             <button className="old-am-add-btn green" onClick={() => onAddLine("OUT")}>make debit</button>
             <input className="old-am-panel-input out" value={outAmount} onChange={e=>setOutAmount(e.target.value)} type="number" />
             <span className="old-am-label" style={{marginLeft: 10, marginRight: 10, fontSize: 16}}>Out</span>
             <select className="old-am-input" value={currencyOut} onChange={e=>setCurrencyOut(e.target.value)} style={{width: 70}}>
               <option value="دولار">دولار</option>
               <option value="دينار">دينار</option>
             </select>
             <span className="old-am-label">currency دولار</span>
           </div>
           
           <div className="old-am-panel-body">
              <div className="old-am-side-actions">
                 <button className="old-am-action-btn del" onClick={() => onDeleteLine("OUT")}>delete</button>
                 <button className="old-am-action-btn edit" onClick={() => onEditLine("OUT")}>edit</button>
                 <button className="old-am-action-btn back" onClick={() => setMove(null)}>go<br/>back</button>
              </div>

              <div className="old-am-grid-container">
                 <div className="old-am-grid-wrap">
                    <table className="old-am-grid">
                      <thead>
                        <tr>
                          {MOVE_COLS.map(c => <th key={c}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {linesOut.map(l => (
                          <tr key={l.id} 
                              onClick={() => setSelectedLineId(l.id)}
                              style={{background: selectedLineId === l.id ? 'black' : '#eaf8ea', color: selectedLineId === l.id ? 'white' : ''}}
                          >
                            <td style={{textAlign: 'center'}}>{str(l.dinar)}</td>
                            <td style={{textAlign: 'center'}}>{str(l.jineh)}</td>
                            <td style={{textAlign: 'center'}}>{str(l.usd)}</td>
                            <td style={{textAlign: 'center'}}>{str(l.rmb)}</td>
                            <td style={{textAlign: 'center'}}>{l.lineNo || ""}</td>
                            <td>{l.details || ""}</td>
                            <td style={{textAlign: 'center'}}>{formatIsoToDisplay(l.lineDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(outSum, "dinar")} /></td>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(outSum, "jineh")} /></td>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(outSum, "$")} /></td>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(outSum, "remimby")} /></td>
                          <td colSpan={3} style={{textAlign: 'right', paddingRight: 10, fontWeight: 'bold'}}>summation</td>
                        </tr>
                      </tfoot>
                    </table>
                 </div>
              </div>
           </div>
        </div>

        {/* IN PANEL */}
        <div className="old-am-panel">
           <div className="old-am-panel-header">
             <button className="old-am-add-btn pink" onClick={() => onAddLine("IN")}>make cridit</button>
             <input className="old-am-panel-input in" value={inAmount} onChange={e=>setInAmount(e.target.value)} type="number" />
             <span className="old-am-label" style={{marginLeft: 10, marginRight: 10, fontSize: 16}}>In</span>
             <select className="old-am-input" value={currencyIn} onChange={e=>setCurrencyIn(e.target.value)} style={{width: 70}}>
               <option value="دولار">دولار</option>
               <option value="دينار">دينار</option>
             </select>
             <span className="old-am-label">currency دولار</span>
           </div>
           
           <div className="old-am-panel-body">
              <div className="old-am-side-actions">
                 <button className="old-am-action-btn del" onClick={() => onDeleteLine("IN")}>delete</button>
                 <button className="old-am-action-btn edit" onClick={() => onEditLine("IN")}>edit</button>
                 <button className="old-am-action-btn back" onClick={() => setMove(null)}>go<br/>back</button>
              </div>

              <div className="old-am-grid-container">
                 <div className="old-am-grid-wrap">
                    <table className="old-am-grid">
                      <thead>
                        <tr>
                          {MOVE_COLS.map(c => <th key={c}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {linesIn.map(l => (
                          <tr key={l.id} 
                              onClick={() => setSelectedLineId(l.id)}
                              style={{background: selectedLineId === l.id ? 'black' : '#eaf8ea', color: selectedLineId === l.id ? 'white' : ''}}
                          >
                            <td style={{textAlign: 'center'}}>{str(l.dinar)}</td>
                            <td style={{textAlign: 'center'}}>{str(l.jineh)}</td>
                            <td style={{textAlign: 'center'}}>{str(l.usd)}</td>
                            <td style={{textAlign: 'center'}}>{str(l.rmb)}</td>
                            <td style={{textAlign: 'center'}}>{l.lineNo || ""}</td>
                            <td>{l.details || ""}</td>
                            <td style={{textAlign: 'center'}}>{formatIsoToDisplay(l.lineDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(inSum, "dinar")} /></td>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(inSum, "jineh")} /></td>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(inSum, "$")} /></td>
                          <td style={{padding: 0}}><input className="old-am-sum-input" style={{width: '100%', boxSizing: 'border-box'}} readOnly value={getSum(inSum, "remimby")} /></td>
                          <td colSpan={3} style={{textAlign: 'right', paddingRight: 10, fontWeight: 'bold'}}>summation</td>
                        </tr>
                      </tfoot>
                    </table>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
