import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const boxStyle = {
  margin: "10px 0",
  padding: "8px 10px",
  border: "1px solid #888",
  background: "#f5f5f5",
  fontSize: 11,
};

export function GlSaleVoucherPost({ voucherId, glJournalEntryId, documentStatus, onPosted }) {
  const { user } = useAuth();
  const canFinance = user?.role === "ADMIN" || user?.role === "ACCOUNTANT";
  const canPost = documentStatus === "APPROVED";
  const [arId, setArId] = useState("");
  const [revId, setRevId] = useState("");
  const [assets, setAssets] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [localPosted, setLocalPosted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        api.get("/finance/accounts", { class: "ASSET", activeOnly: "true" }),
        api.get("/finance/accounts", { class: "REVENUE", activeOnly: "true" }),
      ]);
      setAssets(a.items ?? []);
      setRevenues(r.items ?? []);
    } catch {
      setAssets([]);
      setRevenues([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setLocalPosted(false);
  }, [voucherId]);

  const post = async () => {
    if (!voucherId || !arId || !revId) {
      window.alert("اختر حساب ذمم مدينة وحساب إيراد.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api.post(`/finance/post/sale-voucher/${voucherId}`, {
        arAccountId: arId,
        revenueAccountId: revId,
      });
      setLocalPosted(true);
      setMsg("تم الترحيل للمحاسبة.");
      onPosted?.();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!voucherId) return null;
  if (!canFinance) {
    return (
      <div style={{ ...boxStyle, background: "#fff7ed" }} dir="rtl">
        لا تملك صلاحية الترحيل المحاسبي.
      </div>
    );
  }
  if (glJournalEntryId || localPosted) {
    return (
      <div style={{ ...boxStyle, background: "#e8f5e9" }} dir="rtl">
        مرحّل للمحاسبة العامة (قيد مرتبط).
      </div>
    );
  }
  if (!canPost) {
    return (
      <div style={{ ...boxStyle, background: "#fff7ed" }} dir="rtl">
        اعتماد الفاتورة مطلوب قبل الترحيل (الحالة: {documentStatus ?? "—"}).
      </div>
    );
  }

  return (
    <div style={boxStyle} dir="rtl">
      <strong>ترحيل للمحاسبة:</strong> مدين ذمم مدينة / دائن إيراد (بمبلغ المجموع)
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
        <select className="io-select" value={arId} onChange={(e) => setArId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">— ذمم / أصل —</option>
          {assets.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} {x.nameAr || x.name}
            </option>
          ))}
        </select>
        <select className="io-select" value={revId} onChange={(e) => setRevId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">— إيراد —</option>
          {revenues.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} {x.nameAr || x.name}
            </option>
          ))}
        </select>
        <button type="button" className="io-btn-primary" disabled={busy} onClick={post}>
          ترحيل GL
        </button>
      </div>
      {msg ? <div style={{ marginTop: 6 }}>{msg}</div> : null}
    </div>
  );
}

