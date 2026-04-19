import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { GlPurchaseVoucherPost } from "../components/GlDocumentPost.jsx";
import { DocumentStatusBadge } from "../components/erp/DocumentStatusBadge.jsx";
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
  const [catalog, setCatalog] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState("");
  const pageRootRef = useRef(null);
  const headerBlockRef = useRef(null);
  const linesBlockRef = useRef(null);

  const [isLineEditOpen, setIsLineEditOpen] = useState(false);
  const [lineForm, setLineForm] = useState({
    id: "", itemId: "", itemName: "", itemNo: "",
    priceToCustomerSum: "", weightSum: "", weight: "",
    cbmSum: "", cbm: "", boxesSum: "", piecesSum: "",
    priceSum: "", cartonPcs: "", unitPrice: ""
  });

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
        const [data, cont, sup, st, catRes] = await Promise.all([
          api.get("/invoice-vouchers", { page: 1, pageSize: 100 }),
          api.get("/containers", { page: 1, pageSize: 200 }),
          api.get("/parties", { type: "SUPPLIER", page: 1, pageSize: 300 }),
          api.get("/stores"),
          api.get("/items/lookup")
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
        setCatalog(catRes.items ?? []);
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

  const exchangeRate = str(detail?.exchangeRate ?? "6.7");
  const date = detail?.voucherDate ? formatIsoToDisplay(detail.voucherDate) : "";
  const voucherNo = detail?.voucherNo ?? "";
  const currency = detail?.currency ?? "دولار";
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
    const comment = window.prompt("سبب الرفض (اختياري)") ?? "";
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
        supplierId: fd.get("supplierId") || undefined,
        storeId: fd.get("storeId") || null,
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
      window.alert("تحتاج على الأقل حاوية ومورد في الجداول.");
      return;
    }
    const vn = window.prompt("رقم سند الشراء؟", `P-${Date.now()}`);
    if (!vn || !vn.trim()) return;
    try {
      const v = await api.post("/invoice-vouchers", {
        voucherNo: vn.trim(),
        containerId: cid,
        supplierId: sid,
        currency: "دولار",
      });
      const data = await api.get("/invoice-vouchers", { page: 1, pageSize: 100 });
      setList(data.items ?? []);
      setVoucherId(v.id);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDelete = async () => {
    if (!voucherId || !window.confirm("حذف السند؟")) return;
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

  const openLineEditor = (isEdit = false) => {
    if (!voucherId) return;
    if (isEdit) {
      if (!selectedLineId) return;
      const row = lines.find((x) => x.id === selectedLineId);
      if (!row) return;
      setLineForm({
        id: row.id,
        itemId: row.itemId || "",
        itemName: row.itemName || "",
        itemNo: row.itemNo || "",
        priceToCustomerSum: str(row.priceToCustomerSum),
        weightSum: str(row.weightSum),
        weight: str(row.weight),
        cbmSum: str(row.cbmSum),
        cbm: str(row.cbm),
        boxesSum: str(row.boxesSum),
        piecesSum: str(row.piecesSum),
        priceSum: str(row.priceSum),
        cartonPcs: str(row.cartonPcs),
        unitPrice: str(row.unitPrice),
      });
    } else {
      setLineForm({
        id: "", itemId: "", itemName: "", itemNo: "",
        priceToCustomerSum: "", weightSum: "", weight: "",
        cbmSum: "", cbm: "", boxesSum: "", piecesSum: "",
        priceSum: "", cartonPcs: "", unitPrice: "",
      });
    }
    setIsLineEditOpen(true);
  };

  const saveLineForm = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        itemId: lineForm.itemId || null,
        itemName: lineForm.itemName.trim() || null,
        itemNo: lineForm.itemNo.trim() || null,
        priceToCustomerSum: numOrNull(lineForm.priceToCustomerSum),
        weightSum: numOrNull(lineForm.weightSum),
        weight: numOrNull(lineForm.weight),
        cbmSum: numOrNull(lineForm.cbmSum),
        cbm: numOrNull(lineForm.cbm),
        boxesSum: numOrNull(lineForm.boxesSum),
        piecesSum: numOrNull(lineForm.piecesSum),
        priceSum: numOrNull(lineForm.priceSum),
        cartonPcs: numOrNull(lineForm.cartonPcs),
        unitPrice: numOrNull(lineForm.unitPrice),
      };
      if (lineForm.id) {
        await api.patch(`/invoice-vouchers/${voucherId}/items/${lineForm.id}`, payload);
      } else {
        await api.post(`/invoice-vouchers/${voucherId}/items`, payload);
      }
      await reloadVoucher(voucherId);
      setIsLineEditOpen(false);
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const onAddLine = () => openLineEditor(false);
  const onEditLine = () => openLineEditor(true);

  const onDeleteLine = async () => {
    if (!voucherId || !selectedLineId || !window.confirm("حذف السطر؟")) return;
    try {
      await api.delete(`/invoice-vouchers/${voucherId}/items/${selectedLineId}`);
      setSelectedLineId("");
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
    "itemId"
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
    else window.alert("لا توجد فواتير شراء في القائمة.");
  };

  const showRecentVoucherList = () => {
    if (!list.length) {
      window.alert("لا توجد فواتير.");
      return;
    }
    const lines = list.slice(0, 20).map((v, i) => `${i + 1}. ${v.voucherNo} — ${v.container?.containerNo ?? "?"}`);
    window.alert(`أحدث السندات (حسب التعديل):\n\n${lines.join("\n")}`);
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
          <span className="iv-lbl-small">سعر الصرف</span>

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

          <select
            className="iv-balance-input"
            name="supplierId"
            disabled={!editing}
            defaultValue={detail?.supplierId ?? ""}
            key={`sp-${voucherId}-${detail?.updatedAt}`}
            dir="rtl"
          >
            {suppliers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="iv-lbl-small">Supplier</span>

          <div className="iv-voucher-stack">
            <select
              className="iv-currency-select"
              name="currency"
              disabled={!editing}
              defaultValue={currency}
              key={`cur-${voucherId}-${detail?.updatedAt}`}
            >
              <option value="دولار">دولار</option>
              <option value="دينار">دينار</option>
            </select>
            <select
              className="iv-voucher-list"
              size={Math.min(5, Math.max(3, list.length || 3))}
              value={voucherId}
              onChange={(e) => setVoucherId(e.target.value)}
            >
              {list.length === 0 ? (
                <option value="">—</option>
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
              إرسال للموافقة
            </button>
          ) : null}
          {detail?.documentStatus === "SUBMITTED" && (user?.role === "ACCOUNTANT" || user?.role === "ADMIN") ? (
            <>
              <button type="button" onClick={onWorkflowApprove}>
                اعتماد
              </button>
              <button type="button" onClick={onWorkflowReject}>
                رفض
              </button>
            </>
          ) : null}
        </div>

        <div className="iv-controls-row third">
          <button type="button" className="iv-blue-wide" onClick={openLinkedContainer} title="فتح الحاوية في قائمة الحاويات">
            container vouchers
          </button>

          <div className="iv-spacer" />

          <select
            className="iv-small-select"
            name="storeId"
            disabled={!editing}
            defaultValue={detail?.storeId ?? ""}
            key={`st-${voucherId}-${detail?.updatedAt}`}
          >
            <option value="">—</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
              <th>seq</th>
              <th>pic</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: "center", padding: 12 }}>
                  لا أسطر
                </td>
              </tr>
            ) : (
              lines.map((r) => (
                <tr
                  key={r.id}
                  style={{ cursor: "pointer", background: selectedLineId === r.id ? "#e8f4ff" : undefined }}
                  onClick={() => setSelectedLineId(r.id)}
                >
                  <td className="iv-arrow">▶</td>
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
                  <td>{r.seq}</td>
                  <td>{r.itemId ? catalog.find(x => x.id === r.itemId)?.name || "Linked" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isLineEditOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999
        }} dir="rtl">
          <form className="master-form" onSubmit={saveLineForm} style={{ maxHeight: "90vh", overflowY: "auto", width: "600px", maxWidth: "95%", margin: 0, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", background: "#fff", padding: 20, borderRadius: 8 }}>
            <h3 className="master-form-title" style={{marginTop: 0, borderBottom: "1px solid #e5e7eb", paddingBottom: 10}}>{lineForm.id ? "تعديل سطر الشراء" : "إضافة سطر شراء جديد"}</h3>
            
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4, fontWeight: 600 }}>ربط السطر بمنتج الكتالوج</label>
              <div style={{ border: "1px solid #d1d5db", borderRadius: 4 }}>
                <SearchableDropdown
                  value={lineForm.itemId}
                  onChange={(val) => {
                    const it = catalog.find(x => x.id === val);
                    setLineForm({ 
                       ...lineForm, 
                       itemId: val, 
                       itemName: it?.name || lineForm.itemName, 
                       itemNo: it?.itemNo || lineForm.itemNo 
                    });
                  }}
                  options={catalog}
                  getOptionValue={x => x.id}
                  getOptionLabel={x => `${x.name}${x.itemNo ? ` (${x.itemNo})` : ""}`}
                  placeholder="— ابحث عن المادة —"
                  clearLabel="— بدون ربط —"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 15 }}>
              <label className="master-field">إسم المادة
                <input className="io-date-input master-input" value={lineForm.itemName} onChange={e => setLineForm({...lineForm, itemName: e.target.value})} />
              </label>
              <label className="master-field">رقم المادة
                <input className="io-date-input master-input" value={lineForm.itemNo} onChange={e => setLineForm({...lineForm, itemNo: e.target.value})} />
              </label>
              <label className="master-field">Price To Customer Sum
                <input className="io-date-input master-input" value={lineForm.priceToCustomerSum} onChange={e => setLineForm({...lineForm, priceToCustomerSum: e.target.value})} />
              </label>
              <label className="master-field">Price Sum
                <input className="io-date-input master-input" value={lineForm.priceSum} onChange={e => setLineForm({...lineForm, priceSum: e.target.value})} />
              </label>
              <label className="master-field">Weight Sum
                <input className="io-date-input master-input" value={lineForm.weightSum} onChange={e => setLineForm({...lineForm, weightSum: e.target.value})} />
              </label>
              <label className="master-field">Weight (Unit)
                <input className="io-date-input master-input" value={lineForm.weight} onChange={e => setLineForm({...lineForm, weight: e.target.value})} />
              </label>
              <label className="master-field">CBM Sum
                <input className="io-date-input master-input" value={lineForm.cbmSum} onChange={e => setLineForm({...lineForm, cbmSum: e.target.value})} />
              </label>
              <label className="master-field">CBM (Unit)
                <input className="io-date-input master-input" value={lineForm.cbm} onChange={e => setLineForm({...lineForm, cbm: e.target.value})} />
              </label>
              <label className="master-field">Boxes Sum
                <input className="io-date-input master-input" value={lineForm.boxesSum} onChange={e => setLineForm({...lineForm, boxesSum: e.target.value})} />
              </label>
              <label className="master-field">Carton PCS
                <input className="io-date-input master-input" value={lineForm.cartonPcs} onChange={e => setLineForm({...lineForm, cartonPcs: e.target.value})} />
              </label>
              <label className="master-field">Pieces Sum
                <input className="io-date-input master-input" value={lineForm.piecesSum} onChange={e => setLineForm({...lineForm, piecesSum: e.target.value})} />
              </label>
              <label className="master-field">Unit Price
                <input className="io-date-input master-input" value={lineForm.unitPrice} onChange={e => setLineForm({...lineForm, unitPrice: e.target.value})} />
              </label>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 15, borderTop: "1px solid #e5e7eb" }}>
              <button type="button" className="io-btn" onClick={() => setIsLineEditOpen(false)}>إلغاء</button>
              <button type="submit" className="io-btn-primary">حفظ السطر</button>
            </div>
          </form>
        </div>
      )}

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
          طباعة
          <br />
          عربي
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
