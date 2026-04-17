import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("ar-SY");
}

export default function PurchasedProductsPage() {
  const [stores, setStores] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [rows, setRows] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [onlyWithStock, setOnlyWithStock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");

  const filteredWarehouses = useMemo(() => {
    if (!storeId) return warehouses;
    return warehouses.filter((w) => w.storeId === storeId);
  }, [warehouses, storeId]);

  useEffect(() => {
    if (!warehouseId) return;
    if (!filteredWarehouses.some((w) => w.id === warehouseId)) {
      setWarehouseId("");
    }
  }, [warehouseId, filteredWarehouses]);

  const loadMeta = useCallback(async () => {
    try {
      const [storesData, warehousesData] = await Promise.all([
        api.get("/stores"),
        api.get("/inv-warehouses"),
      ]);
      setStores(storesData.items ?? []);
      setWarehouses(warehousesData.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setErr("");
    setWarn("");
    try {
      const data = await api.get("/inventory/purchased-products", {
        storeId: storeId || undefined,
        warehouseId: warehouseId || undefined,
        q: q.trim() || undefined,
        onlyWithStock: onlyWithStock ? "true" : "false",
      });
      setRows(data.items ?? []);
    } catch (e) {
      const isMissingPurchasedProductsApi =
        Number(e?.status) === 404 &&
        String(e?.message ?? "").includes("Cannot GET /api/v1/inventory/purchased-products");

      if (!isMissingPurchasedProductsApi) {
        setErr(e.message);
        setRows([]);
        return;
      }

      try {
        // Fallback for older backend deployments that do not include /inventory/purchased-products yet.
        const raw = await api.get("/inventory/stock-balances", {
          warehouseId: warehouseId || undefined,
        });
        const stockRows = raw.items ?? [];
        const byWarehouse = new Map(warehouses.map((w) => [w.id, w]));

        const searchTerm = q.trim().toLowerCase();
        const mapped = stockRows
          .map((r) => {
            const wh = byWarehouse.get(r.warehouseId);
            const item = r.item ?? {};
            const itemName = String(item.name ?? "");
            const itemNo = String(item.itemNo ?? "");
            const barcode = String(item.barcode ?? "");
            const category = String(item.category ?? "");

            if (storeId && wh?.storeId !== storeId) return null;
            if (searchTerm) {
              const hay = `${itemName} ${itemNo} ${barcode} ${category}`.toLowerCase();
              if (!hay.includes(searchTerm)) return null;
            }

            const qtyOnHand = Number(r.qtyOnHand ?? 0);
            if (onlyWithStock && !(qtyOnHand > 0)) return null;

            return {
              warehouseId: r.warehouseId,
              warehouseName: r.warehouse?.name ?? wh?.name ?? "—",
              warehouseCode: r.warehouse?.code ?? wh?.code ?? null,
              storeId: wh?.storeId ?? null,
              storeName: wh?.store?.name ?? null,
              itemId: r.itemId,
              item: {
                ...item,
                imageUrl: item.imageUrl ?? null,
              },
              purchasedQty: r.qtyOnHand ?? 0,
              qtyOnHand: r.qtyOnHand ?? 0,
              avgUnitCost: r.avgUnitCost ?? 0,
              lastPurchaseAt: null,
              lastVoucherId: null,
              lastVoucherNo: null,
            };
          })
          .filter(Boolean);

        setRows(mapped);
        setWarn("تم استخدام وضع التوافق: السيرفر لا يدعم بعد صفحة منتجات الشراء التفصيلية.");
      } catch (fallbackError) {
        setErr(fallbackError.message);
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, warehouseId, q, onlyWithStock, warehouses]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">منتجات فواتير الشراء حسب المخزن</h2>
      <p className="master-lead">
        هذه الصفحة تعرض الأصناف التي دخلت عبر فواتير الشراء، مع صورة الصنف، الكمية المضافة، والرصيد
        الحالي في كل مخزن.
      </p>

      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      {warn ? <div className="master-banner">{warn}</div> : null}

      <div className="master-form" style={{ marginBottom: 12 }}>
        <h3 className="master-form-title">تصفية العرض</h3>
        <label className="master-field">
          المخزن
          <select
            className="io-date-input master-input"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">— كل المخازن —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          المستودع
          <select
            className="io-date-input master-input"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">— كل المستودعات —</option>
            {filteredWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          بحث (اسم/رقم/باركود)
          <input
            className="io-date-input master-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اكتب للبحث..."
          />
        </label>
        <label className="master-field">
          <input
            type="checkbox"
            checked={onlyWithStock}
            onChange={(e) => setOnlyWithStock(e.target.checked)}
          />{" "}
          عرض الأصناف التي رصيدها أكبر من صفر فقط
        </label>
        <div className="master-actions">
          <button type="button" className="io-btn-primary" onClick={loadRows} disabled={loading}>
            {loading ? "جاري التحميل..." : "تحديث"}
          </button>
        </div>
      </div>

      <div className="master-table-wrap">
        <table className="master-table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الصنف</th>
              <th>رقم الصنف</th>
              <th>المخزن</th>
              <th>المستودع</th>
              <th>الكمية المضافة</th>
              <th>الرصيد الحالي</th>
              <th>آخر فاتورة</th>
              <th>آخر إدخال</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 14 }}>
                  {loading ? "جاري التحميل..." : "لا توجد بيانات مطابقة."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.warehouseId}-${r.itemId}`}>
                  <td>
                    {r.item?.imageUrl ? (
                      <img
                        src={r.item.imageUrl}
                        alt={r.item?.name ?? "صنف"}
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>{r.item?.name ?? "—"}</td>
                  <td dir="ltr">{r.item?.itemNo ?? "—"}</td>
                  <td>{r.storeName ?? "—"}</td>
                  <td>{r.warehouseName ?? "—"}</td>
                  <td dir="ltr">{String(r.purchasedQty ?? 0)}</td>
                  <td dir="ltr">{String(r.qtyOnHand ?? 0)}</td>
                  <td dir="ltr">{r.lastVoucherNo ?? "—"}</td>
                  <td>{formatDate(r.lastPurchaseAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
