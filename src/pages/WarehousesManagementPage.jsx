import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function WarehousesManagementPage() {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [storeId, setStoreId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [w, s] = await Promise.all([api.get("/inv-warehouses"), api.get("/stores")]);
      setItems(w.items ?? []);
      setStores(s.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setName("");
      setCode("");
      setStoreId("");
      setIsActive(true);
      return;
    }
    const r = items.find((x) => x.id === selectedId);
    if (r) {
      setName(r.name ?? "");
      setCode(r.code ?? "");
      setStoreId(r.storeId ?? "");
      setIsActive(r.isActive !== false);
    }
  }, [selectedId, items]);

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!name.trim()) {
      setErr("اسم المستودع مطلوب");
      return;
    }
    try {
      if (selectedId) {
        await api.patch(`/inv-warehouses/${selectedId}`, {
          name: name.trim(),
          code: code.trim() || null,
          storeId: storeId || null,
          isActive,
        });
        setMsg("تم التحديث");
      } else {
        const c = await api.post("/inv-warehouses", {
          name: name.trim(),
          code: code.trim() || null,
          storeId: storeId || null,
          isActive,
        });
        setSelectedId(c.id);
        setMsg("تم الإنشاء");
      }
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onDelete = async () => {
    if (!selectedId || !window.confirm("حذف المستودع؟")) return;
    try {
      await api.delete(`/inv-warehouses/${selectedId}`);
      setSelectedId("");
      setMsg("تم الحذف");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">المستودعات</h2>
      <p className="master-lead">ربط مستودع المخزون الفعلي بمخزن التشغيل (للترحيل والأرصدة).</p>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}

      <div className="master-layout">
        <div className="master-panel">
          <div className="master-toolbar">
            <span className="master-toolbar-lbl">المستودعات ({items.length})</span>
            <button type="button" className="master-btn master-btn-ghost" onClick={load}>
              تحديث
            </button>
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>المستودع</th>
                  <th>المخزن</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedId === r.id ? "master-row-active" : undefined}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td>{r.name}</td>
                    <td>{r.store?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <form className="master-form" onSubmit={onSave}>
          <h3 className="master-form-title">{selectedId ? "تعديل" : "جديد"}</h3>
          <label className="master-field">
            الاسم <span className="master-req">*</span>
            <input className="io-date-input master-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="master-field">
            الرمز
            <input className="io-date-input master-input" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="master-field">
            مخزن التشغيل
            <select className="io-date-input master-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">— بدون —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-field">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> نشط
          </label>
          <div className="master-actions">
            <button type="submit" className="io-btn-primary">
              حفظ
            </button>
            <button type="button" className="io-btn" onClick={() => setSelectedId("")}>
              جديد
            </button>
            <button type="button" className="io-btn" onClick={onDelete} disabled={!selectedId}>
              حذف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
