import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

function emptyForm() {
  return {
    itemNo: "",
    name: "",
    barcode: "",
    category: "",
    defaultUom: "",
    isActive: true,
  };
}

export default function ItemsManagementPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api.get("/items", { page: 1, pageSize: 500, activeOnly: "false" });
      const list = data.items ?? [];
      setItems(list);
      setSelectedId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev;
        return "";
      });
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
      setForm(emptyForm());
      return;
    }
    const p = items.find((x) => x.id === selectedId);
    if (p) {
      setForm({
        itemNo: p.itemNo ?? "",
        name: p.name ?? "",
        barcode: p.barcode ?? "",
        category: p.category ?? "",
        defaultUom: p.defaultUom ?? "",
        isActive: p.isActive !== false,
      });
    }
  }, [selectedId, items]);

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const name = form.name.trim();
    if (!name) {
      setErr("اسم الصنف مطلوب");
      return;
    }
    const payload = {
      itemNo: form.itemNo.trim() || null,
      name,
      barcode: form.barcode.trim() || null,
      category: form.category.trim() || null,
      defaultUom: form.defaultUom.trim() || null,
      isActive: form.isActive,
    };
    try {
      if (selectedId) {
        await api.patch(`/items/${selectedId}`, payload);
        setMsg("تم تحديث الصنف");
      } else {
        const created = await api.post("/items", payload);
        setSelectedId(created.id);
        setMsg("تم إنشاء الصنف");
      }
      await loadList();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onDelete = async () => {
    if (!selectedId || !window.confirm("حذف هذا الصنف؟")) return;
    try {
      await api.delete(`/items/${selectedId}`);
      setSelectedId("");
      setMsg("تم الحذف");
      await loadList();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">إدارة الأصناف</h2>
      <p className="master-lead">تصنيف، باركود، ووحدة قياس — تُربط بفواتير الشراء/البيع والمخزون.</p>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}
      {loading ? <div className="master-muted">جاري التحميل…</div> : null}

      <div className="master-layout">
        <div className="master-panel">
          <div className="master-toolbar">
            <span className="master-toolbar-lbl">الأصناف ({items.length})</span>
            <button type="button" className="master-btn master-btn-ghost" onClick={loadList}>
              تحديث
            </button>
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>تصنيف</th>
                  <th>باركود</th>
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
                    <td>{r.category ?? ""}</td>
                    <td dir="ltr">{r.barcode ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form className="master-form" onSubmit={onSave}>
          <h3 className="master-form-title">{selectedId ? "تعديل صنف" : "صنف جديد"}</h3>
          <label className="master-field">
            الرقم
            <input
              className="io-date-input master-input"
              value={form.itemNo}
              onChange={(e) => setForm({ ...form, itemNo: e.target.value })}
            />
          </label>
          <label className="master-field">
            الاسم <span className="master-req">*</span>
            <input
              className="io-date-input master-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="master-field">
            الباركود
            <input
              className="io-date-input master-input"
              dir="ltr"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </label>
          <label className="master-field">
            التصنيف
            <input
              className="io-date-input master-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="master-field">
            وحدة القياس
            <input
              className="io-date-input master-input"
              value={form.defaultUom}
              onChange={(e) => setForm({ ...form, defaultUom: e.target.value })}
            />
          </label>
          <label className="master-field">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />{" "}
            نشط
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
