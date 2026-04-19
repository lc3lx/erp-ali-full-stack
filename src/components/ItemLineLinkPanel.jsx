import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";

function toNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

import { optimizeImageFile } from "../lib/imageUtils.js";

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

/** ط±ط¨ط· ط³ط·ط± ظپط§طھظˆط±ط© ط´ط±ط§ط،/ط¨ظٹط¹ ط¨طµظ†ظپ ظ…ظ† ط§ظ„ظƒطھط§ظ„ظˆط¬ + طµظˆط±ط© ط§ظ„طµظ†ظپ */
export function ItemLineLinkPanel({ mode, voucherId, line, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [itemId, setItemId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [stockQty, setStockQty] = useState(null);
  const [warehouseName, setWarehouseName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageTouched, setImageTouched] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

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
    setImageUrl("");
    setImageTouched(false);
  }, [line?.id, line?.itemId]);

  useEffect(() => {
    let disposed = false;
    if (!itemId) {
      if (!imageTouched) setImageUrl("");
      return () => {};
    }
    (async () => {
      try {
        const item = await api.get(`/items/${itemId}`);
        if (disposed) return;
        if (!imageTouched) setImageUrl(item.imageUrl ?? "");
      } catch {
        // Ignore; dropdown may still include enough data.
      }
    })();
    return () => {
      disposed = true;
    };
  }, [itemId, imageTouched]);

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
    mode === "purchase" && !itemId ? "إضافة المادة + حفظ الصورة" : "حفظ الربط";

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    setErr("");
    setMsg("");
    try {
      const optimized = await optimizeImageFile(file);
      setImageUrl(optimized);
      setImageTouched(true);
      setMsg("طھظ… طھط¬ظ‡ظٹط² طµظˆط±ط© ط§ظ„طµظ†ظپ.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setImageBusy(false);
      event.target.value = "";
    }
  };

  const onClearImage = () => {
    setImageUrl("");
    setImageTouched(true);
    setMsg("طھظ…طھ ط¥ط²ط§ظ„ط© ط§ظ„طµظˆط±ط©.");
  };

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
      if (itemId && imageTouched) {
        await api.patch(`/items/${itemId}`, { imageUrl: imageUrl || null });
      }
      setImageTouched(false);
      setMsg("طھظ… ط­ظپط¸ ط§ظ„ط±ط¨ط· ظˆط§ظ„طµظˆط±ط©.");
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
      setErr("ط£ط¯ط®ظ„ ط§ط³ظ… ط§ظ„ظ…ط§ط¯ط© ظپظٹ ط§ظ„ط³ط·ط± ط£ظˆظ„ط§ظ‹ ط«ظ… ط£ط¹ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط©.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const created = await api.post("/items", {
        name,
        itemNo: itemNo || null,
        imageUrl: imageUrl || null,
        defaultUom: inferDefaultUom(line, mode),
      });
      await api.patch(`${base}/${line.id}`, { itemId: created.id });
      setItemId(created.id);
      setImageTouched(false);
      setMsg("طھظ… ط¥ظ†ط´ط§ط، ط§ظ„طµظ†ظپ ظˆط±ط¨ط·ظ‡ ط¨ط§ظ„ط³ط·ط±.");
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
      <strong>ط±ط¨ط· ط§ظ„ط³ط·ط± ط¨ط§ظ„طµظ†ظپ (ظ…ط®ط²ظˆظ† + طµظˆط±ط©)</strong>
      <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
        ظ„ط§ط®طھظٹط§ط± طµظˆط±ط© ط§ظ„ظ…ظ†طھط¬: ط§ط®طھط± ظ…ظ„ظپ طµظˆط±ط© ط«ظ… ط§ط¶ط؛ط· ط­ظپط¸ ط§ظ„ط±ط¨ط·.
      </div>
      <div style={{ marginTop: 8 }}>
        <label>طµظ†ظپ ط§ظ„ظƒطھط§ظ„ظˆط¬:</label>
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
          placeholder="â€” ط¨ط¯ظˆظ† ط±ط¨ط· â€”"
          searchPlaceholder="ط§ط¨ط­ط« ط¨ط§ظ„ط§ط³ظ… / ط§ظ„ط±ظ‚ظ… / ط§ظ„ط¨ط§ط±ظƒظˆط¯"
          onSearchChange={setSearchText}
          clearLabel="â€” ط¨ط¯ظˆظ† ط±ط¨ط· â€”"
        />
        <button
          type="button"
          className="iv-item-btn green"
          style={{ marginInlineStart: 8 }}
          onClick={onSave}
          disabled={busy || imageBusy}
        >
          {saveActionLabel}
        </button>
        <button
          type="button"
          className="iv-item-btn"
          style={{ marginInlineStart: 4 }}
          onClick={() => loadCat(searchText)}
          disabled={busy || imageBusy}
        >
          طھط­ط¯ظٹط« ط§ظ„ظ‚ط§ط¦ظ…ط©
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>طµظˆط±ط© ط§ظ„طµظ†ظپ</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 64,
              height: 64,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: "#f8fafc",
            }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="طµظˆط±ط© ط§ظ„طµظ†ظپ" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 11, color: "#6b7280" }}>ط¨ط¯ظˆظ†</span>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onPickImage} disabled={busy || imageBusy} />
          <button type="button" className="iv-item-btn red" onClick={onClearImage} disabled={busy || imageBusy}>
            ط­ط°ظپ ط§ظ„طµظˆط±ط©
          </button>
          {imageBusy ? <span style={{ fontSize: 12, color: "#334155" }}>ط¬ط§ط±ظچ طھط¬ظ‡ظٹط² ط§ظ„طµظˆط±ط©...</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
        <span>
          ظ…ط³طھظˆط¯ط¹: <strong>{warehouseName || "â€”"}</strong>
        </span>
        <span>
          ط§ظ„ظ…طھط§ط­: <strong>{stockQty == null ? "â€”" : String(stockQty)}</strong>
        </span>
        {mode === "sale" ? (
          <span>
            ط§ظ„ظ…ط·ظ„ظˆط¨ ط¨ط§ظ„ط³ط·ط±: <strong>{String(requestedQty || 0)}</strong>
          </span>
        ) : null}
      </div>
      {showLowStockWarning ? (
        <div style={{ color: "crimson", marginTop: 6 }}>
          طھط­ط°ظٹط±: ط§ظ„ظƒظ…ظٹط© ط§ظ„ظ…ط·ظ„ظˆط¨ط© ط£ط¹ظ„ظ‰ ظ…ظ† ط§ظ„ظ…طھط§ط­ ظپظٹ ط§ظ„ظ…ط³طھظˆط¯ط¹ ط§ظ„ظ…ط­ط¯ط¯.
        </div>
      ) : null}
      {msg ? <div style={{ color: "#166534", marginTop: 6 }}>{msg}</div> : null}
      {err ? <div style={{ color: "crimson", marginTop: 6 }}>{err}</div> : null}
    </div>
  );
}


