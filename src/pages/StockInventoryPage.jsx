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
