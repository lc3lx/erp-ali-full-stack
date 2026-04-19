import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { optimizeImageFile } from "../lib/imageUtils.js";
import "../App.css";

function emptyForm() {
  return {
    itemNo: "",
    name: "",
    barcode: "",
    category: "",
    defaultUom: "",
    imageUrl: "",
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
  const [imageBusy, setImageBusy] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        imageUrl: p.imageUrl ?? "",
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
      imageUrl: form.imageUrl || null,
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
      setIsModalOpen(false);
      setMsg("تم الحذف");
      await loadList();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    setErr("");
    try {
      const optimized = await optimizeImageFile(file);
      setForm((prev) => ({ ...prev, imageUrl: optimized }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setImageBusy(false);
      event.target.value = "";
    }
  };

  const onClearImage = () => {
    setForm((prev) => ({ ...prev, imageUrl: "" }));
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
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                type="button" 
                className="io-btn-primary" 
                onClick={() => { setSelectedId(""); setIsModalOpen(true); }}
                style={{ padding: "6px 12px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                ➕ إضافة صنف جديد
              </button>
              <button type="button" className="master-btn master-btn-ghost" onClick={loadList}>
                تحديث
              </button>
            </div>
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
                    onClick={() => { setSelectedId(r.id); setIsModalOpen(true); }}
                    style={{ cursor: "pointer" }}
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

        {isModalOpen && (
          <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999
          }}>
            <form className="master-form" onSubmit={onSave} style={{ maxHeight: "90vh", overflowY: "auto", width: "500px", maxWidth: "90%", margin: 0, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
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
              <div className="master-field">
                <span style={{ marginBottom: 4, display: "block", fontWeight: "bold" }}>صورة الصنف</span>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "10px", background: "#f1f5f9", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="صورة الصنف" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>بدون صورة</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input type="file" accept="image/*" onChange={onPickImage} disabled={imageBusy} style={{ fontSize: 13 }} />
                    {form.imageUrl && (
                      <button type="button" className="io-btn" onClick={onClearImage} disabled={imageBusy} style={{ color: "crimson", alignSelf: "flex-start" }}>
                        حذف الصورة
                      </button>
                    )}
                  </div>
                  {imageBusy ? <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: "bold" }}>جارٍ التجهيز...</span> : null}
                </div>
              </div>
              <label className="master-field">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />{" "}
                نشط
              </label>
              <div className="master-actions" style={{ justifyContent: "flex-end", marginTop: 20 }}>
                {selectedId && (
                  <button type="button" className="io-btn" onClick={onDelete} disabled={!selectedId} style={{ color: "crimson" }}>
                    حذف الصنف
                  </button>
                )}
                <button type="button" className="io-btn" onClick={() => setIsModalOpen(false)}>
                  إغلاق
                </button>
                <button type="submit" className="io-btn-primary" disabled={imageBusy}>
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
