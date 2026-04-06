import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { dispatchMastersRefresh } from "../lib/uiActions.js";
import "../App.css";

export default function StoresManagementPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseActive, setWarehouseActive] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api.get("/stores");
      const list = data.items ?? [];
      setItems(list);
      setSelectedId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev;
        return "";
      });
      setMsg("");
    } catch (e) {
      setErr(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setName("");
      setWarehouseCode("");
      setWarehouseActive(true);
      return;
    }
    const s = items.find((x) => x.id === selectedId);
    if (s) {
      setName(s.name ?? "");
      setWarehouseCode(s.invWarehouse?.code ?? "");
      setWarehouseActive(s.invWarehouse?.isActive !== false);
    }
  }, [selectedId, items]);

  const onNew = () => {
    setSelectedId("");
    setName("");
    setWarehouseCode("");
    setWarehouseActive(true);
    setErr("");
    setMsg("موقع جديد — اسم واحد يُستخدم في الفواتير وجرد المخزون");
  };

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const n = name.trim();
    if (!n) {
      setErr("الاسم مطلوب");
      return;
    }
    const payload = {
      name: n,
      warehouseCode: warehouseCode.trim() || null,
      warehouseActive,
    };
    try {
      if (selectedId) {
        await api.patch(`/stores/${selectedId}`, payload);
        setMsg("تم الحفظ — المخزن ومستودع الجرد متزامنان");
      } else {
        const created = await api.post("/stores", payload);
        setSelectedId(created.id);
        setMsg("تمت الإضافة مع إنشاء مستودع المخزون تلقائياً");
      }
      await loadList();
      dispatchMastersRefresh("all");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onDelete = async () => {
    if (!selectedId) {
      setErr("اختر موقعاً من الجدول");
      return;
    }
    if (
      !window.confirm(
        "حذف هذا المخزن؟ سيُحذف مستودع الجرد المرتبط إن لم تكن له حركات مخزون، ويُلغى اختياره من الفواتير والقيود.",
      )
    )
      return;
    setErr("");
    setMsg("");
    try {
      await api.delete(`/stores/${selectedId}`);
      setSelectedId("");
      setName("");
      setWarehouseCode("");
      setWarehouseActive(true);
      setMsg("تم الحذف");
      await loadList();
      dispatchMastersRefresh("all");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">المخازن والمستودعات</h2>
      <p className="master-lead">
        كل سطر هنا هو <strong>موقع واحد</strong>: يظهر في <strong>فواتير الشراء والبيع</strong> كمخزن، ويُنشأ له تلقائياً{" "}
        <strong>مستودع مخزون</strong> (الأرصدة والحركات) بنفس الاسم. لا حاجة لشاشتين منفصلتين.
      </p>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}
      {loading ? <div className="master-muted">جاري التحميل…</div> : null}

      <div className="master-layout">
        <div className="master-panel">
          <div className="master-toolbar">
            <span className="master-toolbar-lbl">المواقع ({items.length})</span>
            <button type="button" className="master-btn master-btn-ghost" onClick={loadList}>
              تحديث
            </button>
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>رمز الجرد</th>
                  <th>مستودع</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="master-empty">
                      لا مواقع بعد.
                    </td>
                  </tr>
                ) : (
                  items.map((s) => (
                    <tr
                      key={s.id}
                      className={selectedId === s.id ? "master-row-active" : undefined}
                      onClick={() => {
                        setSelectedId(s.id);
                        setMsg("");
                        setErr("");
                      }}
                    >
                      <td>{s.name}</td>
                      <td dir="ltr">{s.invWarehouse?.code ?? "—"}</td>
                      <td>{s.invWarehouse ? (s.invWarehouse.isActive === false ? "موقوف" : "نشط") : "غير مربوط — احفظ"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="master-form" onSubmit={onSave}>
          <h3 className="master-form-title">{selectedId ? "تعديل موقع" : "موقع جديد"}</h3>
          <label className="master-field">
            اسم المخزن / الموقع <span className="master-req">*</span>
            <input
              className="io-date-input master-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="master-field">
            رمز المستودع (اختياري — للطباعة والتمييز)
            <input
              className="io-date-input master-input"
              dir="ltr"
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="master-field">
            <input type="checkbox" checked={warehouseActive} onChange={(e) => setWarehouseActive(e.target.checked)} /> مستودع
            الجرد نشط
          </label>
          <div className="master-actions">
            <button type="submit" className="io-btn-primary">
              حفظ
            </button>
            <button type="button" className="io-btn" onClick={onNew}>
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
