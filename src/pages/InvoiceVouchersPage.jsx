import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { GlPurchaseVoucherPost } from "../components/GlDocumentPost.jsx";
import { DocumentStatusBadge } from "../components/erp/DocumentStatusBadge.jsx";
import { ItemLineLinkPanel } from "../components/ItemLineLinkPanel.jsx";
import { SearchableDropdown } from "../components/SearchableDropdown.jsx";
import { formatIsoToDisplay, toApiDateTime } from "../lib/dates.js";
import { MASTERS_REFRESH_EVENT, navigateAppPage, printRootWithLocale } from "../lib/uiActions.js";
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

export default function InvoiceVouchersPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [voucherId, setVoucherId] = useState("");
  const [detail, setDetail] = useState(null);
  const [lines, setLines] = useState([]);
  const [totals, setTotals] = useState(null);
  const [err, setErr] = useState("");
  const [containers, setContainers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
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

  const reloadVoucher = useCallback(async (id) => {
    if (!id) return;
    const [d, itemsRes, t] = await Promise.all([
      api.get(`/invoice-vouchers/${id}`),
      api.get(`/invoice-vouchers/${id}/items`),
      api.get(`/invoice-vouchers/${id}/totals`),
    ]);
    setDetail(d);
    setLines(itemsRes.items ?? []);
    setTotals(t);
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [data, cont, sup, st] = await Promise.all([
          api.get("/invoice-vouchers", { page: 1, pageSize: 100 }),
          api.get("/containers", { page: 1, pageSize: 200 }),
          api.get("/parties", { type: "SUPPLIER", page: 1, pageSize: 300 }),
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
        setSuppliers(sup.items ?? []);
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
      if (scope !== "stores" && scope !== "all") return;
      (async () => {
        try {
          if (scope === "stores") {
            const st = await api.get("/stores");
            setStores(st.items ?? []);
          } else {
            const [cont, sup, st] = await Promise.all([
              api.get("/containers", { page: 1, pageSize: 200 }),
              api.get("/parties", { type: "SUPPLIER", page: 1, pageSize: 300 }),
              api.get("/stores"),
            ]);
            setContainers(cont.items ?? []);
            setSuppliers(sup.items ?? []);
            setStores(st.items ?? []);
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
    const cn = sessionStorage.getItem("purchaseVouchersJumpContainerNo")?.trim();
    if (!cn || !list.length) return;
    const match = list.find((v) => String(v.container?.containerNo ?? "").trim() === cn);
    sessionStorage.removeItem("purchaseVouchersJumpContainerNo");
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
    setSelectedSupplierId(detail?.supplierId ?? "");
    setSelectedStoreId(detail?.storeId ?? "");
  }, [detail?.id, detail?.supplierId, detail?.storeId, detail?.updatedAt]);

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
        const stock = await api.get(`/invoice-vouchers/${voucherId}/stock`);
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

  const exchangeRate = str(detail?.exchangeRate ?? "6.7");
  const date = detail?.voucherDate ? formatIsoToDisplay(detail.voucherDate) : "";
  const voucherNo = detail?.voucherNo ?? "";
  const currency = detail?.currency ?? "ط¯ظˆظ„ط§ط±";
  const agg = totals?.aggregates;

  const formId = "iv-header-form";

  const onWorkflowSubmit = async () => {
    if (!voucherId) return;
    try {
      await api.post(`/invoice-vouchers/${voucherId}/workflow/submit`, {});
      await reloadVoucher(voucherId);
    } catch (e) {
      window.alert(e.message);
    }
  };
  const onWorkflowApprove = async () => {
    if (!voucherId) return;
    try {
      await api.post(`/invoice-vouchers/${voucherId}/workflow/approve`, {});
      await reloadVoucher(voucherId);
    } catch (e) {
      window.alert(e.message);
    }
  };
  const onWorkflowReject = async () => {
    if (!voucherId) return;
    const comment = window.prompt("ط³ط¨ط¨ ط§ظ„ط±ظپط¶ (ط§ط®طھظٹط§ط±ظٹ)") ?? "";
    try {
      await api.post(`/invoice-vouchers/${voucherId}/workflow/reject`, { comment: comment || null });
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
      await api.patch(`/invoice-vouchers/${voucherId}`, {
        voucherNo: String(fd.get("voucherNo") || "").trim() || undefined,
        voucherDate: toApiDateTime(String(fd.get("voucherDate") || "")) ?? null,
        exchangeRate: fd.get("exchangeRate") || undefined,
        officeCommission: fd.get("officeCommission") || undefined,
        cbmTransportPrice: fd.get("cbmTransportPrice") || undefined,
        currency: fd.get("currency") || undefined,
        containerId: fd.get("containerId") || undefined,
        supplierId: selectedSupplierId || undefined,
        storeId: selectedStoreId || null,
        notes: fd.get("notes") || null,
      });
      await reloadVoucher(voucherId);
      const data = await api.get("/invoice-vouchers", { page: 1, pageSize: 100 });
      setList(data.items ?? []);
      setEditing(false);
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onNew = async () => {
    const cid = containers[0]?.id;
    const sid = suppliers[0]?.id;
    if (!cid || !sid) {
      window.alert("طھط­طھط§ط¬ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ ط­ط§ظˆظٹط© ظˆظ…ظˆط±ط¯ ظپظٹ ط§ظ„ط¬ط¯ط§ظˆظ„.");
      return;
    }
    const vn = window.prompt("ط±ظ‚ظ… ط³ظ†ط¯ ط§ظ„ط´ط±ط§ط،طں", `P-${Date.now()}`);
    if (!vn || !vn.trim()) return;
    try {
      const v = await api.post("/invoice-vouchers", {
        voucherNo: vn.trim(),
        containerId: cid,
        supplierId: sid,
        currency: "ط¯ظˆظ„ط§ط±",
      });
      const data = await api.get("/invoice-vouchers", { page: 1, pageSize: 100 });
      setList(data.items ?? []);
      setVoucherId(v.id);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDelete = async () => {
    if (!voucherId || !window.confirm("ط­ط°ظپ ط§ظ„ط³ظ†ط¯طں")) return;
    try {
      await api.delete(`/invoice-vouchers/${voucherId}`);
      const data = await api.get("/invoice-vouchers", { page: 1, pageSize: 100 });
      const items = data.items ?? [];
      setList(items);
      setVoucherId(items[0]?.id ?? "");
    } catch (e) {
      setErr(e.message);
    }
  };

  const onAddLine = async () => {
    if (!voucherId) return;
    const itemName = window.prompt("ط§ط³ظ… ط§ظ„ظ…ط§ط¯ط©", "ط³ط·ط± ط¬ط¯ظٹط¯");
    if (itemName == null) return;
    const itemNo = window.prompt("ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط©", "");
    if (itemNo == null) return;
    const priceToCustomerSum = window.prompt("Price to Customer Sum", "");
    if (priceToCustomerSum == null) return;
    const weightSum = window.prompt("Weight Sum", "");
    if (weightSum == null) return;
    const weight = window.prompt("Weight", "");
    if (weight == null) return;
    const cbmSum = window.prompt("CBM Sum", "");
    if (cbmSum == null) return;
    const cbm = window.prompt("CBM", "");
    if (cbm == null) return;
    const boxesSum = window.prompt("Boxes Sum", "");
    if (boxesSum == null) return;
    const piecesSum = window.prompt("Pieces Sum", "");
    if (piecesSum == null) return;
    const priceSum = window.prompt("Price Sum", "");
    if (priceSum == null) return;
    const cartonPcs = window.prompt("Carton PCS", "");
    if (cartonPcs == null) return;
    const unitPrice = window.prompt("Price", "");
    if (unitPrice == null) return;
    try {
      await api.post(`/invoice-vouchers/${voucherId}/items`, {
        itemName: itemName.trim() || null,
        itemNo: itemNo.trim() || null,
        priceToCustomerSum: numOrNull(priceToCustomerSum),
        weightSum: numOrNull(weightSum),
        weight: numOrNull(weight),
        cbmSum: numOrNull(cbmSum),
        cbm: numOrNull(cbm),
        boxesSum: numOrNull(boxesSum),
        piecesSum: numOrNull(piecesSum),
        priceSum: numOrNull(priceSum),
        cartonPcs: numOrNull(cartonPcs),
        unitPrice: numOrNull(unitPrice),
      });
      await reloadVoucher(voucherId);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDeleteLine = async () => {
    if (!voucherId || !selectedLineId || !window.confirm("ط­ط°ظپ ط§ظ„ط³ط·ط±طں")) return;
    try {
      await api.delete(`/invoice-vouchers/${voucherId}/items/${selectedLineId}`);
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
    const itemName = window.prompt("ط§ط³ظ… ط§ظ„ظ…ط§ط¯ط©", row.itemName ?? "");
    if (itemName == null) return;
    const itemNo = window.prompt("ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط©", row.itemNo ?? "");
    if (itemNo == null) return;
    const priceToCustomerSum = window.prompt("Price to Customer Sum", str(row.priceToCustomerSum ?? ""));
    if (priceToCustomerSum == null) return;
    const weightSum = window.prompt("ط§ظ„ظˆط²ظ† ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ", str(row.weightSum ?? ""));
    if (weightSum == null) return;
    const weight = window.prompt("Weight", str(row.weight ?? ""));
    if (weight == null) return;
    const cbmSum = window.prompt("CBM Sum", str(row.cbmSum ?? ""));
    if (cbmSum == null) return;
    const cbm = window.prompt("CBM", str(row.cbm ?? ""));
    if (cbm == null) return;
    const boxesSum = window.prompt("Boxes Sum", str(row.boxesSum ?? ""));
    if (boxesSum == null) return;
    const piecesSum = window.prompt("Pieces Sum", str(row.piecesSum ?? ""));
    if (piecesSum == null) return;
    const priceSum = window.prompt("ظ…ط¬ظ…ظˆط¹ ط§ظ„ط³ط¹ط±", str(row.priceSum ?? ""));
    if (priceSum == null) return;
    const cartonPcs = window.prompt("Carton PCS", str(row.cartonPcs ?? ""));
    if (cartonPcs == null) return;
    const unitPrice = window.prompt("Price", str(row.unitPrice ?? ""));
    if (unitPrice == null) return;
    try {
      await api.patch(`/invoice-vouchers/${voucherId}/items/${selectedLineId}`, {
        itemName: itemName.trim() || null,
        itemNo: itemNo.trim() || null,
        priceToCustomerSum: numOrNull(priceToCustomerSum),
        weightSum: numOrNull(weightSum),
        weight: numOrNull(weight),
        cbmSum: numOrNull(cbmSum),
        cbm: numOrNull(cbm),
        boxesSum: numOrNull(boxesSum),
        piecesSum: numOrNull(piecesSum),
        priceSum: numOrNull(priceSum),
        cartonPcs: numOrNull(cartonPcs),
        unitPrice: numOrNull(unitPrice),
      });
      await reloadVoucher(voucherId);
    } catch (e) {
      setErr(e.message);
    }
  };

  const editableFields = new Set([
    "priceToCustomerSum",
    "weightSum",
    "weight",
    "cbmSum",
    "cbm",
    "boxesSum",
    "piecesSum",
    "priceSum",
    "cartonPcs",
    "unitPrice",
    "itemName",
    "itemNo",
  ]);

  const numericFields = new Set([
    "priceToCustomerSum",
    "weightSum",
    "weight",
    "cbmSum",
    "cbm",
    "boxesSum",
    "piecesSum",
    "priceSum",
    "cartonPcs",
    "unitPrice",
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
      await api.patch(`/invoice-vouchers/${voucherId}/items/${lineId}`, payload);
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
    else window.alert("ظ„ط§ طھظˆط¬ط¯ ظپظˆط§طھظٹط± ط´ط±ط§ط، ظپظٹ ط§ظ„ظ‚ط§ط¦ظ…ط©.");
  };

  const showRecentVoucherList = () => {
    if (!list.length) {
      window.alert("ظ„ط§ طھظˆط¬ط¯ ظپظˆط§طھظٹط±.");
      return;
    }
    const lines = list.slice(0, 20).map((v, i) => `${i + 1}. ${v.voucherNo} â€” ${v.container?.containerNo ?? "?"}`);
    window.alert(`ط£ط­ط¯ط« ط§ظ„ط³ظ†ط¯ط§طھ (ط­ط³ط¨ ط§ظ„طھط¹ط¯ظٹظ„):\n\n${lines.join("\n")}`);
  };

  const scrollHeader = () => headerBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollLines = () => linesBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openLinkedContainer = () => {
    const cn = detail?.container?.containerNo?.trim();
    if (cn) sessionStorage.setItem("reportsJumpContainerNo", cn);
    navigateAppPage("list");
  };

  return (
    <div className="iv-page" dir="ltr" ref={pageRootRef}>
      {err ? <div className="alert-error" style={{ margin: 6 }}>{err}</div> : null}
      <div className="iv-titleline">Invoice Vouchers</div>

      <div className="iv-top-tabs" ref={headerBlockRef}>
        <button type="button" className="iv-tab active" onClick={scrollHeader}>
          Invoice Vouchers
        </button>
        <button type="button" className="iv-tab" onClick={scrollLines}>
          Details
        </button>

        <div className="iv-spacer" />

        <button type="button" className="iv-mini-btn" onClick={() => setEditing((x) => !x)}>
          {editing ? "Lock" : "Edit"}
        </button>
      </div>

      <form id={formId} onSubmit={onSave}>
        <div className="iv-controls-row">
          <button type="submit" className="iv-btn-soft iv-btn-edit">
            Save
          </button>
          <span className="iv-lbl-small">%</span>
          <input
            className="iv-mini-input"
            name="officeCommission"
            readOnly={!editing}
            defaultValue={str(detail?.officeCommission ?? "0")}
            key={`oc-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="iv-lbl-small">office commossion</span>
          <input
            className="iv-mini-input"
            name="cbmTransportPrice"
            readOnly={!editing}
            defaultValue={str(detail?.cbmTransportPrice ?? "")}
            key={`cbm-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="iv-lbl-small">cbm transport price</span>
          <input className="iv-mini-input" value={str(detail?.policyNo ?? "")} readOnly />

          <div className="iv-spacer" />

          <input
            className="iv-rate-input"
            name="exchangeRate"
            readOnly={!editing}
            defaultValue={exchangeRate}
            key={`er-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="iv-lbl-small">ط³ط¹ط± ط§ظ„طµط±ظپ</span>

          <input
            className="iv-date-input"
            name="voucherDate"
            readOnly={!editing}
            placeholder="dd/mm/yyyy"
            defaultValue={date}
            key={`vd-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="iv-lbl-small">Date</span>

          <input
            className="iv-voucher-input"
            name="voucherNo"
            readOnly={!editing}
            defaultValue={voucherNo}
            key={`vn-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="iv-lbl-small">Voucher No</span>
        </div>

        <div className="iv-controls-row second">
          <select
            className="iv-blue-input"
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
          <span className="iv-lbl-small">Container No</span>

          <SearchableDropdown
            name="supplierId"
            dir="rtl"
            className="iv-search-select"
            inputClassName="iv-balance-input"
            disabled={!editing}
            value={selectedSupplierId}
            onChange={setSelectedSupplierId}
            options={suppliers}
            getOptionValue={(party) => party.id}
            getOptionLabel={(party) => party.name}
            placeholder="ط§ط®طھط± ط§ظ„ظ…ظˆط±ط¯"
            searchPlaceholder="ط§ط¨ط­ط« ط¹ظ† ظ…ظˆط±ط¯..."
            clearLabel="â€” ط§ط®طھط± ط§ظ„ظ…ظˆط±ط¯ â€”"
            allowClear={false}
          />
          <span className="iv-lbl-small">Supplier</span>

          <div className="iv-voucher-stack">
            <select
              className="iv-currency-select"
              name="currency"
              disabled={!editing}
              defaultValue={currency}
              key={`cur-${voucherId}-${detail?.updatedAt}`}
            >
              <option value="ط¯ظˆظ„ط§ط±">ط¯ظˆظ„ط§ط±</option>
              <option value="ط¯ظٹظ†ط§ط±">ط¯ظٹظ†ط§ط±</option>
            </select>
            <select
              className="iv-voucher-list"
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
        </div>

        <div className="erp-workflow-row" style={{ margin: "6px 0" }}>
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

        <div className="iv-controls-row third">
          <button type="button" className="iv-blue-wide" onClick={openLinkedContainer} title="ظپطھط­ ط§ظ„ط­ط§ظˆظٹط© ظپظٹ ظ‚ط§ط¦ظ…ط© ط§ظ„ط­ط§ظˆظٹط§طھ">
            container vouchers
          </button>

          <div className="iv-spacer" />

          <SearchableDropdown
            name="storeId"
            className="iv-search-select"
            inputClassName="iv-small-select"
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
          <span className="iv-lbl-small">Store Targit</span>

          <input
            className="iv-mini-input notes"
            name="notes"
            readOnly={!editing}
            defaultValue={detail?.notes ?? ""}
            key={`nt-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="iv-lbl-small">Nots</span>
        </div>
      </form>

      <div className="iv-controls-row" style={{ marginTop: 6 }}>
        <button type="button" className="iv-item-btn green" onClick={onNew}>
          NEW voucher
        </button>
        <button type="button" className="iv-item-btn red" onClick={onDelete}>
          Delete voucher
        </button>
        <button type="button" className="iv-item-btn green" onClick={onAddLine}>
          Add line
        </button>
        <button type="button" className="iv-item-btn red" onClick={onDeleteLine} disabled={!selectedLineId}>
          Delete line
        </button>
        <button type="button" className="iv-item-btn green" onClick={onEditLine} disabled={!selectedLineId}>
          Edit line
        </button>
      </div>

      <div className="iv-table-wrap" ref={linesBlockRef}>
        <div className="iv-side-item-actions">
          <button type="button" className="iv-item-btn red" onClick={onDeleteLine} disabled={!selectedLineId}>
            Delete Item
          </button>
          <button type="button" className="iv-item-btn green" onClick={onAddLine}>
            Add Item
          </button>
        </div>

        <table className="iv-table">
          <thead>
            <tr>
              <th />
              <th>
                Price to
                <br />
                Costumer Sum
              </th>
              <th>
                Weight
                <br />
                Sum
              </th>
              <th>Weight</th>
              <th>
                cbm
                <br />
                Sum
              </th>
              <th>cbm</th>
              <th>
                Boxes
                <br />
                Sum
              </th>
              <th>
                Pieces
                <br />
                Sum
              </th>
              <th>Price Sum</th>
              <th>carton pcs</th>
              <th>price</th>
              <th>Item Name</th>
              <th>item no</th>
              <th>available</th>
              <th>seq</th>
              <th>pic</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ textAlign: "center", padding: 12 }}>
                  ظ„ط§ ط£ط³ط·ط±
                </td>
              </tr>
            ) : (
              lines.map((r) => (
                <tr
                  key={r.id}
                  style={{ cursor: "pointer", background: selectedLineId === r.id ? "#e8f4ff" : undefined }}
                  onClick={() => setSelectedLineId(r.id)}
                >
                  <td className="iv-arrow">â–¶</td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "priceToCustomerSum", r.priceToCustomerSum)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "priceToCustomerSum" ? (
                      <input
                        autoFocus
                        className="iv-mini-input"
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={saveCellEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCellEdit();
                          if (e.key === "Escape") cancelCellEdit();
                        }}
                      />
                    ) : (
                      str(r.priceToCustomerSum)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "weightSum", r.weightSum)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "weightSum" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.weightSum)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "weight", r.weight)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "weight" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.weight)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "cbmSum", r.cbmSum)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "cbmSum" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.cbmSum)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "cbm", r.cbm)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "cbm" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.cbm)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "boxesSum", r.boxesSum)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "boxesSum" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.boxesSum)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "piecesSum", r.piecesSum)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "piecesSum" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.piecesSum)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "priceSum", r.priceSum)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "priceSum" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.priceSum)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "cartonPcs", r.cartonPcs)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "cartonPcs" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.cartonPcs)
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "unitPrice", r.unitPrice)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "unitPrice" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      str(r.unitPrice)
                    )}
                  </td>
                  <td className="iv-item-name" onDoubleClick={() => beginCellEdit(r.id, "itemName", r.itemName)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "itemName" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      r.itemName ?? ""
                    )}
                  </td>
                  <td onDoubleClick={() => beginCellEdit(r.id, "itemNo", r.itemNo)}>
                    {editingCell?.lineId === r.id && editingCell?.field === "itemNo" ? (
                      <input autoFocus className="iv-mini-input" value={cellValue} onChange={(e) => setCellValue(e.target.value)} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }} />
                    ) : (
                      r.itemNo ?? ""
                    )}
                  </td>
                  <td>{r.itemId ? str(stockByItem[r.itemId] ?? 0) : "—"}</td>
                  <td>{r.seq}</td>
                  <td>{r.itemId ? "linked" : "â€”"}</td>
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
      <ItemLineLinkPanel
        mode="purchase"
        voucherId={voucherId}
        line={lines.find((x) => x.id === selectedLineId)}
        onSaved={() => reloadVoucher(voucherId)}
      />

      <div className="iv-summary-row">
        <div className="iv-sum-grid">
          <div className="iv-sum-item">
            <div className="iv-sum-item-box">{str(agg?.priceToCustomerSum ?? "")}</div>
            <div className="iv-sum-item-label">Price to Customer Sum</div>
          </div>
          <div className="iv-sum-item">
            <div className="iv-sum-item-box">{str(agg?.weightSum ?? "")}</div>
            <div className="iv-sum-item-label">Weight Sum</div>
          </div>
          <div className="iv-sum-item">
            <div className="iv-sum-item-box">{str(agg?.boxesSum ?? "")}</div>
            <div className="iv-sum-item-label">Boxes Sum</div>
          </div>
          <div className="iv-sum-item">
            <div className="iv-sum-item-box">{str(agg?.piecesSum ?? "")}</div>
            <div className="iv-sum-item-label">Pieces Sum</div>
          </div>
          <div className="iv-sum-item">
            <div className="iv-sum-item-box">{str(totals?.summation ?? "")}</div>
            <div className="iv-sum-item-label">Summation</div>
          </div>
        </div>
      </div>
      <div className="iv-balance-panel">
        <div className="iv-balance-line">
          <input className="iv-balance-small" value={str(totals?.summation ?? "")} readOnly />
          <span>summation</span>
        </div>
        <div className="iv-balance-line">
          <input className="iv-balance-small" value={str(totals?.paid ?? "")} readOnly />
          <span>paied</span>
        </div>
        <div className="iv-balance-line">
          <input className="iv-balance-small" value={str(totals?.balance ?? "")} readOnly />
          <span>balance</span>
        </div>
      </div>

      <GlPurchaseVoucherPost
        voucherId={voucherId}
        glJournalEntryId={detail?.glJournalEntryId}
        documentStatus={detail?.documentStatus}
        onPosted={() => reloadVoucher(voucherId)}
      />

      <div className="iv-bottom-actions">
        <button type="button" className="iv-bottom-btn" onClick={onNew}>
          NEW
        </button>
        <button type="button" className="iv-bottom-btn red" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="iv-bottom-btn" onClick={() => document.getElementById(formId)?.requestSubmit()}>
          Save
        </button>
        <button
          type="button"
          className="iv-bottom-btn yellow"
          onClick={() => printRootWithLocale(pageRootRef.current, { dir: "rtl", lang: "ar" })}
        >
          ط·ط¨ط§ط¹ط©
          <br />
          ط¹ط±ط¨ظٹ
        </button>
        <button
          type="button"
          className="iv-bottom-btn yellow"
          onClick={() => printRootWithLocale(pageRootRef.current, { dir: "ltr", lang: "en" })}
        >
          Print
          <br />
          English
        </button>
        <button type="button" className="iv-bottom-btn" onClick={goLatestVoucher}>
          Last Voucher
        </button>
        <button type="button" className="iv-bottom-btn" onClick={showRecentVoucherList}>
          Last Edited
          <br />
          Vouchers
        </button>
        <button
          type="button"
          className="iv-bottom-btn"
          onClick={() => voucherId && reloadVoucher(voucherId)}
        >
          Re Load Last
          <br />
          Voucher
        </button>
        <button type="button" className="iv-bottom-btn green" onClick={() => navigateAppPage("is")}>
          Direct Sal
        </button>
        <button
          type="button"
          className="iv-bottom-btn green"
          onClick={() => {
            setEditing(false);
            setErr("");
            setSelectedLineId("");
          }}
        >
          X
        </button>
        <button type="button" className="iv-bottom-btn green" onClick={scrollLines}>
          second
        </button>
        <button type="button" className="iv-bottom-btn blue" onClick={scrollHeader}>
          main
        </button>
      </div>
    </div>
  );
}

