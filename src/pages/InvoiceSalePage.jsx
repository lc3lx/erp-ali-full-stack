import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { GlSaleVoucherPost } from "../components/GlDocumentPost.jsx";
import { DocumentStatusBadge } from "../components/erp/DocumentStatusBadge.jsx";
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
  const [catalog, setCatalog] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState("");
  const pageRootRef = useRef(null);
  const headerBlockRef = useRef(null);
  const linesBlockRef = useRef(null);
  const totalsBlockRef = useRef(null);

  const [isLineEditOpen, setIsLineEditOpen] = useState(false);
  const [lineForm, setLineForm] = useState({
    id: "", itemId: "", detail: "", itemNo: "",
    usdConvertRate: "", usdSumCol: "", usdPriceCol: "",
    cbmSumCol: "", weight: "", cbm1: "", cbm2: "",
    listQty: "", pricePerThousand: "", totalPrice: "",
    pcsInCarton: "", linePrice: ""
  });

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
        const [data, cont, cust, st, catRes] = await Promise.all([
          api.get("/invoice-sale", { page: 1, pageSize: 100 }),
          api.get("/containers", { page: 1, pageSize: 200 }),
          api.get("/parties", { type: "CUSTOMER", page: 1, pageSize: 300 }),
          api.get("/stores"),
          api.get("/items/lookup"),
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

  const exchangeRate = str(detail?.exchangeRate ?? "6.8");
  const date = detail?.voucherDate ? formatIsoToDisplay(detail.voucherDate) : "";
  const voucherNo = detail?.voucherNo ?? "";
  const currency = detail?.currency ?? "دولار";
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
    const comment = window.prompt("سبب الرفض (اختياري)") ?? "";
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
        customerId: fd.get("customerId") || undefined,
        storeId: fd.get("storeId") || null,
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
      window.alert("تحتاج حاوية وزبون على الأقل.");
      return;
    }
    const vn = window.prompt("رقم سند البيع؟", `S-${Date.now()}`);
    if (!vn || !vn.trim()) return;
    try {
      const v = await api.post("/invoice-sale", {
        voucherNo: vn.trim(),
        containerId: cid,
        customerId: custId,
        currency: "دولار",
      });
      const data = await api.get("/invoice-sale", { page: 1, pageSize: 100 });
      setList(data.items ?? []);
      setVoucherId(v.id);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDelete = async () => {
    if (!voucherId || !window.confirm("حذف سند البيع؟")) return;
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

  const openLineEditor = (isEdit = false) => {
    if (!voucherId) return;
    if (isEdit) {
      if (!selectedLineId) return;
      const row = lines.find((x) => x.id === selectedLineId);
      if (!row) return;
      setLineForm({
        id: row.id,
        itemId: row.itemId || "",
        detail: row.detail || "",
        itemNo: row.itemNo || "",
        usdConvertRate: str(row.usdConvertRate),
        usdSumCol: str(row.usdSumCol),
        usdPriceCol: str(row.usdPriceCol),
        cbmSumCol: str(row.cbmSumCol),
        weight: str(row.weight),
        cbm1: str(row.cbm1),
        cbm2: str(row.cbm2),
        listQty: str(row.listQty),
        pricePerThousand: str(row.pricePerThousand),
        totalPrice: str(row.totalPrice),
        pcsInCarton: str(row.pcsInCarton),
        linePrice: str(row.linePrice),
      });
    } else {
      setLineForm({
        id: "", itemId: "", detail: "", itemNo: "",
        usdConvertRate: "", usdSumCol: "", usdPriceCol: "",
        cbmSumCol: "", weight: "", cbm1: "", cbm2: "",
        listQty: "", pricePerThousand: "", totalPrice: "",
        pcsInCarton: "", linePrice: "",
      });
    }
    setIsLineEditOpen(true);
  };

  const saveLineForm = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        itemId: lineForm.itemId || null,
        detail: lineForm.detail.trim() || null,
        itemNo: lineForm.itemNo.trim() || null,
        usdConvertRate: numOrNull(lineForm.usdConvertRate),
        usdSumCol: numOrNull(lineForm.usdSumCol),
        usdPriceCol: numOrNull(lineForm.usdPriceCol),
        cbmSumCol: numOrNull(lineForm.cbmSumCol),
        weight: numOrNull(lineForm.weight),
        cbm1: numOrNull(lineForm.cbm1),
        cbm2: numOrNull(lineForm.cbm2),
        listQty: numOrNull(lineForm.listQty),
        pricePerThousand: numOrNull(lineForm.pricePerThousand),
        totalPrice: numOrNull(lineForm.totalPrice),
        pcsInCarton: numOrNull(lineForm.pcsInCarton),
        linePrice: numOrNull(lineForm.linePrice),
      };
      if (lineForm.id) {
        await api.patch(`/invoice-sale/${voucherId}/items/${lineForm.id}`, payload);
      } else {
        await api.post(`/invoice-sale/${voucherId}/items`, payload);
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
      await api.delete(`/invoice-sale/${voucherId}/items/${selectedLineId}`);
      setSelectedLineId("");
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
    "itemId",
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
    else window.alert("لا توجد فواتير بيع.");
  };

  const showRecentVoucherList = () => {
    if (!list.length) {
      window.alert("لا توجد فواتير.");
      return;
    }
    const lines = list.slice(0, 20).map((v, i) => `${i + 1}. ${v.voucherNo} — ${v.container?.containerNo ?? "?"}`);
    window.alert(`أحدث سندات البيع:\n\n${lines.join("\n")}`);
  };

  const scrollHeader = () => headerBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollLines = () => linesBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollTotals = () => totalsBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openContainerInList = () => {
    const cn = detail?.container?.containerNo?.trim();
    if (cn) sessionStorage.setItem("reportsJumpContainerNo", cn);
    navigateAppPage("list");
  };

  return (
    <div className="is-page" dir="ltr" ref={pageRootRef}>
      {err ? <div className="alert-error" style={{ margin: 6 }}>{err}</div> : null}
      <div className="is-titleline">Sale Vouchers</div>

      <div className="is-top-wrap" ref={headerBlockRef}>
        <div className="is-top-row">
          <button type="button" className="is-btn-edit" onClick={() => setEditing((x) => !x)}>
            {editing ? "قفل" : "تعديل"}
          </button>
          <span className="is-lbl">%0</span>
          <span className="is-lbl">عمولة المكتب</span>
          <input
            className="is-small-input"
            name="officeCommission"
            form={formId}
            readOnly={!editing}
            defaultValue={str(detail?.officeCommission ?? "0")}
            key={`oc-${voucherId}-${detail?.updatedAt}`}
          />
          <span className="is-lbl">سعر نقل المتر المكعب</span>
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
          <span className="is-rate-lbl">سعر الصرف</span>
        </div>

        <form id={formId} onSubmit={onSave}>
          <div className="is-mid-row">
            <div className="is-left-cluster">
              <div className="is-balance-line">
                <span className="is-mini-title">مجموع</span>
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
                <span className="is-lbl">رقم الحاوية</span>
              </div>
              <button
                type="button"
                className="is-blue-pill"
                onClick={() =>
                  window.alert(`عملة السند: ${detail?.currency ?? "—"}\nسعر الصرف الحالي في النموذج: ${exchangeRate}`)
                }
                title="عرض العملة وسعر الصرف"
              >
                {detail?.currency ?? "العملة"}
              </button>
            </div>

            <div className="is-mini-actions">
              <button type="button" className="is-mini-act" onClick={onNew}>
                جديد
              </button>
              <button type="button" className="is-mini-act red" onClick={onDelete}>
                حذف
              </button>
            </div>

            <select
              className="is-supplier-box"
              name="customerId"
              dir="rtl"
              disabled={!editing}
              defaultValue={detail?.customerId ?? ""}
              key={`cu-${voucherId}-${detail?.updatedAt}`}
              style={{ border: "1px solid #ccc", minHeight: 36 }}
            >
              {customers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="is-lbl">الزبون</span>

            <div className="is-spacer" />

            <input
              className="is-date-input"
              name="voucherDate"
              readOnly={!editing}
              placeholder="dd/mm/yyyy"
              defaultValue={date}
              key={`vd-${voucherId}-${detail?.updatedAt}`}
            />
            <span className="is-lbl">تاريخ العامة</span>

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
            <span className="is-lbl">ت القائمة</span>

            <div className="erp-workflow-row" style={{ gridColumn: "1 / -1" }}>
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

            <select
              className="is-currency-select"
              name="currency"
              disabled={!editing}
              defaultValue={currency}
              key={`cur-${voucherId}-${detail?.updatedAt}`}
            >
              <option value="دولار">دولار</option>
              <option value="دينار">دينار</option>
            </select>
            <span className="is-lbl">العملة</span>
          </div>

          <div className="is-top-row third">
            <div className="is-spacer" />
            <select
              className="is-store-select"
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
            <span className="is-lbl">Store Targit</span>
            <input
              className="is-notes-input"
              name="notes"
              readOnly={!editing}
              defaultValue={detail?.notes ?? ""}
              key={`nt-${voucherId}-${detail?.updatedAt}`}
            />
            <span className="is-lbl">ملاحظات</span>
          </div>
          <div className="is-top-row" style={{ marginTop: 8 }}>
            <button type="submit" className="is-btn">
              حفظ السند
            </button>
            <button type="button" className="is-item-btn green" onClick={onAddLine}>
              + سطر
            </button>
            <button type="button" className="is-item-btn red" onClick={onDeleteLine} disabled={!selectedLineId}>
              حذف سطر
            </button>
            <button type="button" className="is-item-btn green" onClick={onEditLine} disabled={!selectedLineId}>
              تعديل سطر
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
                سعر تحويل
                <br />
                الدولار
              </th>
              <th>
                مجموع سعر
                <br />
                الدولار
              </th>
              <th>
                سعر
                <br />
                الدولار
              </th>
              <th>
                مجموع المتر
                <br />
                المكعب
              </th>
              <th>وزن</th>
              <th>cbm</th>
              <th>cbm</th>
              <th>
                عدد
                <br />
                القائمة
              </th>
              <th>
                سعر كل
                <br />
                الف
              </th>
              <th>مجموع سعر</th>
              <th>
                قطعة داخل
                <br />
                الكارتون
              </th>
              <th>سعر</th>
              <th>التفاصيل</th>
              <th>رقم</th>
              <th>ت</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ textAlign: "center", padding: 12 }}>
                  لا أسطر
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
                  <td className="is-arrow">▶</td>
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
                  <td>{str(r.seq)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
          <span className="is-sum-label">المحاسبة</span>
          <input className="is-sum-input yellow" value={str(detail?.accountingDebit ?? "0")} readOnly />
          <span className="is-sum-label">المحاسبة دائن/مدين</span>
        </div>
      </div>

      <div className="is-sum-bottom" ref={totalsBlockRef}>
        <div className="is-total-box">
          <div className="is-total-line">
            <input value={str(totals?.total ?? "")} readOnly />
            <span>المجموع</span>
          </div>
          <div className="is-total-line">
            <input value={str(totals?.paid ?? "")} readOnly />
            <span>المسدد</span>
          </div>
          <div className="is-total-line">
            <input value={str(totals?.remaining ?? "")} readOnly />
            <span>المجموع الباقي</span>
          </div>
          <div className="is-total-line">
            <input value={str(totals?.profit ?? "")} readOnly />
            <span>أرباح</span>
          </div>
        </div>
        <div className="is-yellow-note">بضاعة لهذا المستثمر</div>
      </div>

      {isLineEditOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999
        }} dir="rtl">
          <form className="master-form" onSubmit={saveLineForm} style={{ maxHeight: "90vh", overflowY: "auto", width: "650px", maxWidth: "95%", margin: 0, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", background: "#fff", padding: 20, borderRadius: 8 }}>
            <h3 className="master-form-title" style={{marginTop: 0, borderBottom: "1px solid #e5e7eb", paddingBottom: 10}}>{lineForm.id ? "تعديل سطر البيع" : "إضافة سطر بيع جديد"}</h3>
            
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
                       detail: it?.name || lineForm.detail, 
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

            {(() => {
              const selectedItem = lineForm.itemId ? catalog.find(x => x.id === lineForm.itemId) : null;
              const imgSrc = selectedItem?.imageUrl;
              if (!imgSrc) return null;
              return (
                <div style={{ marginBottom: 15, textAlign: "center" }}>
                  <img
                    src={imgSrc}
                    alt={selectedItem?.name || "صورة المنتج"}
                    style={{
                      maxWidth: 180, maxHeight: 140, objectFit: "contain",
                      borderRadius: 6, border: "1px solid #e5e7eb",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>صورة المنتج</div>
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 15 }}>
              <label className="master-field">التفاصيل
                <input className="io-date-input master-input" value={lineForm.detail} onChange={e => setLineForm({...lineForm, detail: e.target.value})} />
              </label>
              <label className="master-field">رقم المادة
                <input className="io-date-input master-input" value={lineForm.itemNo} onChange={e => setLineForm({...lineForm, itemNo: e.target.value})} />
              </label>
              <label className="master-field">سعر تحويل الدولار
                <input className="io-date-input master-input" value={lineForm.usdConvertRate} onChange={e => setLineForm({...lineForm, usdConvertRate: e.target.value})} />
              </label>
              <label className="master-field">مجموع سعر الدولار
                <input className="io-date-input master-input" value={lineForm.usdSumCol} onChange={e => setLineForm({...lineForm, usdSumCol: e.target.value})} />
              </label>
              <label className="master-field">سعر الدولار
                <input className="io-date-input master-input" value={lineForm.usdPriceCol} onChange={e => setLineForm({...lineForm, usdPriceCol: e.target.value})} />
              </label>
              <label className="master-field">مجموع المتر المكعب
                <input className="io-date-input master-input" value={lineForm.cbmSumCol} onChange={e => setLineForm({...lineForm, cbmSumCol: e.target.value})} />
              </label>
              <label className="master-field">وزن
                <input className="io-date-input master-input" value={lineForm.weight} onChange={e => setLineForm({...lineForm, weight: e.target.value})} />
              </label>
              <label className="master-field">CBM 1
                <input className="io-date-input master-input" value={lineForm.cbm1} onChange={e => setLineForm({...lineForm, cbm1: e.target.value})} />
              </label>
              <label className="master-field">CBM 2
                <input className="io-date-input master-input" value={lineForm.cbm2} onChange={e => setLineForm({...lineForm, cbm2: e.target.value})} />
              </label>
              <label className="master-field">عدد القائمة
                <input className="io-date-input master-input" value={lineForm.listQty} onChange={e => setLineForm({...lineForm, listQty: e.target.value})} />
              </label>
              <label className="master-field">سعر كل الف
                <input className="io-date-input master-input" value={lineForm.pricePerThousand} onChange={e => setLineForm({...lineForm, pricePerThousand: e.target.value})} />
              </label>
              <label className="master-field">مجموع السعر
                <input className="io-date-input master-input" value={lineForm.totalPrice} onChange={e => setLineForm({...lineForm, totalPrice: e.target.value})} />
              </label>
              <label className="master-field">قطعة داخل الكرتون
                <input className="io-date-input master-input" value={lineForm.pcsInCarton} onChange={e => setLineForm({...lineForm, pcsInCarton: e.target.value})} />
              </label>
              <label className="master-field">سعر
                <input className="io-date-input master-input" value={lineForm.linePrice} onChange={e => setLineForm({...lineForm, linePrice: e.target.value})} />
              </label>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 15, borderTop: "1px solid #e5e7eb" }}>
              <button type="button" className="io-btn" onClick={() => setIsLineEditOpen(false)}>إلغاء</button>
              <button type="submit" className="io-btn-primary">حفظ السطر</button>
            </div>
          </form>
        </div>
      )}

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
          طباعة
          <br />
          عربي
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
            const usePride = window.confirm("موافق = نسخة Pride\nإلغاء = نسخة Faqr");
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
