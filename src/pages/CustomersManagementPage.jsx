import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { dispatchMastersRefresh } from "../lib/uiActions.js";
import "../App.css";

function emptyForm() {
  return {
    name: "",
    phone: "",
    address: "",
    balanceDisplay: "",
    saleDiscountDefault: "",
  };
}

function partyToForm(p) {
  if (!p) return emptyForm();
  return {
    name: p.name ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    balanceDisplay: p.balanceDisplay ?? "",
    saleDiscountDefault:
      p.saleDiscountDefault != null && p.saleDiscountDefault !== "" ? String(p.saleDiscountDefault) : "",
  };
}

export default function CustomersManagementPage() {
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
      const data = await api.get("/parties", { type: "CUSTOMER", page: 1, pageSize: 500 });
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
      setForm(emptyForm());
      return;
    }
    const p = items.find((x) => x.id === selectedId);
    if (p) setForm(partyToForm(p));
  }, [selectedId, items]);

  const onNew = () => {
    setSelectedId("");
    setForm(emptyForm());
    setErr("");
    setMsg("صفحة جديدة — املأ الحقول واحفظ لإنشاء زبون");
  };

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const name = form.name.trim();
    if (!name) {
      setErr("اسم الزبون مطلوب");
      return;
    }
    const payload = {
      type: "CUSTOMER",
      name,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      balanceDisplay: form.balanceDisplay.trim() || null,
      saleDiscountDefault:
        form.saleDiscountDefault.trim() === "" ? null : Number(form.saleDiscountDefault) || form.saleDiscountDefault,
    };
    try {
      if (selectedId) {
        await api.patch(`/parties/${selectedId}`, payload);
        setMsg("تم تحديث الزبون");
      } else {
        const created = await api.post("/parties", payload);
        setSelectedId(created.id);
        setMsg("تم إضافة زبون جديد");
      }
      await loadList();
      dispatchMastersRefresh("customers");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onDelete = async () => {
    if (!selectedId) {
      setErr("اختر زبوناً من الجدول أولاً");
      return;
    }
    if (!window.confirm("حذف هذا الزبون نهائياً؟ (يُرفض إن كان مرتبطاً بحاوية أو فاتورة)")) return;
    setErr("");
    setMsg("");
    try {
      await api.delete(`/parties/${selectedId}`);
      setSelectedId("");
      setForm(emptyForm());
      setMsg("تم الحذف");
      await loadList();
      dispatchMastersRefresh("customers");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">إدارة الزبائن</h2>
      <p className="master-lead">
        الزبائن يظهرون في <strong>الحاويات</strong> و<strong>فواتير البيع</strong> وغيرها. بعد الحفظ، الصفحات
        الأخرى تعرض القائمة المحدثة عند إعادة فتحها أو التحديث.
      </p>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {msg ? <div className="master-banner master-banner-ok">{msg}</div> : null}
      {loading ? <div className="master-muted">جاري التحميل…</div> : null}

      <div className="master-layout">
        <div className="master-panel">
          <div className="master-toolbar">
            <span className="master-toolbar-lbl">قائمة الزبائن ({items.length})</span>
            <button type="button" className="master-btn master-btn-ghost" onClick={loadList}>
              تحديث
            </button>
          </div>
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>عرض الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="master-empty">
                      لا زبائن بعد — أضف أول زبون من النموذج.
                    </td>
                  </tr>
                ) : (
                  items.map((p) => (
                    <tr
                      key={p.id}
                      className={selectedId === p.id ? "master-row-active" : undefined}
                      onClick={() => {
                        setSelectedId(p.id);
                        setMsg("");
                        setErr("");
                      }}
                    >
                      <td>{p.name}</td>
                      <td dir="ltr">{p.phone ?? ""}</td>
                      <td>{p.balanceDisplay ?? ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="master-form" onSubmit={onSave}>
          <h3 className="master-form-title">{selectedId ? "تعديل زبون" : "زبون جديد"}</h3>
          <label className="master-field">
            الاسم <span className="master-req">*</span>
            <input
              className="io-date-input master-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label className="master-field">
            الهاتف
            <input
              className="io-date-input master-input"
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="master-field">
            العنوان
            <input
              className="io-date-input master-input"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          <label className="master-field">
            عرض الرصيد (نص)
            <input
              className="io-date-input master-input"
              value={form.balanceDisplay}
              onChange={(e) => setForm((f) => ({ ...f, balanceDisplay: e.target.value }))}
            />
          </label>
          <label className="master-field">
            خصم بيع افتراضي
            <input
              className="io-date-input master-input"
              dir="ltr"
              placeholder="0"
              value={form.saleDiscountDefault}
              onChange={(e) => setForm((f) => ({ ...f, saleDiscountDefault: e.target.value }))}
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
