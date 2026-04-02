import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

/** ربط سطر فاتورة شراء/بيع بصنف من الكتالوج */
export function ItemLineLinkPanel({ mode, voucherId, line, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [itemId, setItemId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCat = useCallback(async () => {
    try {
      const d = await api.get("/items/lookup", { q: "" });
      setCatalog(d.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    loadCat();
  }, [loadCat]);

  useEffect(() => {
    setItemId(line?.itemId ?? "");
    setErr("");
  }, [line?.id, line?.itemId]);

  if (!voucherId || !line?.id) return null;

  const base =
    mode === "purchase"
      ? `/invoice-vouchers/${voucherId}/items`
      : `/invoice-sale/${voucherId}/items`;

  const onSave = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.patch(`${base}/${line.id}`, { itemId: itemId ? itemId : null });
      await onSaved?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        margin: "10px 0",
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 6,
        maxWidth: 480,
      }}
      dir="rtl"
    >
      <strong>ربط السطر بالصنف (مخزون)</strong>
      <div style={{ marginTop: 8 }}>
        <label>
          صنف الكتالوج:{" "}
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">— بدون ربط —</option>
            {catalog.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.itemNo ? ` (${i.itemNo})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="iv-item-btn green" style={{ marginInlineStart: 8 }} onClick={onSave} disabled={busy}>
          حفظ الربط
        </button>
        <button type="button" className="iv-item-btn" style={{ marginInlineStart: 4 }} onClick={loadCat} disabled={busy}>
          تحديث القائمة
        </button>
      </div>
      {err ? <div style={{ color: "crimson", marginTop: 6 }}>{err}</div> : null}
    </div>
  );
}
