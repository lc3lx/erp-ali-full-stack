import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";

/** ربط سطر فاتورة شراء/بيع بصنف من الكتالوج */
export function ItemLineLinkPanel({ mode, voucherId, line, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [itemId, setItemId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [stockQty, setStockQty] = useState(null);
  const [warehouseName, setWarehouseName] = useState("");

  const loadCat = useCallback(async (q = "") => {
    try {
      const d = await api.get("/items/lookup", { q });
      setCatalog(d.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCat(searchText);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [loadCat, searchText]);

  useEffect(() => {
    setItemId(line?.itemId ?? "");
    setSearchText("");
    setErr("");
    setStockQty(null);
    setWarehouseName("");
  }, [line?.id, line?.itemId]);

  const stockEndpoint =
    mode === "purchase"
      ? `/invoice-vouchers/${voucherId}/stock`
      : `/invoice-sale/${voucherId}/stock`;

  const loadStock = useCallback(
    async (selectedItemId) => {
      if (!voucherId || !selectedItemId) {
        setStockQty(null);
        setWarehouseName("");
        return;
      }
      try {
        const data = await api.get(stockEndpoint, { itemId: selectedItemId });
        setWarehouseName(data.warehouse?.name ?? "");
        const row = (data.items ?? []).find((x) => x.itemId === selectedItemId);
        setStockQty(row ? Number(row.qtyOnHand ?? 0) : 0);
      } catch {
        setStockQty(null);
        setWarehouseName("");
      }
    },
    [stockEndpoint, voucherId],
  );

  useEffect(() => {
    loadStock(itemId || line?.itemId || "");
  }, [itemId, line?.itemId, loadStock]);

  if (!voucherId || !line?.id) return null;

  const base =
    mode === "purchase"
      ? `/invoice-vouchers/${voucherId}/items`
      : `/invoice-sale/${voucherId}/items`;

  const requestedQty = useMemo(() => {
    if (!line) return 0;
    if (mode === "sale") return Number(line.listQty ?? 0);
    const pieces = Number(line.piecesSum ?? 0);
    if (pieces > 0) return pieces;
    return Number(line.boxesSum ?? 0);
  }, [line, mode]);

  const showLowStockWarning =
    mode === "sale" &&
    itemId &&
    stockQty != null &&
    requestedQty > 0 &&
    requestedQty > stockQty;

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
        maxWidth: 560,
      }}
      dir="rtl"
    >
      <strong>ربط السطر بالصنف (مخزون)</strong>
      <div style={{ marginTop: 8 }}>
        <label>صنف الكتالوج:</label>
        <SearchableDropdown
          value={itemId}
          onChange={setItemId}
          options={catalog}
          getOptionValue={(item) => item.id}
          getOptionLabel={(item) => `${item.name}${item.itemNo ? ` (${item.itemNo})` : ""}`}
          placeholder="— بدون ربط —"
          searchPlaceholder="ابحث بالاسم / الرقم / الباركود"
          onSearchChange={setSearchText}
          clearLabel="— بدون ربط —"
        />
        <button type="button" className="iv-item-btn green" style={{ marginInlineStart: 8 }} onClick={onSave} disabled={busy}>
          حفظ الربط
        </button>
        <button type="button" className="iv-item-btn" style={{ marginInlineStart: 4 }} onClick={() => loadCat(searchText)} disabled={busy}>
          تحديث القائمة
        </button>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
        <span>
          مستودع: <strong>{warehouseName || "—"}</strong>
        </span>
        <span>
          المتاح: <strong>{stockQty == null ? "—" : String(stockQty)}</strong>
        </span>
        {mode === "sale" ? (
          <span>
            المطلوب بالسطر: <strong>{String(requestedQty || 0)}</strong>
          </span>
        ) : null}
      </div>
      {showLowStockWarning ? (
        <div style={{ color: "crimson", marginTop: 6 }}>
          تحذير: الكمية المطلوبة أعلى من المتاح في المستودع المحدد.
        </div>
      ) : null}
      {err ? <div style={{ color: "crimson", marginTop: 6 }}>{err}</div> : null}
    </div>
  );
}
