import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { formatIsoToDisplay, toApiDateTime } from "../lib/dates.js";
import {
  downloadTextFile,
  escapeCsv,
  MASTERS_REFRESH_EVENT,
  navigateAppPage,
  printRootWithLocale,
  printWithBanner,
} from "../lib/uiActions.js";
import "../App.css";

function str(v) {
  if (v == null || v === "") return "";
  return typeof v === "number" ? String(v) : String(v);
}

function mapLineItem(line) {
  return {
    id: line.id,
    realPrice: str(line.realPrice),
    pieceTransport: str(line.pieceTransport),
    weightSum: str(line.weightSum),
    weight: str(line.weight),
    cbmSum: str(line.cbmSum),
    cbm: str(line.cbm),
    priceToCostumerSum: str(line.priceToCustomerSum),
    priceToCostumer: str(line.priceToCustomer),
    priceToCustomerVal: str(line.priceToCustomer ?? ""),
    boxes: str(line.boxes ?? ""),
    pices: str(line.pieces),
    byPriceSum: str(line.byPriceSum),
    cartonPcs: str(line.cartonPcs),
    byPrice: str(line.byPrice),
    itemName: line.itemName ?? "",
    itemNo: line.itemNo ?? "",
    seq: line.seq,
    hasItem: Boolean(line.hasItem),
  };
}

