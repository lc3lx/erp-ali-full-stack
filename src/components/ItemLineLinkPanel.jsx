import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";
import { optimizeImageFile } from "../lib/imageUtils.js";

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

function NewProductModal({ isOpen, onClose, onSave, initialName, initialItemNo, initialUom }) {
  const [form, setForm] = useState({
    name: initialName || "",
    itemNo: initialItemNo || "",
    barcode: "",
    category: "",
    defaultUom: initialUom || "",
    imageUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialName || "",
        itemNo: initialItemNo || "",
        barcode: "",
        category: "",
        defaultUom: initialUom || "",
        imageUrl: "",
      });
      setErr("");
      setBusy(false);
    }
  }, [isOpen, initialName, initialItemNo, initialUom]);

  if (!isOpen) return null;

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const optimized = await optimizeImageFile(file);
      setForm((prev) => ({ ...prev, imageUrl: optimized }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("اسم الصنف مطلوب.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (ex) {
      setErr(ex.message || "حدث خطأ أثناء الحفظ");
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999
    }} dir="rtl">
      <div style={{
        background: "#fff", padding: "20px", borderRadius: "8px", width: "400px", maxWidth: "90%",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: "12px"
      }}>
        <h3 style={{ margin: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>منتج جديد</h3>
        {err && <div style={{ color: "crimson", fontSize: 13 }}>{err}</div>}
        <label>
          <span style={{ fontSize: 13, marginBottom: 4, display: "block" }}>اسم المنتج *</span>
          <input className="io-date-input master-input" style={{ width: "100%", boxSizing: "border-box" }}
                 value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </label>
        <div style={{ display: "flex", gap: "10px" }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 13, marginBottom: 4, display: "block" }}>رقم المنتج</span>
            <input className="io-date-input master-input" style={{ width: "100%", boxSizing: "border-box" }}
                   value={form.itemNo} onChange={e => setForm({...form, itemNo: e.target.value})} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 13, marginBottom: 4, display: "block" }}>الباركود</span>
            <input className="io-date-input master-input" style={{ width: "100%", boxSizing: "border-box" }} dir="ltr"
                   value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
          </label>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 13, marginBottom: 4, display: "block" }}>التصنيف</span>
            <input className="io-date-input master-input" style={{ width: "100%", boxSizing: "border-box" }}
                   value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 13, marginBottom: 4, display: "block" }}>وحدة القياس</span>
            <input className="io-date-input master-input" style={{ width: "100%", boxSizing: "border-box" }}
                   value={form.defaultUom} onChange={e => setForm({...form, defaultUom: e.target.value})} />
          </label>
        </div>
        <div>
          <span style={{ fontSize: 13, marginBottom: 4, display: "block" }}>صورة المنتج (اختياري)</span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 48, height: 48, border: "1px solid #ccc", borderRadius: "4px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
              {form.imageUrl ? <img src={form.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#999" }}>بدون</span>}
            </div>
            <input type="file" accept="image/*" onChange={onPickImage} disabled={busy} style={{ fontSize: 12 }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
          <button type="button" className="io-btn" onClick={onClose} disabled={busy}>إلغاء</button>
          <button type="button" className="io-btn-primary" onClick={handleSave} disabled={busy}>إضافة السجل</button>
        </div>
      </div>
    </div>
  );
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
  const [showModal, setShowModal] = useState(false);

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

  const onSave = async () => {
    if (!itemId) {
      setErr("الرجاء اختيار صنف من الكتالوج أو إضافة منتج جديد.");
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

  const handleModalSave = async (formData) => {
    setErr("");
    setMsg("");
    const created = await api.post("/items", {
      name: formData.name,
      itemNo: formData.itemNo || null,
      barcode: formData.barcode || null,
      category: formData.category || null,
      defaultUom: formData.defaultUom || null,
      imageUrl: formData.imageUrl || null,
      isActive: true,
    });
    
    await api.patch(`${base}/${line.id}`, { itemId: created.id });
    
    setItemId(created.id);
    setMsg("تم إنشاء المنتج وربطه بالسطر بنجاح.");
    await loadCat("");
    await onSaved?.();
  };

  return (
    <div
      style={{
        margin: "10px 0",
        padding: 10,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        borderRadius: 6,
        maxWidth: 760,
      }}
      dir="rtl"
    >
      <strong>ربط بيانات السطر (تكويد المنتج)</strong>
      <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
        لبناء أعتدة المخزن بشكل صحيح: قم بربط السطر مع كتالوج المنتجات. للمنتجات الجديدة كلياً، اضغط (اضافة منتج جديد).
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
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
            placeholder="— اختر المنتج المرغوب ربطه —"
            searchPlaceholder="ابحث بالاسم / الرقم / الباركود"
            onSearchChange={setSearchText}
            clearLabel="— بدون ربط —"
          />
        </div>
        <button
          type="button"
          className="iv-item-btn blue"
          onClick={() => setShowModal(true)}
          disabled={busy}
        >
          ➕ إضافة منتج جديد
        </button>
        <button
          type="button"
          className="iv-item-btn green"
          onClick={onSave}
          disabled={busy}
        >
          🔗 حفظ الربط
        </button>
        <button
          type="button"
          className="iv-item-btn"
          onClick={() => loadCat(searchText)}
          disabled={busy}
        >
          تحديث
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, background: "#fff", padding: "8px", borderRadius: "4px", border: "1px solid #eee" }}>
        <span>
          المستودع الهدف: <strong>{warehouseName || "—"}</strong>
        </span>
        <span>
          المتوفر في المستودع: <strong>{stockQty == null ? "—" : String(stockQty)}</strong>
        </span>
        {mode === "sale" ? (
          <span>
            الكمية المباعة: <strong>{String(requestedQty || 0)}</strong>
          </span>
        ) : null}
      </div>
      {showLowStockWarning ? (
        <div style={{ color: "crimson", marginTop: 6, fontSize: 13 }}>
          تحذير: الكمية المباعة أعلى من المتاح في هذا المستودع.
        </div>
      ) : null}
      {msg ? <div style={{ color: "#166534", marginTop: 6, fontSize: 13, fontWeight: "bold" }}>✅ {msg}</div> : null}
      {err ? <div style={{ color: "crimson", marginTop: 6, fontSize: 13, fontWeight: "bold" }}>❌ {err}</div> : null}

      <NewProductModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleModalSave}
        initialName={inferSuggestedName(line, mode)}
        initialItemNo={String(line?.itemNo ?? "").trim()}
        initialUom={inferDefaultUom(line, mode)}
      />
    </div>
  );
}
