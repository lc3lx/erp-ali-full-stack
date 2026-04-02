import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

function emptyForm() {
  return { name: "", phone: "", address: "", balanceDisplay: "" };
}

export default function SuppliersManagementPage() {
  const [partyType, setPartyType] = useState("SUPPLIER");
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
      const data = await api.get("/parties", { type: partyType, page: 1, pageSize: 500 });
      setItems(data.items ?? []);
      setSelectedId("");
      setForm(emptyForm());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [partyType]);

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
        name: p.name ?? "",
        phone: p.phone ?? "",
        address: p.address ?? "",
        balanceDisplay: p.balanceDisplay ?? "",
      });
    }
  }, [selectedId, items]);

  const onSave = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setErr("الاسم مطلوب");
      return;
    }
    setErr("");
    setMsg("");
    const payload = {
      type: partyType,
      name,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      balanceDisplay: form.balanceDisplay.trim() || null,
    };
    try {
      if (selectedId) {
        await api.patch(`/parties/${selectedId}`, payload);
        setMsg("تم التحديث");
      } else {
        const c = await api.post("/parties", payload);
        setSelectedId(c.id);
        setMsg("تمت الإضافة");
      }
      await loadList();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onDelete = async () => {
    if (!selectedId || !window.confirm("حذف؟")) return;
    try {
      await api.delete(`/parties/${selectedId}`);
      setSelectedId("");
      setMsg("تم الحذف");
      loadList();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">الموردون وشركات التخليص</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}

      <div className="master-toolbar" style={{ marginBottom: 12 }}>
        <label className="master-field" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          النوع
          <select
            className="io-date-input master-input"
            value={partyType}
            onChange={(e) => setPartyType(e.target.value)}
          >
            <option value="SUPPLIER">مورد</option>
            <option value="CLEARANCE">تخليص</option>
          </select>
        </label>
      </div>

      {loading ? <div className="master-muted">جاري التحميل…</div> : null}

      <div className="master-layout">
        <div className="master-panel">
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>هاتف</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className={selectedId === p.id ? "master-row-active" : undefined}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <td>{p.name}</td>
                    <td dir="ltr">{p.phone ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <form className="master-form" onSubmit={onSave}>
          <h3 className="master-form-title">{selectedId ? "تعديل" : "جديد"}</h3>
          <label className="master-field">
            الاسم *
            <input
              className="io-date-input master-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="master-field">
            الهاتف
            <input
              className="io-date-input master-input"
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="master-field">
            العنوان
            <input
              className="io-date-input master-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="master-field">
            عرض الرصيد
            <input
              className="io-date-input master-input"
              value={form.balanceDisplay}
              onChange={(e) => setForm({ ...form, balanceDisplay: e.target.value })}
            />
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