export default function ContainerListPage() {
  const [list, setList] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [clearanceParties, setClearanceParties] = useState([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedCostId, setSelectedCostId] = useState("");
  const pageRootRef = useRef(null);
  const topBarRef = useRef(null);
  const lineTableRef = useRef(null);
  const costSectionRef = useRef(null);

  const reloadDetail = useCallback(async (id) => {
    if (!id) return;
    const [d, t] = await Promise.all([api.get(`/containers/${id}`), api.get(`/containers/${id}/totals`)]);
    setDetail(d);
    setTotals(t);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/containers", { page: 1, pageSize: 100 });
      const items = data.items ?? [];
      setList(items);
      setSelectedId((prev) => {
        if (prev && items.some((x) => x.id === prev)) return prev;
        return items[0]?.id ?? "";
      });
    } catch (e) {
      setError(e.message);
      setList([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const jump = sessionStorage.getItem("reportsJumpContainerNo")?.trim();
    if (!jump) return;
    if (loading) return;
    if (!list.length) {
      sessionStorage.removeItem("reportsJumpContainerNo");
      return;
    }
    const match = list.find((x) => String(x.containerNo ?? "").trim() === jump);
    if (match) setSelectedId(match.id);
    sessionStorage.removeItem("reportsJumpContainerNo");
  }, [list, loading]);

  const loadParties = useCallback(async () => {
    try {
      const [cust, clr] = await Promise.all([
        api.get("/parties", { type: "CUSTOMER", page: 1, pageSize: 500 }),
        api.get("/parties", { type: "CLEARANCE", page: 1, pageSize: 500 }),
      ]);
      setCustomers(cust.items ?? []);
      setClearanceParties(clr.items ?? []);
    } catch {
      setCustomers([]);
      setClearanceParties([]);
    }
  }, []);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e.detail?.scope;
      if (scope === "customers" || scope === "all") loadParties();
    };
    window.addEventListener(MASTERS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MASTERS_REFRESH_EVENT, onRefresh);
  }, [loadParties]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setTotals(null);
      setEditing(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await reloadDetail(selectedId);
        if (!cancelled) setError("");
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, reloadDetail]);

  useEffect(() => {
    setEditing(false);
    setSelectedLineId("");
  }, [selectedId]);

  const tableData = useMemo(() => (detail?.lineItems ?? []).map(mapLineItem), [detail]);

  const agg = totals?.lineAggregates;
  const coastsSum = totals?.coastsSum != null ? str(totals.coastsSum) : "";
  const priceToCust = agg?.priceToCustomerSum != null ? str(agg.priceToCustomerSum) : "";
  const byPriceAgg = agg?.byPriceSum != null ? str(agg.byPriceSum) : "";
  const diff =
    totals?.difference != null && !Number.isNaN(Number(totals.difference)) ? str(totals.difference) : "";

  const patchField = async (partial) => {
    if (!selectedId) return;
    setBusy("");
    try {
      await api.patch(`/containers/${selectedId}`, partial);
      await reloadDetail(selectedId);
      await loadList();
    } catch (e) {
      setError(e.message);
    }
  };

  const onSaveHeader = async (e) => {
    e.preventDefault();
    const formEl = document.getElementById(formId);
    if (!formEl) return;
    const fd = new FormData(formEl);
    const isLoadedEl = formEl.querySelector('input[name="isLoaded"]');
    const documentDate = toApiDateTime(String(fd.get("documentDate") || ""));
    const arriveDate = toApiDateTime(String(fd.get("arriveDate") || ""));
    await patchField({
      containerNo: String(fd.get("containerNo") || "").trim() || undefined,
      officeCommissionPercent: fd.get("officeCommissionPercent") || undefined,
      cbmTransportPrice: fd.get("cbmTransportPrice") || undefined,
      chinaExchangeRate: fd.get("chinaExchangeRate") || undefined,
      status: fd.get("status") || undefined,
      telexNo: fd.get("telexNo") || null,
      weightTotal: fd.get("weightTotal") || undefined,
      documentDate: documentDate ?? null,
      arriveDate: arriveDate ?? null,
      isLoaded: Boolean(isLoadedEl?.checked),
      customerId: fd.get("customerId") || null,
      clearanceCompanyId: fd.get("clearanceCompanyId") || null,
      shipperText: fd.get("shipperText") || null,
      sourceCountry: fd.get("sourceCountry") || null,
      centralPoint: fd.get("centralPoint") || null,
      notes: fd.get("notes") || null,
      contents: fd.get("contents") || null,
    });
    setEditing(false);
  };

  const onNew = async () => {
    const no = window.prompt("رقم الحاوية الجديدة؟");
    if (!no || !no.trim()) return;
    setBusy("جاري الإنشاء…");
    try {
      const c = await api.post("/containers", { containerNo: no.trim() });
      await loadList();
      setSelectedId(c.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const onDelete = async () => {
    if (!selectedId || !window.confirm("حذف الحاوية المحددة؟")) return;
    try {
      await api.delete(`/containers/${selectedId}`);
      await loadList();
    } catch (e) {
      setError(e.message);
    }
  };

  const onAddLine = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/containers/${selectedId}/items`, { itemName: "سطر جديد" });
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onEditLine = async () => {
    if (!selectedId || !selectedLineId) return;
    const current = (detail?.lineItems ?? []).find((x) => x.id === selectedLineId);
    if (!current) return;
    const itemName = window.prompt("اسم المادة", current.itemName ?? "");
    if (itemName == null) return;
    const itemNo = window.prompt("رقم المادة", current.itemNo ?? "");
    if (itemNo == null) return;
    const boxes = window.prompt("عدد الكراتين", str(current.boxes ?? ""));
    if (boxes == null) return;
    const pieces = window.prompt("عدد القطع", str(current.pieces ?? ""));
    if (pieces == null) return;
    try {
      await api.patch(`/containers/${selectedId}/items/${selectedLineId}`, {
        itemName,
        itemNo,
        boxes: Number(boxes) || 0,
        pieces: Number(pieces) || 0,
      });
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onDeleteLine = async () => {
    if (!selectedId || !selectedLineId || !window.confirm("حذف سطر المادة؟")) return;
    try {
      await api.delete(`/containers/${selectedId}/items/${selectedLineId}`);
      setSelectedLineId("");
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onDeleteLineById = async (lineId) => {
    if (!selectedId || !lineId || !window.confirm("حذف سطر المادة؟")) return;
    try {
      await api.delete(`/containers/${selectedId}/items/${lineId}`);
      if (selectedLineId === lineId) setSelectedLineId("");
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onQuickEditLine = async (lineId) => {
    if (!lineId) return;
    setSelectedLineId(lineId);
    await onEditLine();
  };

  const onAddCost = async () => {
    if (!selectedId) return;
    const label = window.prompt("وصف التكلفة (اختياري)") ?? "";
    const amount = window.prompt("المبلغ؟", "0");
    if (amount == null) return;
    try {
      await api.post(`/containers/${selectedId}/cost-lines`, { label: label || null, amount: Number(amount) || 0 });
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onDeleteCost = async (costId) => {
    if (!selectedId || !costId || !window.confirm("حذف هذا السطر من التكاليف؟")) return;
    try {
      await api.delete(`/containers/${selectedId}/cost-lines/${costId}`);
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onEditCost = async () => {
    if (!selectedId || !selectedCostId) return;
    const current = (detail?.costLines ?? []).find((x) => x.id === selectedCostId);
    if (!current) return;
    const label = window.prompt("الوصف", current.label ?? "");
    if (label == null) return;
    const amount = window.prompt("المبلغ", str(current.amount));
    if (amount == null) return;
    const description = window.prompt("ملاحظات", current.description ?? "");
    if (description == null) return;
    try {
      await api.patch(`/containers/${selectedId}/cost-lines/${selectedCostId}`, {
        label,
        amount: Number(amount) || 0,
        description,
      });
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onAddAttachment = async () => {
    if (!selectedId) return;
    const fileName = window.prompt("اسم الملف");
    if (!fileName) return;
    const fileUrl = window.prompt("رابط/مسار الملف");
    if (!fileUrl) return;
    const kind = window.prompt("النوع (اختياري)") ?? "";
    try {
      await api.post(`/containers/${selectedId}/attachments`, { fileName, fileUrl, kind: kind || null });
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const onDeleteAttachment = async (attId) => {
    if (!selectedId || !attId || !window.confirm("حذف المرفق؟")) return;
    try {
      await api.delete(`/containers/${selectedId}/attachments/${attId}`);
      await reloadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  const formId = "container-header-form";

  const scrollTop = () => topBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollLineTable = () => lineTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollCosts = () => costSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const goLatestContainer = () => {
    const id = list[0]?.id;
    if (id) setSelectedId(id);
    else window.alert("لا توجد حاويات.");
  };

  const showRecentContainers = () => {
    if (!list.length) {
      window.alert("لا توجد حاويات.");
      return;
    }
    const lines = list.slice(0, 20).map((c, i) => `${i + 1}. ${c.containerNo}`);
    window.alert(`آخر الحاويات المعدّلة:\n\n${lines.join("\n")}`);
  };

  const reloadCurrentContainer = () => selectedId && reloadDetail(selectedId);

  const exportContainerCsv = () => {
    if (!detail) {
      window.alert("اختر حاوية أولاً.");
      return;
    }
    const meta = [
      ["containerNo", detail.containerNo ?? ""],
      ["customer", detail.customer?.name ?? ""],
      ["clearance", detail.clearanceCompany?.name ?? ""],
      ["notes", detail.notes ?? ""],
    ]
      .map((r) => r.map(escapeCsv).join(","))
      .join("\n");
    const h = [
      "seq",
      "itemNo",
      "itemName",
      "realPrice",
      "pieceTransport",
      "weightSum",
      "weight",
      "cbmSum",
      "cbm",
      "priceToCustomerSum",
      "priceToCustomer",
      "boxes",
      "pieces",
      "byPriceSum",
      "cartonPcs",
      "byPrice",
    ];
    const rows = (detail.lineItems ?? []).map((li) =>
      [
        li.seq,
        li.itemNo,
        li.itemName,
        li.realPrice,
        li.pieceTransport,
        li.weightSum,
        li.weight,
        li.cbmSum,
        li.cbm,
        li.priceToCustomerSum,
        li.priceToCustomer,
        li.boxes,
        li.pieces,
        li.byPriceSum,
        li.cartonPcs,
        li.byPrice,
      ].map((c) => escapeCsv(str(c))),
    );
    const head = h.map(escapeCsv).join(",");
    const body = rows.map((r) => r.join(",")).join("\n");
    downloadTextFile(`container-${detail.containerNo ?? "export"}.csv`, `${meta}\n\n${head}\n${body}`);
  };

  const openPurchaseForContainer = () => {
    const cn = detail?.containerNo?.trim();
    if (cn) sessionStorage.setItem("purchaseVouchersJumpContainerNo", cn);
    navigateAppPage("iv");
  };

  const openSaleForContainer = () => {
    const cn = detail?.containerNo?.trim();
    if (cn) sessionStorage.setItem("saleVouchersJumpContainerNo", cn);
    navigateAppPage("is");
  };

  return (
    <div className="container-page" ref={pageRootRef}>
      {error ? (
        <div className="alert-error" style={{ margin: "6px" }}>
          {error}
        </div>
      ) : null}
      {busy ? (
        <div style={{ margin: "6px", fontSize: 12 }}>{busy}</div>
      ) : null}
      {loading && !detail ? <div style={{ margin: "6px" }}>جاري تحميل الحاويات…</div> : null}

      <div className="top-bar" ref={topBarRef}>
        <button type="button" className="btn-tab active" onClick={scrollTop}>
          Voucher Containers
        </button>
        <button type="button" className="btn-tab" onClick={scrollLineTable}>
          Details
        </button>
        <button type="button" className="btn-refresh" onClick={loadList}>
          Refresh exchange rate
        </button>
      </div>

      <form id={formId} onSubmit={onSaveHeader}>
        <div className="form-row">
          <button type="button" className="btn-green-sm" onClick={() => setEditing((e) => !e)}>
            {editing ? "إلغاء التعديل" : "تعديل"}
          </button>
          <span className="label-blk">اختر الحاوية</span>
          <select
            className="select-sm"
            style={{ minWidth: "180px" }}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {list.length === 0 ? (
              <option value="">— لا توجد حاويات —</option>
            ) : (
              list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.containerNo}
                </option>
              ))
            )}
          </select>
          <span className="label-blk">%</span>
          <input
            type="text"
            name="officeCommissionPercent"
            className="input-field w30"
            readOnly={!editing}
            defaultValue={str(detail?.officeCommissionPercent ?? "0")}
            key={`oc-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">office commossion</span>
          <input
            type="text"
            name="cbmTransportPrice"
            className="input-field w50"
            readOnly={!editing}
            defaultValue={str(detail?.cbmTransportPrice ?? "150")}
            key={`cbm-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">cbm transport price</span>
          <input type="text" className="input-field w70" value={str(detail?.cartonsTotal ?? "")} readOnly />
          <div className="spacer" />
          <input
            type="text"
            name="chinaExchangeRate"
            className="input-field exchange-input"
            readOnly={!editing}
            defaultValue={str(detail?.chinaExchangeRate ?? "6.8")}
            key={`cer-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-red">china exchange rate</span>
          <input
            type="text"
            name="documentDate"
            className="input-field w80"
            readOnly={!editing}
            placeholder="dd/mm/yyyy"
            defaultValue={formatIsoToDisplay(detail?.documentDate) || ""}
            key={`dd-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">date</span>
          <span className="label-green-bg">تعديل الشارة حاوية محملة</span>
          <label className="chk-label">
            <input type="checkbox" name="isLoaded" defaultChecked={Boolean(detail?.isLoaded)} disabled={!editing} />
            <span>حاوية محملة</span>
          </label>
          <div className="no-group">
            <input type="text" className="input-green-box" value={detail?.containerNo?.slice(-3) ?? ""} readOnly />
            <div className="no-stack">
              {list.slice(0, 3).map((c) => (
                <span key={c.id} className="gbox">
                  {c.containerNo?.slice(-3) ?? c.id.slice(0, 3)}
                </span>
              ))}
            </div>
          </div>
          <span className="label-blk">No</span>
          <span className="label-red">رمزي</span>
          <span className="label-red">Currency</span>
          <select
            name="status"
            className="select-sm"
            disabled={!editing}
            defaultValue={detail?.status ?? "OPEN"}
            key={`st-${selectedId}-${detail?.updatedAt}`}
          >
            <option value="OPEN">OPEN</option>
            <option value="IN_TRANSIT">IN_TRANSIT</option>
            <option value="ARRIVED">ARRIVED</option>
            <option value="CUSTOMS_CLEARED">CUSTOMS_CLEARED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <div className="form-row">
          <span className="label-blk">total weight</span>
          <input
            type="text"
            name="weightTotal"
            className="input-field w70"
            readOnly={!editing}
            defaultValue={str(detail?.weightTotal ?? "")}
            key={`wt-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">total vol</span>
          <input type="text" className="input-field w70" value={str(agg?.cbmSum ?? "")} readOnly />
          <div className="spacer" />
          <input
            type="text"
            name="arriveDate"
            className="input-field w80"
            readOnly={!editing}
            placeholder="dd/mm/yyyy"
            defaultValue={formatIsoToDisplay(detail?.arriveDate) || ""}
            key={`ad-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">arrive date</span>
        </div>

        <div className="form-row">
          <span className="label-blk">phone</span>
          <input
            type="text"
            className="input-field w100"
            value={detail?.customer?.phone ?? ""}
            readOnly
          />
          <button
            type="button"
            className="btn-vouchers"
            onClick={openPurchaseForContainer}
            title="فتح فواتير الشراء لهذه الحاوية"
          >
            vouchers
          </button>
          <span className="label-blk">costumer</span>
          <select
            name="customerId"
            className="select-sm"
            dir="rtl"
            disabled={!editing}
            defaultValue={detail?.customerId ?? ""}
            key={`cust-${selectedId}-${detail?.updatedAt}`}
          >
            <option value="">—</option>
            {customers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="spacer" />
          <span className="label-blk">clearance company</span>
          <select
            name="clearanceCompanyId"
            className="select-sm"
            dir="rtl"
            disabled={!editing}
            defaultValue={detail?.clearanceCompanyId ?? ""}
            key={`clr-${selectedId}-${detail?.updatedAt}`}
          >
            <option value="">—</option>
            {clearanceParties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <span className="label-red">Shipper</span>
          <input
            type="text"
            name="shipperText"
            className="input-field w100"
            readOnly={!editing}
            defaultValue={detail?.shipperText ?? ""}
            key={`sh-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">Telex no.</span>
          <input
            type="text"
            name="telexNo"
            className="input-field w100"
            readOnly={!editing}
            defaultValue={detail?.telexNo ?? ""}
            key={`tx-${selectedId}-${detail?.updatedAt}`}
          />
          <div className="spacer" />
          <span className="label-red">source contry</span>
          <input
            type="text"
            name="sourceCountry"
            className="select-sm"
            style={{ minWidth: 120 }}
            readOnly={!editing}
            defaultValue={detail?.sourceCountry ?? ""}
            key={`sc-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-blk">container no</span>
          <input
            type="text"
            name="containerNo"
            className="input-field w150"
            readOnly={!editing}
            defaultValue={detail?.containerNo ?? ""}
            key={`cn-${selectedId}-${detail?.updatedAt}`}
          />
        </div>

        <div className="form-row justify-end">
          <span className="label-red">Central point</span>
          <input
            type="text"
            name="centralPoint"
            className="select-sm"
            dir="rtl"
            readOnly={!editing}
            defaultValue={detail?.centralPoint ?? ""}
            key={`cp-${selectedId}-${detail?.updatedAt}`}
          />
        </div>

        <div className="form-row">
          <span className="label-red">Nots</span>
          <div className="spacer" />
          <input
            type="text"
            name="notes"
            className="input-field w300"
            dir="rtl"
            readOnly={!editing}
            defaultValue={detail?.notes ?? ""}
            key={`n-${selectedId}-${detail?.updatedAt}`}
          />
          <span className="label-red">containts</span>
          <input
            type="text"
            name="contents"
            className="input-field w300"
            dir="rtl"
            readOnly={!editing}
            defaultValue={detail?.contents ?? ""}
            key={`ct-${selectedId}-${detail?.updatedAt}`}
          />
        </div>
        {editing ? (
          <div className="form-row">
            <button type="submit" className="btn-green-sm">
              حفظ
            </button>
          </div>
        ) : null}
      </form>

      <div className="form-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn-mini-gray" onClick={onAddLine}>
          + سطر مادة
        </button>
        <button type="button" className="btn-mini-gray" onClick={onDeleteLine} disabled={!selectedLineId}>
          حذف سطر
        </button>
        <button type="button" className="btn-mini-gray" onClick={onEditLine} disabled={!selectedLineId}>
          تعديل سطر
        </button>
        <button type="button" className="btn-mini-gray" onClick={onAddCost}>
          + تكلفة
        </button>
        <button type="button" className="btn-mini-gray" onClick={onEditCost} disabled={!selectedCostId}>
          تعديل تكلفة
        </button>
        <button type="button" className="btn-mini-gray" onClick={onAddAttachment}>
          + مرفق
        </button>
      </div>

      <div className="table-wrap" ref={lineTableRef}>
        <table className="dtable">
          <thead>
            <tr>
              <th className="th-action"></th>
              <th>
                Real
                <br />
                Price
              </th>
              <th>
                piece
                <br />
                transport
                <br />
                coast
              </th>
              <th>
                weight
                <br />
                sum
              </th>
              <th>weight</th>
              <th>
                cbm
                <br />
                sum
              </th>
              <th>cbm</th>
              <th>
                Price to
                <br />
                Costumer
                <br />
                sum
              </th>
              <th>
                Price to
                <br />
                Costumer
              </th>
              <th>boxes</th>
              <th>pices</th>
              <th>by price sum</th>
              <th>
                carton
                <br />
                pcs
              </th>
              <th>by price</th>
              <th>item name</th>
              <th>
                item
                <br />
                no
              </th>
              <th>seq</th>
              <th>pic</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr>
                <td colSpan={18} style={{ textAlign: "center", padding: "12px" }}>
                  لا أسطر مواد لهذه الحاوية
                </td>
              </tr>
            ) : (
              tableData.map((row) => (
                <tr
                  key={row.id}
                  style={{ cursor: "pointer", background: selectedLineId === row.id ? "#e8f4ff" : undefined }}
                  onClick={() => setSelectedLineId(row.id)}
                >
                  <td className="td-action">
                    <button
                      type="button"
                      className="row-del"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickEditLine(row.id);
                      }}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      className="row-del"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLineById(row.id);
                      }}
                    >
                      delete
                    </button>
                    {row.hasItem && <span className="row-item">item</span>}
                  </td>
                  <td>{row.realPrice}</td>
                  <td>{row.pieceTransport}</td>
                  <td>{row.weightSum}</td>
                  <td>{row.weight}</td>
                  <td>{row.cbmSum}</td>
                  <td>{row.cbm}</td>
                  <td>{row.priceToCostumerSum}</td>
                  <td>{row.priceToCostumer}</td>
                  <td>{row.priceToCustomerVal}</td>
                  <td>{row.boxes}</td>
                  <td>{row.pices}</td>
                  <td>{row.byPriceSum}</td>
                  <td>{row.cartonPcs}</td>
                  <td>{row.byPrice}</td>
                  <td className="td-name">{row.itemName}</td>
                  <td>{row.itemNo}</td>
                  <td>{row.seq}</td>
                  <td></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="sum-row">
              <td></td>
              <td></td>
              <td>{agg ? str(agg.pieceTransportSum) : ""}</td>
              <td>{agg ? str(agg.weightSum) : ""}</td>
              <td></td>
              <td>{agg ? str(agg.cbmSum) : ""}</td>
              <td></td>
              <td></td>
              <td></td>
              <td>{agg ? str(agg.boxes) : ""}</td>
              <td>{agg ? str(agg.pieces) : ""}</td>
              <td>{agg ? str(agg.byPriceSum) : ""}</td>
              <td></td>
              <td></td>
              <td className="sum-label">Summation</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="summary-area">
        <div className="summary-box">
          <div className="srow">
            <span className="sval green-bg">{coastsSum || "0"}</span>
            <span className="slbl">coasts sum</span>
            <span className="sval2">1000</span>
          </div>
          <div className="srow">
            <span className="sval green-bg">{priceToCust || "0"}</span>
            <span className="slbl">price to customer</span>
            <span className="sval2">0</span>
          </div>
          <div className="srow">
            <span className="sval green-bg">{byPriceAgg || "0"}</span>
            <span className="slbl">by price sum</span>
            <span className="sval2">0</span>
          </div>
          <div className="srow">
            <span className="sval yellow-bg">{diff || "0"}</span>
          </div>
        </div>

        <div className="summary-costs" ref={costSectionRef}>
          {(detail?.costLines ?? []).length === 0 ? (
            <div className="cost-row">
              <span className="cost-lbl"></span>
              <span className="cost-val"></span>
              <span className="cost-desc">لا تكاليف مسجّلة</span>
            </div>
          ) : (
            detail.costLines.map((c) => (
              <div
                key={c.id}
                className="cost-row"
                style={{ background: selectedCostId === c.id ? "#eef6ff" : undefined, cursor: "pointer" }}
                onClick={() => setSelectedCostId(c.id)}
              >
                <button type="button" className="btn-mini-gray" onClick={() => onDeleteCost(c.id)}>
                  ×
                </button>
                <span className="cost-lbl">{c.label ?? ""}</span>
                <span className="cost-val">{str(c.amount)}</span>
                <span className="cost-desc">{c.description ?? ""}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="form-row">
        <span className="label-blk">المرفقات</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(detail?.attachments ?? []).length === 0 ? (
            <span className="label-blk">لا توجد مرفقات</span>
          ) : (
            detail.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a href={a.fileUrl} target="_blank" rel="noreferrer">
                  {a.fileName}
                </a>
                <span className="label-blk">{a.kind ?? ""}</span>
                <button type="button" className="btn-mini-gray" onClick={() => onDeleteAttachment(a.id)}>
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bottom-actions">
        <button type="button" className="abtn cyan" onClick={onNew}>
          NEW
        </button>
        <button type="button" className="abtn cyan" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="abtn cyan" onClick={() => document.getElementById(formId)?.requestSubmit()}>
          Save
        </button>
        <div className="abtn-group">
          <span className="abtn-lbl">Details Type</span>
          <button type="button" className="abtn green" onClick={scrollTop}>
            Main
          </button>
          <button type="button" className="abtn green" onClick={scrollLineTable}>
            second
          </button>
        </div>
        <div className="abtn-group">
          <span className="abtn-lbl">
            Print To
            <br />
            Costumer
          </span>
          <button
            type="button"
            className="abtn green"
            onClick={() => printWithBanner(pageRootRef.current, "China / customer copy")}
          >
            china
          </button>
          <button
            type="button"
            className="abtn green"
            onClick={() => printWithBanner(pageRootRef.current, "Supplier copy")}
          >
            supplier
          </button>
        </div>
        <button type="button" className="abtn green" onClick={() => printRootWithLocale(pageRootRef.current, { dir: "ltr", lang: "en" })}>
          Print
          <br />
          All
          <br />
          Details
        </button>
        <div className="abtn-group">
          <span className="abtn-lbl">Print Language</span>
          <button type="button" className="abtn green" onClick={() => printRootWithLocale(pageRootRef.current, { dir: "rtl", lang: "ar" })}>
            Arabic
          </button>
          <button type="button" className="abtn green" onClick={() => printRootWithLocale(pageRootRef.current, { dir: "ltr", lang: "en" })}>
            En
          </button>
        </div>
        <button type="button" className="abtn cyan" onClick={() => printRootWithLocale(pageRootRef.current, { dir: "ltr", lang: "en" })}>
          Print
        </button>
        <button type="button" className="abtn cyan" onClick={goLatestContainer}>
          Last
          <br />
          Voucher
        </button>
        <button type="button" className="abtn cyan" onClick={showRecentContainers}>
          Last
          <br />
          Edited
          <br />
          Vouchers
        </button>
        <button type="button" className="abtn cyan" onClick={reloadCurrentContainer}>
          Re Load Last
          <br />
          Voucher
        </button>
        <button
          type="button"
          className="abtn red"
          onClick={() => {
            setEditing(false);
            setError("");
            setSelectedLineId("");
          }}
        >
          X
        </button>
        <div className="abtn-group">
          <span className="abtn-lbl">Details Type</span>
          <button type="button" className="abtn green" onClick={scrollTop}>
            Main
          </button>
          <button type="button" className="abtn green" onClick={scrollCosts}>
            second
          </button>
        </div>
        <button type="button" className="abtn green" onClick={openSaleForContainer} title="فتح البيع للزبون لهذه الحاوية">
          Coestomer
        </button>
        <button type="button" className="abtn green" onClick={openPurchaseForContainer} title="فتح مشتريات/مورد لهذه الحاوية">
          Shipping
          <br />
          supplier
        </button>
        <button type="button" className="abtn green" onClick={exportContainerCsv}>
          Export to
          <br />
          Excel
        </button>
        <button type="button" className="abtn green" onClick={() => navigateAppPage("iv")} title="فواتير الشراء">
          Direct
        </button>
        <button type="button" className="abtn green" onClick={() => navigateAppPage("is")} title="فواتير البيع">
          Direct Sale
        </button>
      </div>
    </div>
  );
}
