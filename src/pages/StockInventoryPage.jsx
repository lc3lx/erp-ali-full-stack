import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function StockInventoryPage() {
  const [balances, setBalances] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [tf, setTf] = useState("");
  const [tt, setTt] = useState("");
  const [ti, setTi] = useState("");
  const [tqty, setTqty] = useState("");
  const [cardItemId, setCardItemId] = useState("");
  const [cardWarehouseId, setCardWarehouseId] = useState("");
  const [cardMoves, setCardMoves] = useState([]);
  const [cardLoading, setCardLoading] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [b, w, it] = await Promise.all([
        api.get("/inventory/stock-balances"),
        api.get("/inv-warehouses"),
        api.get("/items/lookup"),
      ]);
      setBalances(b.items ?? []);
      setWarehouses(w.items ?? []);
      setItems(it.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadItemCard = async () => {
    if (!cardItemId) {
      setErr("اختر صنفاً لعرض كارت الحركات");
      return;
    }
    setErr("");
    setCardLoading(true);
    setCardMoves([]);
    try {
      const q = cardWarehouseId ? { warehouseId: cardWarehouseId } : {};
      const d = await api.get(`/inventory/items/${cardItemId}/card`, q);
      setCardMoves(d.moves ?? []);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setCardLoading(false);
    }
  };

  const doTransfer = async (e) => {
    e.preventDefault();
    try {
      await api.post("/inventory/transfer", {
        fromWarehouseId: tf,
        toWarehouseId: tt,
        itemId: ti,
        qty: tqty,
      });
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">أرصدة المخزون وتحويل</h2>
      <p className="master-lead" style={{ marginTop: 0, marginBottom: 12 }}>
        المستودعات هنا هي نفس مواقع <strong>المخازن والمستودعات</strong> في الإدارة — كل مخزن له مستودع جرد مرتبط تلقائياً.
      </p>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      <button type="button" className="master-btn master-btn-ghost" onClick={load}>
        تحديث
      </button>
      <div className="master-table-wrap">
        <table className="master-table">
          <thead>
            <tr>
              <th>مستودع</th>
              <th>صنف</th>
              <th>الكمية</th>
              <th>متوسط التكلفة</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((r) => (
              <tr key={`${r.warehouseId}-${r.itemId}`}>
                <td>{r.warehouse?.name}</td>
                <td>{r.item?.name}</td>
                <td dir="ltr">{String(r.qtyOnHand)}</td>
                <td dir="ltr">{String(r.avgUnitCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="master-form" style={{ marginTop: 20 }}>
        <h3 className="master-form-title">كارت الصنف (حركات المخزون)</h3>
        <p className="master-hint" style={{ marginBottom: 8, color: "#555" }}>
          عرض كل حركات الصنف المختار (شراء، بيع، تحويل، تسوية…) حسب المستودع أو الكل.
        </p>
        <label className="master-field">
          صنف
          <select
            className="io-date-input master-input"
            value={cardItemId}
            onChange={(e) => setCardItemId(e.target.value)}
          >
            <option value="">— اختر —</option>
            {items.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          مستودع (اختياري)
          <select
            className="io-date-input master-input"
            value={cardWarehouseId}
            onChange={(e) => setCardWarehouseId(e.target.value)}
          >
            <option value="">— كل المستودعات —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="io-btn-primary" onClick={loadItemCard} disabled={cardLoading}>
          {cardLoading ? "جاري التحميل…" : "عرض الحركات"}
        </button>
      </div>

      {cardMoves.length > 0 ? (
        <div className="master-table-wrap" style={{ marginTop: 12 }}>
          <table className="master-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المستودع</th>
                <th>النوع</th>
                <th>الكمية</th>
                <th>تكلفة الوحدة</th>
                <th>الإجمالي</th>
                <th>مرجع</th>
              </tr>
            </thead>
            <tbody>
              {cardMoves.map((m) => (
                <tr key={m.id}>
                  <td dir="ltr">{m.moveDate ? String(m.moveDate).slice(0, 19) : "—"}</td>
                  <td>{m.warehouse?.name ?? "—"}</td>
                  <td>{m.type}</td>
                  <td dir="ltr">{String(m.qty)}</td>
                  <td dir="ltr">{String(m.unitCost)}</td>
                  <td dir="ltr">{String(m.totalCost)}</td>
                  <td dir="ltr" style={{ fontSize: 11 }}>
                    {m.referenceKind}
                    {m.referenceId ? ` / ${m.referenceId.slice(0, 8)}…` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form className="master-form" onSubmit={doTransfer}>
        <h3 className="master-form-title">تحويل بين مستودعات</h3>
        <label className="master-field">
          من
          <select className="io-date-input master-input" value={tf} onChange={(e) => setTf(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          إلى
          <select className="io-date-input master-input" value={tt} onChange={(e) => setTt(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          صنف
          <select className="io-date-input master-input" value={ti} onChange={(e) => setTi(e.target.value)}>
            <option value="">—</option>
            {items.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          كمية
          <input className="io-date-input master-input" value={tqty} onChange={(e) => setTqty(e.target.value)} />
        </label>
        <button type="submit" className="io-btn-primary">
          تنفيذ
        </button>
      </form>
    </div>
  );
}
