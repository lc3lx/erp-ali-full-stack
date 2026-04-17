import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";

const MAX_IMAGE_DATA_URL_LENGTH = 850_000;

function toNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر معالجة الصورة."));
    img.src = src;
  });
}

async function optimizeImageFile(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (!rawDataUrl.startsWith("data:image/")) {
    throw new Error("يرجى اختيار ملف صورة صالح.");
  }
  const img = await loadImage(rawDataUrl);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز الصورة.");

  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > MAX_IMAGE_DATA_URL_LENGTH && quality > 0.45) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }

  if (out.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("الصورة كبيرة جداً. اختر صورة أصغر.");
  }
  return out;
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

/** ربط سطر فاتورة شراء/بيع بصنف من الكتالوج + صورة الصنف */
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
      setMsg("تم تجهيز صورة الصنف.");
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
    setMsg("تمت إزالة الصورة.");
  };

  const onSave = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api.patch(`${base}/${line.id}`, { itemId: itemId ? itemId : null });
      if (itemId && imageTouched) {
        await api.patch(`/items/${itemId}`, { imageUrl: imageUrl || null });
      }
      setImageTouched(false);
      setMsg("تم حفظ الربط والصورة.");
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
        imageUrl: imageUrl || null,
        defaultUom: inferDefaultUom(line, mode),
      });
      await api.patch(`${base}/${line.id}`, { itemId: created.id });
      setItemId(created.id);
      setImageTouched(false);
      setMsg("تم إنشاء الصنف وربطه بالسطر.");
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
      <strong>ربط السطر بالصنف (مخزون + صورة)</strong>
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
          disabled={busy || imageBusy}
        >
          حفظ الربط
        </button>
        <button
          type="button"
          className="iv-item-btn"
          style={{ marginInlineStart: 4 }}
          onClick={() => loadCat(searchText)}
          disabled={busy || imageBusy}
        >
          تحديث القائمة
        </button>
        {mode === "purchase" ? (
          <button
            type="button"
            className="iv-item-btn green"
            style={{ marginInlineStart: 4 }}
            onClick={onCreateAndLinkFromLine}
            disabled={busy || imageBusy}
          >
            إنشاء صنف من السطر
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>صورة الصنف</div>
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
              <img src={imageUrl} alt="صورة الصنف" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 11, color: "#6b7280" }}>بدون</span>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onPickImage} disabled={busy || imageBusy} />
          <button type="button" className="iv-item-btn red" onClick={onClearImage} disabled={busy || imageBusy}>
            حذف الصورة
          </button>
          {imageBusy ? <span style={{ fontSize: 12, color: "#334155" }}>جارٍ تجهيز الصورة...</span> : null}
        </div>
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
