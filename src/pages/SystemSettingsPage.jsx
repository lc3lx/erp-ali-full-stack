import { useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function SystemSettingsPage() {
  const [key, setKey] = useState("company.profile");
  const [json, setJson] = useState('{"companyName":"شركتي","defaultCurrency":"USD"}');
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const load = async () => {
    setErr("");
    try {
      const row = await api.get(`/finance/settings/${encodeURIComponent(key)}`);
      if (row.value != null) setJson(JSON.stringify(row.value, null, 2));
      setMsg("تم التحميل");
    } catch (e) {
      setErr(e.message);
    }
  };
  const save = async () => {
    setErr("");
    setMsg("");
    try {
      const val = JSON.parse(json);
      await api.put(`/finance/settings/${encodeURIComponent(key)}`, { value: val });
      setMsg("تم الحفظ");
    } catch (e) {
      setErr(e.message || "JSON غير صالح");
    }
  };
  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">إعدادات النظام (JSON)</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}
      <label className="master-field">
        المفتاح
        <input className="io-date-input master-input" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <textarea
        style={{ width: "100%", minHeight: 200, fontFamily: "monospace" }}
        dir="ltr"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <div className="master-actions">
        <button type="button" className="io-btn" onClick={load}>
          تحميل
        </button>
        <button type="button" className="io-btn-primary" onClick={save}>
          حفظ
        </button>
      </div>
    </div>
  );
}
