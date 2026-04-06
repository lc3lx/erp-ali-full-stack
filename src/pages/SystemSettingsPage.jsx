import { useCallback, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

const COMPANY_KEY = "company.profile";

function parseProfileJson(raw) {
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}

export default function SystemSettingsPage() {
  const [key, setKey] = useState(COMPANY_KEY);
  const [json, setJson] = useState('{"companyName":"شركتي","defaultCurrency":"USD","logoUrl":""}');
  const [companyName, setCompanyName] = useState("شركتي");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [logoUrl, setLogoUrl] = useState("");
  const [printHeader, setPrintHeader] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const syncFormFromJson = useCallback((raw) => {
    const o = parseProfileJson(raw);
    setCompanyName(String(o.companyName ?? ""));
    setDefaultCurrency(String(o.defaultCurrency ?? "USD"));
    setLogoUrl(String(o.logoUrl ?? ""));
    setPrintHeader(String(o.printHeader ?? ""));
  }, []);

  const load = async () => {
    setErr("");
    try {
      const row = await api.get(`/finance/settings/${encodeURIComponent(key)}`);
      if (row.value != null) {
        const s = JSON.stringify(row.value, null, 2);
        setJson(s);
        if (key === COMPANY_KEY) syncFormFromJson(s);
      }
      setMsg("تم التحميل");
    } catch (e) {
      setErr(e.message);
    }
  };

  const applyCompanyFormToJson = () => {
    const base = parseProfileJson(json);
    const merged = {
      ...base,
      companyName: companyName.trim() || base.companyName,
      defaultCurrency: defaultCurrency.trim() || base.defaultCurrency || "USD",
      logoUrl: logoUrl.trim() || null,
      printHeader: printHeader.trim() || null,
    };
    setJson(JSON.stringify(merged, null, 2));
    setMsg("تم دمج الحقول في المسودة — اضغط حفظ لإرسالها للخادم");
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
      <h2 className="master-title">إعدادات النظام</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}

      {key === COMPANY_KEY ? (
        <div className="master-form" style={{ marginBottom: 20 }}>
          <h3 className="master-form-title">ملف الشركة وترويسة الطباعة</h3>
          <label className="master-field">
            اسم الشركة
            <input className="io-date-input master-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </label>
          <label className="master-field">
            العملة الافتراضية
            <input className="io-date-input master-input" dir="ltr" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} />
          </label>
          <label className="master-field">
            رابط الشعار (URL) — اختياري
            <input className="io-date-input master-input" dir="ltr" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </label>
          <label className="master-field">
            نص إضافي للترويسة — اختياري
            <input className="io-date-input master-input" value={printHeader} onChange={(e) => setPrintHeader(e.target.value)} />
          </label>
          <button type="button" className="io-btn" onClick={applyCompanyFormToJson}>
            دمج في JSON أدناه
          </button>
        </div>
      ) : null}

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
