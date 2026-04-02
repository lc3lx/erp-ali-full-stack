import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { dispatchMastersRefresh } from "../lib/uiActions.js";
import "../App.css";

export default function StoresManagementPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
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
      return;
    }
    const s = items.find((x) => x.id === selectedId);
    if (s) setName(s.name ?? "");
  }, [selectedId, items]);

  const onNew = () => {
    setSelectedId("");
    setName("");
    setErr("");
    setMsg("مخزن جديد — أدخل الاسم واحفظ");
  };

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const n = name.trim();
    if (!n) {
      setErr("اسم المخزن مطلوب");
      return;
    }
    try {
      if (selectedId) {
        await api.patch(`/stores/${selectedId}`, { name: n });
        setMsg("تم تحديث المخزن");
      } else {
        const created = await api.post("/stores", { name: n });
        setSelectedId(created.id);
        setMsg("تم إضافة مخزن");
      }
      await loadList();
      dispatchMastersRefresh("stores");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onDelete = async () => {
    if (!selectedId) {
      setErr("اختر مخزناً من الجدول");
      return;
    }
    if (!window.confirm("حذف المخزن؟ سيتم إلغاء ربطه من فواتير الشراء/البيع والقيود المرتبطة به.")) return;
    setErr("");
    setMsg("");
    try {
      await api.delete(`/stores/${selectedId}`);
      setSelectedId("");
      setName("");
      setMsg("تم الحذف");
      await loadList();
      dispatchMastersRefresh("stores");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">إدارة المخازن</h2>
      <p className="master-lead">
        المخازن تُختار في <strong>فواتير الشراء</strong> و<strong>فواتير البيع</strong> وحسب إعدادات المخزون
        المحاسبي. عند الحذف يُزال الربط من السندات دون حذف الفواتير.
      </p>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}
      {loading ? <div className="master-muted">جاري التحميل…</div> : null}

      <div className="master-layout">
        <div className="master-panel">
          <div className="master-toolbar">
            <span className="master-toolbar-lbl">قائمة المخازن ({items.length})</span>
            <button type="button" className="master-btn master-btn-ghost" onClick={loadList}>
              تحديث
            </button>
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="master-empty">لا مخازن بعد.</td>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="master-form" onSubmit={onSave}>
          <h3 className="master-form-title">{selectedId ? "تعديل مخزن" : "مخزن جديد"}</h3>
          <label className="master-field">
            اسم المخزن <span className="master-req">*</span>
            <input
              className="io-date-input master-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
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
