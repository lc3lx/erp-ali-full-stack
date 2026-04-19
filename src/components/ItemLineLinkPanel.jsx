import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";

function toNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function inferSuggestedName(line, mode) {
  const name = String(line?.itemName ?? "").trim();
  if (name) return name;
  if (mode === "sale") {
    const detail = String(line?.detail ?? "").trim();
    if (detail) return detail;
  }
  const itemNo = String(line?.itemNo ?? "").trim();
  if (itemNo) return itemNo;
  return "";
}

function inferDefaultUom(line, mode) {
  if (mode === "sale") {
    return toNumber(line?.listQty) > 0 ? "PCS" : null;
  }
  return toNumber(line?.piecesSum) > 0 ? "PCS" : toNumber(line?.boxesSum) > 0 ? "BOX" : null;
}

export function ItemLineLinkPanel({ mode, voucherId, line, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [itemId, setItemId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
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
    setMsg("");
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

  const requestedQty = useMemo(() => {
    if (!line) return 0;
    if (mode === "sale") return Number(line.listQty ?? 0);
    const pieces = Number(line.piecesSum ?? 0);
    if (pieces > 0) return pieces;
    return Number(line.boxesSum ?? 0);
  }, [line, mode]);

  if (!voucherId || !line?.id) return null;

  const base =
    mode === "purchase"
      ? `/invoice-vouchers/${voucherId}/items`
      : `/invoice-sale/${voucherId}/items`;

  const showLowStockWarning =
    mode === "sale" &&
    itemId &&
    stockQty != null &&
    requestedQty > 0 &&
    requestedQty > stockQty;

  const saveActionLabel =
    mode === "purchase" && !itemId ? "إضافة المادة" : "حفظ الربط";

  const onSave = async () => {
    if (mode === "purchase" && !itemId) {
      await onCreateAndLinkFromLine();
      return;
    }

    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api.patch(`${base}/${line.id}`, { itemId: itemId ? itemId : null });
      setMsg("تم حفظ الربط بنجاح.");
      await onSaved?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onCreateAndLinkFromLine = async () => {
    const name = inferSuggestedName(line, mode);
    const itemNo = String(line?.itemNo ?? "").trim();
    if (!name) {
      setErr("أدخل اسم المادة في السطر أولاً ثم أعد المحاولة.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const created = await api.post("/items", {
        name,
        itemNo: itemNo || null,
        imageUrl: null,
        defaultUom: inferDefaultUom(line, mode),
      });
      await api.patch(`${base}/${line.id}`, { itemId: created.id });
      setItemId(created.id);
      setMsg("تم إنشاء الصنف وربطه بالسطر بنجاح.");
      await loadCat("");
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
        maxWidth: 760,
      }}
      dir="rtl"
    >
      <strong>ربط السطر بالصنف</strong>
      <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
        لربط الصنف: اختر المنتج من القائمة ثم اضغط حفظ الربط. إضافة صورة الصنف أصبحت الآن من شاشة إضافة الأصناف.
      </div>
      <div style={{ marginTop: 8 }}>
        <label>صنف الكتالوج:</label>
        <SearchableDropdown
          value={itemId}
          onChange={(val) => {
            setItemId(val);
            setErr("");
            setMsg("");
          }}
          options={catalog}
          getOptionValue={(item) => item.id}
          getOptionLabel={(item) => `${item.name}${item.itemNo ? ` (${item.itemNo})` : ""}`}
          placeholder="— بدون ربط —"
          searchPlaceholder="ابحث بالاسم / الرقم / الباركود"
          onSearchChange={setSearchText}
          clearLabel="— بدون ربط —"
        />
        <button
          type="button"
          className="iv-item-btn green"
          style={{ marginInlineStart: 8 }}
          onClick={onSave}
          disabled={busy}
        >
          {saveActionLabel}
        </button>
        <button
          type="button"
          className="iv-item-btn"
          style={{ marginInlineStart: 4 }}
          onClick={() => loadCat(searchText)}
          disabled={busy}
        >
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
      {msg ? <div style={{ color: "#166534", marginTop: 6 }}>{msg}</div> : null}
      {err ? <div style={{ color: "crimson", marginTop: 6 }}>{err}</div> : null}
    </div>
  );
}