export function GlPurchaseVoucherPost({ voucherId, glJournalEntryId, documentStatus, onPosted }) {
  const { user } = useAuth();
  const canFinance = user?.role === "ADMIN" || user?.role === "ACCOUNTANT";
  const canPost = documentStatus === "APPROVED";
  const [debitId, setDebitId] = useState("");
  const [apId, setApId] = useState("");
  const [debits, setDebits] = useState([]);
  const [liabs, setLiabs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [localPosted, setLocalPosted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, e, l] = await Promise.all([
        api.get("/finance/accounts", { class: "ASSET", activeOnly: "true" }),
        api.get("/finance/accounts", { class: "EXPENSE", activeOnly: "true" }),
        api.get("/finance/accounts", { class: "LIABILITY", activeOnly: "true" }),
      ]);
      setDebits([...(a.items ?? []), ...(e.items ?? [])]);
      setLiabs(l.items ?? []);
    } catch {
      setDebits([]);
      setLiabs([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setLocalPosted(false);
  }, [voucherId]);

  const post = async () => {
    if (!voucherId || !debitId || !apId) {
      window.alert("اختر حساب مدين (مخزون/مصروف) وحساب ذمم دائنة.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api.post(`/finance/post/purchase-voucher/${voucherId}`, {
        debitAccountId: debitId,
        apAccountId: apId,
      });
      setLocalPosted(true);
      setMsg("تم الترحيل للمحاسبة.");
      onPosted?.();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!voucherId) return null;
  if (!canFinance) {
    return (
      <div style={{ ...boxStyle, background: "#fff7ed" }} dir="rtl">
        لا تملك صلاحية الترحيل المحاسبي.
      </div>
    );
  }
  if (glJournalEntryId || localPosted) {
    return (
      <div style={{ ...boxStyle, background: "#e8f5e9" }} dir="rtl">
        مرحّل للمحاسبة العامة (قيد مرتبط).
      </div>
    );
  }
  if (!canPost) {
    return (
      <div style={{ ...boxStyle, background: "#fff7ed" }} dir="rtl">
        اعتماد فاتورة الشراء مطلوب قبل الترحيل (الحالة: {documentStatus ?? "—"}).
      </div>
    );
  }

  return (
    <div style={boxStyle} dir="rtl">
      <strong>ترحيل للمحاسبة:</strong> مدين مخزون/مصروف — دائن ذمم دائنة (بمجموع السند)
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
        <select
          className="io-select"
          value={debitId}
          onChange={(e) => setDebitId(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">— مدين —</option>
          {debits.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} {x.nameAr || x.name}
            </option>
          ))}
        </select>
        <select className="io-select" value={apId} onChange={(e) => setApId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">— ذمم دائنة —</option>
          {liabs.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} {x.nameAr || x.name}
            </option>
          ))}
        </select>
        <button type="button" className="io-btn-primary" disabled={busy} onClick={post}>
          ترحيل GL
        </button>
      </div>
      {msg ? <div style={{ marginTop: 6 }}>{msg}</div> : null}
    </div>
  );
}

export function GlIncomeOutcomePost({ entryId, kind, glJournalEntryId, onPosted }) {
  const { user } = useAuth();
  const canFinance = user?.role === "ADMIN" || user?.role === "ACCOUNTANT";
  const [cashId, setCashId] = useState("");
  const [offId, setOffId] = useState("");
  const [cashList, setCashList] = useState([]);
  const [offList, setOffList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [localPosted, setLocalPosted] = useState(false);

  const load = useCallback(async () => {
    try {
      const assets = await api.get("/finance/accounts", { class: "ASSET", activeOnly: "true" });
      setCashList(assets.items ?? []);
      if (kind === "REVENUE") {
        const r = await api.get("/finance/accounts", { class: "REVENUE", activeOnly: "true" });
        setOffList(r.items ?? []);
      } else {
        const e = await api.get("/finance/accounts", { class: "EXPENSE", activeOnly: "true" });
        setOffList(e.items ?? []);
      }
    } catch {
      setCashList([]);
      setOffList([]);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setLocalPosted(false);
  }, [entryId, kind]);

  const post = async () => {
    if (!entryId || !cashId || !offId) {
      window.alert("اختر حساب النقد/البنك والحساب المقابل.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api.post(`/finance/post/income-outcome/${entryId}`, {
        cashAccountId: cashId,
        offsetAccountId: offId,
      });
      setLocalPosted(true);
      setMsg("تم الترحيل للمحاسبة.");
      onPosted?.();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!entryId) return null;
  if (!canFinance) {
    return (
      <div style={{ ...boxStyle, background: "#fff7ed" }} dir="rtl">
        لا تملك صلاحية الترحيل المحاسبي.
      </div>
    );
  }
  if (glJournalEntryId || localPosted) {
    return (
      <div style={{ ...boxStyle, background: "#e8f5e9" }} dir="rtl">
        مرحّل للمحاسبة العامة.
      </div>
    );
  }

  const offLabel = kind === "REVENUE" ? "إيراد" : "مصروف";

  return (
    <div style={boxStyle} dir="rtl">
      <strong>ترحيل السجل للمحاسبة ({kind === "REVENUE" ? "إيراد" : "مصروف"}):</strong> حسب المبلغ (دولار + رسوم)
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
        <select className="io-select" value={cashId} onChange={(e) => setCashId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">— نقد/بنك —</option>
          {cashList.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} {x.nameAr || x.name}
            </option>
          ))}
        </select>
        <select className="io-select" value={offId} onChange={(e) => setOffId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">— {offLabel} —</option>
          {offList.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} {x.nameAr || x.name}
            </option>
          ))}
        </select>
        <button type="button" className="io-btn-primary" disabled={busy} onClick={post}>
          ترحيل GL
        </button>
      </div>
      {msg ? <div style={{ marginTop: 6 }}>{msg}</div> : null}
    </div>
  );
}
