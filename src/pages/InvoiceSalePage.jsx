import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { GlSaleVoucherPost } from "../components/GlDocumentPost.jsx";
import { DocumentStatusBadge } from "../components/erp/DocumentStatusBadge.jsx";
import { ItemLineLinkPanel } from "../components/ItemLineLinkPanel.jsx";
import { SearchableDropdown } from "../components/SearchableDropdown.jsx";
import { formatIsoToDisplay, toApiDateTime } from "../lib/dates.js";
import {
  MASTERS_REFRESH_EVENT,
  navigateAppPage,
  printRootWithLocale,
  printWithBanner,
} from "../lib/uiActions.js";
import "../App.css";

function str(v) {
  if (v == null || v === "") return "";
  return String(v);
}

function numOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function InvoiceSalePage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [voucherId, setVoucherId] = useState("");
  const [detail, setDetail] = useState(null);
  const [lines, setLines] = useState([]);
  const [totals, setTotals] = useState(null);
  const [err, setErr] = useState("");
  const [containers, setContainers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [stockRows, setStockRows] = useState([]);
  const [stockByItem, setStockByItem] = useState({});
  const [stockWarehouseName, setStockWarehouseName] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState("");
  const pageRootRef = useRef(null);
  const headerBlockRef = useRef(null);
  const linesBlockRef = useRef(null);
  const totalsBlockRef = useRef(null);

  const reloadVoucher = useCallback(async (id) => {
    if (!id) return;
    const [d, itemsRes, t] = await Promise.all([
      api.get(`/invoice-sale/${id}`),
      api.get(`/invoice-sale/${id}/items`),
      api.get(`/invoice-sale/${id}/totals`),
    ]);
    setDetail(d);
    setLines(itemsRes.items ?? []);
    setTotals(t);
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [data, cont, cust, st] = await Promise.all([
          api.get("/invoice-sale", { page: 1, pageSize: 100 }),
          api.get("/containers", { page: 1, pageSize: 200 }),
          api.get("/parties", { type: "CUSTOMER", page: 1, pageSize: 300 }),
          api.get("/stores"),
        ]);
        if (c) return;
        const items = data.items ?? [];
        setList(items);
        setVoucherId((prev) => {
          if (prev && items.some((x) => x.id === prev)) return prev;
          return items[0]?.id ?? "";
        });
        setContainers(cont.items ?? []);
        setCustomers(cust.items ?? []);
        setStores(st.items ?? []);
      } catch (e) {
        if (!c) setErr(e.message);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e.detail?.scope;
      if (!scope) return;
      (async () => {
        try {
          if (scope === "customers" || scope === "all") {
            const cust = await api.get("/parties", { type: "CUSTOMER", page: 1, pageSize: 300 });
            setCustomers(cust.items ?? []);
          }
          if (scope === "stores" || scope === "all") {
            const st = await api.get("/stores");
            setStores(st.items ?? []);
          }
          if (scope === "all") {
            const cont = await api.get("/containers", { page: 1, pageSize: 200 });
            setContainers(cont.items ?? []);
          }
        } catch (ex) {
          setErr(ex.message);
        }
      })();
    };
    window.addEventListener(MASTERS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MASTERS_REFRESH_EVENT, onRefresh);
  }, []);

  useEffect(() => {
    const cn = sessionStorage.getItem("saleVouchersJumpContainerNo")?.trim();
    if (!cn || !list.length) return;
    const match = list.find((v) => String(v.container?.containerNo ?? "").trim() === cn);
    sessionStorage.removeItem("saleVouchersJumpContainerNo");
    if (match) setVoucherId(match.id);
  }, [list]);

  useEffect(() => {
    if (!voucherId) {
      setDetail(null);
      setLines([]);
      setTotals(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await reloadVoucher(voucherId);
        if (!cancelled) setErr("");
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voucherId, reloadVoucher]);

  useEffect(() => {
    setSelectedLineId("");
    setEditing(false);
  }, [voucherId]);

  useEffect(() => {
    setSelectedCustomerId(detail?.customerId ?? "");
    setSelectedStoreId(detail?.storeId ?? "");
  }, [detail?.id, detail?.customerId, detail?.storeId, detail?.updatedAt]);

  useEffect(() => {
    if (!voucherId) {
      setStockRows([]);
      setStockByItem({});
      setStockWarehouseName("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stock = await api.get(`/invoice-sale/${voucherId}/stock`);
        if (cancelled) return;
        const rows = stock.items ?? [];
        setStockRows(rows);
        setStockWarehouseName(stock.warehouse?.name ?? "");
        const map = {};
        for (const row of rows) {
          map[row.itemId] = Number(row.qtyOnHand ?? 0);
        }
        setStockByItem(map);
      } catch {
        if (cancelled) return;
        setStockRows([]);
        setStockByItem({});
        setStockWarehouseName("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voucherId, lines]);

  const exchangeRate = str(detail?.exchangeRate ?? "6.8");
  const date = detail?.voucherDate ? formatIsoToDisplay(detail.voucherDate) : "";
  const voucherNo = detail?.voucherNo ?? "";
  const currency = detail?.currency ?? "ط¯ظˆظ„ط§ط±";
  const agg = totals?.aggregates;
  const formId = "is-header-form";

  const onWorkflowSubmit = async () => {
    if (!voucherId) return;
    try {
      await api.post(`/invoice-sale/${voucherId}/workflow/submit`, {});
      await reloadVoucher(voucherId);
    } catch (e) {
      window.alert(e.message);
    }
  };
  const onWorkflowApprove = async () => {
    if (!voucherId) return;
    try {
      await api.post(`/invoice-sale/${voucherId}/workflow/approve`, {});
      await reloadVoucher(voucherId);
    } catch (e) {
      window.alert(e.message);
    }
  };
  const onWorkflowReject = async () => {
    if (!voucherId) return;
    const comment = window.prompt("ط³ط¨ط¨ ط§ظ„ط±ظپط¶ (ط§ط®طھظٹط§ط±ظٹ)") ?? "";
    try {
      await api.post(`/invoice-sale/${voucherId}/workflow/reject`, { comment: comment || null });
      await reloadVoucher(voucherId);
    } catch (e) {
      window.alert(e.message);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!voucherId) return;
    const formEl = document.getElementById(formId);
    if (!formEl) return;
    const fd = new FormData(formEl);
    try {
      await api.patch(`/invoice-sale/${voucherId}`, {
        voucherNo: String(fd.get("voucherNo") || "").trim() || undefined,
        voucherDate: toApiDateTime(String(fd.get("voucherDate") || "")) ?? null,
        exchangeRate: fd.get("exchangeRate") || undefined,
        officeCommission: fd.get("officeCommission") || undefined,
        cbmTransportPrice: fd.get("cbmTransportPrice") || undefined,
        currency: fd.get("currency") || undefined,
        containerId: fd.get("containerId") || undefined,
        customerId: selectedCustomerId || undefined,
        storeId: selectedStoreId || null,
        notes: fd.get("notes") || null,
      });
      await reloadVoucher(voucherId);
      const data = await api.get("/invoice-sale", { page: 1, pageSize: 100 });
      setList(data.items ?? []);
      setEditing(false);
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onNew = async () => {
    const cid = containers[0]?.id;
    const custId = customers[0]?.id;
    if (!cid || !custId) {
      window.alert("طھط­طھط§ط¬ ط­ط§ظˆظٹط© ظˆط²ط¨ظˆظ† ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„.");
      return;
    }
    const vn = window.prompt("ط±ظ‚ظ… ط³ظ†ط¯ ط§ظ„ط¨ظٹط¹طں", `S-${Date.now()}`);
    if (!vn || !vn.trim()) return;
    try {
      const v = await api.post("/invoice-sale", {
        voucherNo: vn.trim(),
        containerId: cid,
        customerId: custId,
        currency: "ط¯ظˆظ„ط§ط±",
      });
      const data = await api.get("/invoice-sale", { page: 1, pageSize: 100 });
      setList(data.items ?? []);
      setVoucherId(v.id);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDelete = async () => {
    if (!voucherId || !window.confirm("ط­ط°ظپ ط³ظ†ط¯ ط§ظ„ط¨ظٹط¹طں")) return;
    try {
      await api.delete(`/invoice-sale/${voucherId}`);
      const data = await api.get("/invoice-sale", { page: 1, pageSize: 100 });
      const items = data.items ?? [];
      setList(items);
      setVoucherId(items[0]?.id ?? "");
    } catch (e) {
      setErr(e.message);
    }
  };

  const onAddLine = async () => {
    if (!voucherId) return;
    try {
      await api.post(`/invoice-sale/${voucherId}/items`, { detail: "ط³ط·ط± ط¬ط¯ظٹط¯" });
      await reloadVoucher(voucherId);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDeleteLine = async () => {
    if (!voucherId || !selectedLineId || !window.confirm("ط­ط°ظپ ط§ظ„ط³ط·ط±طں")) return;
    try {
      await api.delete(`/invoice-sale/${voucherId}/items/${selectedLineId}`);
      setSelectedLineId("");
      await reloadVoucher(voucherId);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onEditLine = async () => {
    if (!voucherId || !selectedLineId) return;
    const row = lines.find((x) => x.id === selectedLineId);
    if (!row) return;
    const detailText = window.prompt("ط§ظ„طھظپط§طµظٹظ„", row.detail ?? "");
    if (detailText == null) return;
    const itemNo = window.prompt("ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط©", row.itemNo ?? "");
    if (itemNo == null) return;
    const qty = window.prompt("ط§ظ„ظƒظ…ظٹط©", str(row.listQty ?? ""));
    if (qty == null) return;
    const totalPrice = window.prompt("ظ…ط¬ظ…ظˆط¹ ط§ظ„ط³ط¹ط±", str(row.totalPrice ?? ""));
    if (totalPrice == null) return;
    try {
      await api.patch(`/invoice-sale/${voucherId}/items/${selectedLineId}`, {
        detail: detailText,
        itemNo,
        listQty: Number(qty) || 0,
        totalPrice: Number(totalPrice) || 0,
      });
      await reloadVoucher(voucherId);
    } catch (e) {
      setErr(e.message);
    }
  };

  const editableFields = new Set([
    "usdConvertRate",
    "usdSumCol",
    "usdPriceCol",
    "cbmSumCol",
    "weight",
    "cbm1",
    "cbm2",
    "listQty",
    "pricePerThousand",
    "totalPrice",
    "pcsInCarton",
    "linePrice",
    "detail",
    "itemNo",
  ]);

  const numericFields = new Set([
    "usdConvertRate",
    "usdSumCol",
    "usdPriceCol",
    "cbmSumCol",
    "weight",
    "cbm1",
    "cbm2",
    "listQty",
    "pricePerThousand",
    "totalPrice",
    "pcsInCarton",
    "linePrice",
  ]);

  const beginCellEdit = (lineId, field, currentValue) => {
    if (!editableFields.has(field)) return;
    setSelectedLineId(lineId);
    setEditingCell({ lineId, field });
    setCellValue(str(currentValue));
  };

  const saveCellEdit = async () => {
    if (!editingCell || !voucherId) return;
    const { lineId, field } = editingCell;
    const payload = {};
    if (numericFields.has(field)) payload[field] = numOrNull(cellValue);
    else payload[field] = cellValue.trim() || null;
    try {
      await api.patch(`/invoice-sale/${voucherId}/items/${lineId}`, payload);
      await reloadVoucher(voucherId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setEditingCell(null);
      setCellValue("");
    }
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setCellValue("");
  };

  const goLatestVoucher = () => {
    const id = list[0]?.id;
    if (id) setVoucherId(id);
    else window.alert("ظ„ط§ طھظˆط¬ط¯ ظپظˆط§طھظٹط± ط¨ظٹط¹.");
  };

  const showRecentVoucherList = () => {
    if (!list.length) {
      window.alert("ظ„ط§ طھظˆط¬ط¯ ظپظˆط§طھظٹط±.");
      return;
    }
    const lines = list.slice(0, 20).map((v, i) => `${i + 1}. ${v.voucherNo} â€” ${v.container?.containerNo ?? "?"}`);
    window.alert(`ط£ط­ط¯ط« ط³ظ†ط¯ط§طھ ط§ظ„ط¨ظٹط¹:\n\n${lines.join("\n")}`);
  };

  const scrollHeader = () => headerBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollLines = () => linesBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollTotals = () => totalsBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openContainerInList = () => {
    const cn = detail?.container?.containerNo?.trim();
    if (cn) sessionStorage.setItem("reportsJumpContainerNo", cn);
    navigateAppPage("list");
  };

  const lowStockLines = lines.filter((line) => {
    if (!line.itemId) return false;
    const required = Number(line.listQty ?? 0);
    if (required <= 0) return false;
    const available = Number(stockByItem[line.itemId] ?? 0);
    return required > available;
  });

  return (
    <div className="is-page" dir="ltr" ref={pageRootRef}>
      {err ? <div className="alert-error" style={{ margin: 6 }}>{err}</div> : null}
      <div className="is-titleline">Sale Vouchers</div>

      <div className="is-top-wrap" ref={headerBlockRef}>
        <div className="is-top-row">
          <button type="button" className="is-btn-edit" onClick={() => setEditing((x) => !x)}>
            {editing ? "ظ‚ظپظ„" : "طھط¹ط¯ظٹظ„"}
          </button>
          <span className="is-lbl">%0</span>
          <span className="is-lbl">ط¹ظ…ظˆظ„ط© ط§ظ„ظ…ظƒطھط¨</span>
          <input
            className="is-small-input"
            name="officeCommission"
            form={formId}
            readOnly={!editing}
            defaultValue={str(detail?.officeCommission ?? "0")}
            key={`oc-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="is-lbl">ط³ط¹ط± ظ†ظ‚ظ„ ط§ظ„ظ…طھط± ط§ظ„ظ…ظƒط¹ط¨</span>
          <input
            className="is-small-input"
            name="cbmTransportPrice"
            form={formId}
            readOnly={!editing}
            defaultValue={str(detail?.cbmTransportPrice ?? "")}
            key={`cbm-${voucherId}-${detail?.updatedAt}`}
          />

          <div className="is-spacer" />

          <input
            className="is-rate-input"
            name="exchangeRate"
            form={formId}
            readOnly={!editing}
            defaultValue={exchangeRate}
            key={`er-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="is-rate-lbl">ط³ط¹ط± ط§ظ„طµط±ظپ</span>
        </div>

        <form id={formId} onSubmit={onSave}>
          <div className="is-mid-row">
            <div className="is-left-cluster">
              <div className="is-balance-line">
                <span className="is-mini-title">ظ…ط¬ظ…ظˆط¹</span>
                <input className="is-balance-input" value={str(totals?.total ?? "")} readOnly />
              </div>
              <div className="is-container-line">
                <select
                  className="is-container-input"
                  name="containerId"
                  disabled={!editing}
                  defaultValue={detail?.containerId ?? ""}
                  key={`ct-${voucherId}-${detail?.updatedAt}`}
                >
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.containerNo}
                    </option>
                  ))}
                </select>
                <span className="is-lbl">ط±ظ‚ظ… ط§ظ„ط­ط§ظˆظٹط©</span>
              </div>
              <button
                type="button"
                className="is-blue-pill"
                onClick={() =>
                  window.alert(`ط¹ظ…ظ„ط© ط§ظ„ط³ظ†ط¯: ${detail?.currency ?? "â€”"}\nط³ط¹ط± ط§ظ„طµط±ظپ ط§ظ„ط­ط§ظ„ظٹ ظپظٹ ط§ظ„ظ†ظ…ظˆط°ط¬: ${exchangeRate}`)
                }
                title="ط¹ط±ط¶ ط§ظ„ط¹ظ…ظ„ط© ظˆط³ط¹ط± ط§ظ„طµط±ظپ"
              >
                {detail?.currency ?? "ط§ظ„ط¹ظ…ظ„ط©"}
              </button>
            </div>

            <div className="is-mini-actions">
              <button type="button" className="is-mini-act" onClick={onNew}>
                ط¬ط¯ظٹط¯
              </button>
              <button type="button" className="is-mini-act red" onClick={onDelete}>
                ط­ط°ظپ
              </button>
            </div>

            <SearchableDropdown
              name="customerId"
              dir="rtl"
              className="is-search-select"
              inputClassName="is-supplier-box"
              disabled={!editing}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              options={customers}
              getOptionValue={(party) => party.id}
              getOptionLabel={(party) => party.name}
              placeholder="ط§ط®طھط± ط§ظ„ط²ط¨ظˆظ†"
              searchPlaceholder="ط§ط¨ط­ط« ط¹ظ† ط²ط¨ظˆظ†..."
              clearLabel="â€” ط§ط®طھط± ط§ظ„ط²ط¨ظˆظ† â€”"
              allowClear={false}
            />
            <span className="is-lbl">ط§ظ„ط²ط¨ظˆظ†</span>

            <div className="is-spacer" />

            <input
              className="is-date-input"
              name="voucherDate"
              readOnly={!editing}
              placeholder="dd/mm/yyyy"
              defaultValue={date}
              key={`vd-${voucherId}-${detail?.updatedAt}`}
            />
            <span className="is-lbl">طھط§ط±ظٹط® ط§ظ„ط¹ط§ظ…ط©</span>

            <div className="is-voucher-stack">
              <input
                className="is-voucher-input"
                name="voucherNo"
                readOnly={!editing}
                defaultValue={voucherNo}
                key={`vn-${voucherId}-${detail?.updatedAt}`}
              />
              <select
                className="is-voucher-list"
                size={Math.min(5, Math.max(3, list.length || 3))}
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
              >
                {list.length === 0 ? (
                  <option value="">â€”</option>
                ) : (
                  list.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voucherNo} ({v.currency})
                    </option>
                  ))
                )}
              </select>
            </div>
            <span className="is-lbl">طھ ط§ظ„ظ‚ط§ط¦ظ…ط©</span>

            <div className="erp-workflow-row" style={{ gridColumn: "1 / -1" }}>
              <DocumentStatusBadge status={detail?.documentStatus} />
              {detail?.documentStatus === "DRAFT" && (user?.role === "DATA_ENTRY" || user?.role === "ACCOUNTANT" || user?.role === "ADMIN") ? (
                <button type="button" onClick={onWorkflowSubmit}>
                  ط¥ط±ط³ط§ظ„ ظ„ظ„ظ…ظˆط§ظپظ‚ط©
                </button>
              ) : null}
              {detail?.documentStatus === "SUBMITTED" && (user?.role === "ACCOUNTANT" || user?.role === "ADMIN") ? (
                <>
                  <button type="button" onClick={onWorkflowApprove}>
                    ط§ط¹طھظ…ط§ط¯
                  </button>
                  <button type="button" onClick={onWorkflowReject}>
                    ط±ظپط¶
                  </button>
                </>
              ) : null}
            </div>

            <select
              className="is-currency-select"
              name="currency"
              disabled={!editing}
              defaultValue={currency}
              key={`cur-${voucherId}-${detail?.updatedAt}`}
            >
              <option value="ط¯ظˆظ„ط§ط±">ط¯ظˆظ„ط§ط±</option>
              <option value="ط¯ظٹظ†ط§ط±">ط¯ظٹظ†ط§ط±</option>
            </select>
            <span className="is-lbl">ط§ظ„ط¹ظ…ظ„ط©</span>
          </div>

          <div className="is-top-row third">
            <div className="is-spacer" />
            <SearchableDropdown
              name="storeId"
              className="is-search-select"
              inputClassName="is-store-select"
              disabled={!editing}
              value={selectedStoreId}
              onChange={setSelectedStoreId}
              options={stores}
              getOptionValue={(store) => store.id}
              getOptionLabel={(store) => store.name}
              placeholder="—"
              searchPlaceholder="ابحث عن مستودع..."
              clearLabel="— بدون مستودع —"
            />
            <span className="is-lbl">Store Targit</span>
            <input
              className="is-notes-input"
              name="notes"
              readOnly={!editing}
              defaultValue={detail?.notes ?? ""}
              key={`nt-${voucherId}-${detail?.updatedAt}`}
            />
            <span className="is-lbl">ظ…ظ„ط§ط­ط¸ط§طھ</span>
          </div>
          <div className="is-top-row" style={{ marginTop: 8 }}>
            <button type="submit" className="is-btn">
              ط­ظپط¸ ط§ظ„ط³ظ†ط¯
            </button>
            <button type="button" className="is-item-btn green" onClick={onAddLine}>
              + ط³ط·ط±
            </button>
            <button type="button" className="is-item-btn red" onClick={onDeleteLine} disabled={!selectedLineId}>
              ط­ط°ظپ ط³ط·ط±
            </button>
            <button type="button" className="is-item-btn green" onClick={onEditLine} disabled={!selectedLineId}>
              طھط¹ط¯ظٹظ„ ط³ط·ط±
            </button>
          </div>
        </form>
      </div>

      <div className="is-table-wrap" ref={linesBlockRef}>
        <table className="is-table">
          <thead>
            <tr>
              <th />
              <th>
                ط³ط¹ط± طھط­ظˆظٹظ„
                <br />
                ط§ظ„ط¯ظˆظ„ط§ط±
              </th>
              <th>
                ظ…ط¬ظ…ظˆط¹ ط³ط¹ط±
                <br />
                ط§ظ„ط¯ظˆظ„ط§ط±
              </th>
              <th>
                ط³ط¹ط±
                <br />
                ط§ظ„ط¯ظˆظ„ط§ط±
              </th>
              <th>
                ظ…ط¬ظ…ظˆط¹ ط§ظ„ظ…طھط±
                <br />
                ط§ظ„ظ…ظƒط¹ط¨
              </th>
              <th>ظˆط²ظ†</th>
              <th>cbm</th>
              <th>cbm</th>
              <th>
                ط¹ط¯ط¯
                <br />
                ط§ظ„ظ‚ط§ط¦ظ…ط©
              </th>
              <th>
                ط³ط¹ط± ظƒظ„
                <br />
                ط§ظ„ظپ
              </th>
              <th>ظ…ط¬ظ…ظˆط¹ ط³ط¹ط±</th>
              <th>
                ظ‚ط·ط¹ط© ط¯ط§ط®ظ„
                <br />
                ط§ظ„ظƒط§ط±طھظˆظ†
              </th>
              <th>ط³ط¹ط±</th>
              <th>ط§ظ„طھظپط§طµظٹظ„</th>
              <th>ط±ظ‚ظ…</th>
              <th>Available</th>
              <th>طھ</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={17} style={{ textAlign: "center", padding: 12 }}>
                  ظ„ط§ ط£ط³ط·ط±
                </td>
              </tr>
            ) : (
              lines.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    cursor: "pointer",
                    background: selectedLineId === r.id ? "#e8f4ff" : undefined,
                  }}
                  onClick={() => setSelectedLineId(r.id)}
                >
                  <td className="is-arrow">â–¶</td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "usdConvertRate", r.usdConvertRate)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "usdConvertRate" ? (
                      <input
                        autoFocus
                        className="is-mini-input"
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={saveCellEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCellEdit();
                          if (e.key === "Escape") cancelCellEdit();
                        }}
                      />
                    ) : (
                      str(r.usdConvertRate)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "usdSumCol", r.usdSumCol)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "usdSumCol" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.usdSumCol)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "usdPriceCol", r.usdPriceCol)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "usdPriceCol" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.usdPriceCol)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "cbmSumCol", r.cbmSumCol)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "cbmSumCol" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.cbmSumCol)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "weight", r.weight)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "weight" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.weight)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "cbm1", r.cbm1)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "cbm1" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.cbm1)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "cbm2", r.cbm2)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "cbm2" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.cbm2)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "listQty", r.listQty)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "listQty" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.listQty)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "pricePerThousand", r.pricePerThousand)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "pricePerThousand" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.pricePerThousand)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "totalPrice", r.totalPrice)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "totalPrice" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.totalPrice)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "pcsInCarton", r.pcsInCarton)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "pcsInCarton" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.pcsInCarton)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "linePrice", r.linePrice)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "linePrice" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.linePrice)
                    )}
                  </td>
                  <td className="is-item-name" onDoubleClick={() => beginCellEdit(r.id, "detail", r.detail)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "detail" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      r.detail ?? ""
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "itemNo", r.itemNo)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "itemNo" ? (
                      <input autoFocus className="is-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      r.itemNo ?? ""
                    )}
                  </td>
                  <td
                    style={{
                      color:
                        r.itemId && Number(r.listQty ?? 0) > Number(stockByItem[r.itemId] ?? 0)
                          ? "crimson"
                          : undefined,
                      fontWeight:
                        r.itemId && Number(r.listQty ?? 0) > Number(stockByItem[r.itemId] ?? 0)
                          ? 700
                          : undefined,
                    }}
                  >
                    {r.itemId ? str(stockByItem[r.itemId] ?? 0) : "—"}
                  </td>
                  <td>{str(r.seq)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {stockWarehouseName ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#334155" }}>
          Warehouse: <strong>{stockWarehouseName}</strong> ({stockRows.length} items)
        </div>
      ) : null}
      {lowStockLines.length > 0 ? (
        <div className="alert-error" style={{ marginTop: 6 }}>
          يوجد {lowStockLines.length} سطر بيع بكمية أكبر من المتاح في المستودع المحدد.
        </div>
      ) : null}

      <div className="is-sum-row">
        <div className="is-sum-grid">
          <div className="is-sum-item">
            <div className="is-sum-item-box">{str(agg?.totalPrice ?? "")}</div>
            <div className="is-sum-item-label">Total Price</div>
          </div>
          <div className="is-sum-item">
            <div className="is-sum-item-box">{str(agg?.cbmSum ?? "")}</div>
            <div className="is-sum-item-label">CBM Sum</div>
          </div>
          <div className="is-sum-item">
            <div className="is-sum-item-box">{str(agg?.listQty ?? "")}</div>
            <div className="is-sum-item-label">List Qty</div>
          </div>
          <div className="is-sum-item">
            <div className="is-sum-item-box">{str("")}</div>
            <div className="is-sum-item-label">-</div>
          </div>
          <div className="is-sum-item">
            <div className="is-sum-item-box">{str(totals?.total ?? "")}</div>
            <div className="is-sum-item-label">Total</div>
          </div>
        </div>
        <div className="is-accounting-row">
          <span className="is-sum-label">ط§ظ„ظ…ط­ط§ط³ط¨ط©</span>
          <input className="is-sum-input yellow" value={str(detail?.accountingDebit ?? "0")} readOnly />
          <span className="is-sum-label">ط§ظ„ظ…ط­ط§ط³ط¨ط© ط¯ط§ط¦ظ†/ظ…ط¯ظٹظ†</span>
        </div>
      </div>

      <div className="is-sum-bottom" ref={totalsBlockRef}>
        <div className="is-total-box">
          <div className="is-total-line">
            <input value={str(totals?.total ?? "")} readOnly />
            <span>ط§ظ„ظ…ط¬ظ…ظˆط¹</span>
          </div>
          <div className="is-total-line">
            <input value={str(totals?.paid ?? "")} readOnly />
            <span>ط§ظ„ظ…ط³ط¯ط¯</span>
          </div>
          <div className="is-total-line">
            <input value={str(totals?.remaining ?? "")} readOnly />
            <span>ط§ظ„ظ…ط¬ظ…ظˆط¹ ط§ظ„ط¨ط§ظ‚ظٹ</span>
          </div>
          <div className="is-total-line">
            <input value={str(totals?.profit ?? "")} readOnly />
            <span>ط£ط±ط¨ط§ط­</span>
          </div>
        </div>
        <div className="is-yellow-note">ط¨ط¶ط§ط¹ط© ظ„ظ‡ط°ط§ ط§ظ„ظ…ط³طھط«ظ…ط±</div>
      </div>

      <ItemLineLinkPanel
        mode="sale"
        voucherId={voucherId}
        line={lines.find((x) => x.id === selectedLineId)}
        onSaved={() => reloadVoucher(voucherId)}
      />

      <GlSaleVoucherPost
        voucherId={voucherId}
        glJournalEntryId={detail?.glJournalEntryId}
        documentStatus={detail?.documentStatus}
        onPosted={() => reloadVoucher(voucherId)}
      />

      <div className="is-bottom-actions">
        <button type="button" className="is-btn" onClick={onNew}>
          NEW
        </button>
        <button type="button" className="is-btn red" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="is-btn" onClick={() => document.getElementById(formId)?.requestSubmit()}>
          Save
        </button>
        <button
          type="button"
          className="is-btn yellow"
          onClick={() => printRootWithLocale(pageRootRef.current, { dir: "rtl", lang: "ar" })}
        >
          ط·ط¨ط§ط¹ط©
          <br />
          ط¹ط±ط¨ظٹ
        </button>
        <button
          type="button"
          className="is-btn yellow"
          onClick={() => printRootWithLocale(pageRootRef.current, { dir: "ltr", lang: "en" })}
        >
          Print
          <br />
          EN
        </button>
        <button type="button" className="is-btn yellow" onClick={openContainerInList}>
          In costomer
          <br />
          or wen house
        </button>
        <button
          type="button"
          className="is-btn yellow"
          onClick={() => {
            const usePride = window.confirm("ظ…ظˆط§ظپظ‚ = ظ†ط³ط®ط© Pride\nط¥ظ„ط؛ط§ط، = ظ†ط³ط®ط© Faqr");
            printWithBanner(pageRootRef.current, usePride ? "Pride copy" : "Faqr copy");
          }}
        >
          Pride
          <br />
          Faqr
        </button>
        <button type="button" className="is-btn" onClick={goLatestVoucher}>
          Last Voucher
        </button>
        <button type="button" className="is-btn" onClick={showRecentVoucherList}>
          Last Edited
          <br />
          Vouchers
        </button>
        <button
          type="button"
          className="is-btn"
          onClick={() => voucherId && reloadVoucher(voucherId)}
        >
          Re Load Last
          <br />
          Voucher
        </button>
        <button
          type="button"
          className="is-btn green"
          onClick={() => {
            setEditing(false);
            setErr("");
            setSelectedLineId("");
          }}
        >
          X
        </button>
        <button type="button" className="is-btn blue" onClick={scrollTotals}>
          third
        </button>
        <button type="button" className="is-btn blue" onClick={scrollLines}>
          secoud
        </button>
        <button type="button" className="is-btn blue" onClick={scrollHeader}>
          main
        </button>
      </div>
    </div>
  );
}

