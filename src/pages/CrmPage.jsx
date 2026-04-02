import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function CrmPage() {
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [ln, setLn] = useState("");
  const [lp, setLp] = useState("");
  const [selectedLead, setSelectedLead] = useState("");
  const [selectedQuote, setSelectedQuote] = useState("");
  const [convertContainerId, setConvertContainerId] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try {
      const [l, q] = await Promise.all([api.get("/crm/leads"), api.get("/crm/quotations")]);
      setLeads(l.items ?? []);
      setQuotes(q.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const addLead = async (e) => {
    e.preventDefault();
    try {
      await api.post("/crm/leads", { name: ln, phone: lp });
      setLn("");
      setLp("");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  const removeLead = async (id) => {
    try {
      await api.delete(`/crm/leads/${id}`);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  const removeQuote = async (id) => {
    try {
      await api.delete(`/crm/quotations/${id}`);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  const convertToSale = async () => {
    try {
      await api.post(`/crm/quotations/${selectedQuote}/convert-to-sale`, { containerId: convertContainerId });
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">CRM — عروض وعملاء محتملون</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      <form className="master-form" onSubmit={addLead}>
        <label className="master-field">
          اسم lead
          <input className="io-date-input master-input" value={ln} onChange={(e) => setLn(e.target.value)} />
        </label>
        <label className="master-field">
          هاتف
          <input className="io-date-input master-input" value={lp} onChange={(e) => setLp(e.target.value)} />
        </label>
        <button type="submit" className="io-btn-primary">
          إضافة
        </button>
      </form>
      <h3 className="master-form-title">Leads</h3>
      <ul>
        {leads.map((r) => (
          <li key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {r.name} — {r.status}
            <button type="button" className="io-btn" onClick={() => setSelectedLead(r.id)}>
              عرض
            </button>
            <button type="button" className="io-btn" onClick={() => removeLead(r.id)}>
              حذف
            </button>
          </li>
        ))}
      </ul>
      {selectedLead ? <div className="master-muted">Lead selected: {selectedLead}</div> : null}
      <h3 className="master-form-title">عروض أسعار</h3>
      <ul>
        {quotes.map((r) => (
          <li key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {r.quoteNo} — {r.status} — {r.total != null ? String(r.total) : ""}
            <button type="button" className="io-btn" onClick={() => setSelectedQuote(r.id)}>
              تحديد
            </button>
            <button type="button" className="io-btn" onClick={() => removeQuote(r.id)}>
              حذف
            </button>
          </li>
        ))}
      </ul>
      <div className="master-form">
        <h4 className="master-form-title">تحويل عرض سعر إلى فاتورة بيع</h4>
        <label className="master-field">
          معرّف العرض
          <input className="io-date-input master-input" value={selectedQuote} onChange={(e) => setSelectedQuote(e.target.value)} />
        </label>
        <label className="master-field">
          معرّف الحاوية
          <input className="io-date-input master-input" value={convertContainerId} onChange={(e) => setConvertContainerId(e.target.value)} />
        </label>
        <button type="button" className="io-btn-primary" onClick={convertToSale} disabled={!selectedQuote || !convertContainerId}>
          تحويل
        </button>
      </div>
    </div>
  );
}
