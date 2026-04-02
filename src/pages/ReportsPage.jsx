import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { formatIsoToDisplay, parseDisplayToIso } from "../lib/dates.js";
import "../App.css";

const REPORT_TABS = [
  { id: "cust", label: "One Coustomer/supplier Move" },
  { id: "item", label: "one Item Move" },
  { id: "mat-inv", label: "Material inventory" },
  { id: "all-moves", label: "All Materials Moves" },
  { id: "cont-inv", label: "Containers inventory" },
  { id: "cont-sale", label: "Containers In sale/Invoice" },
];

function stableRowKey(tab, r) {
  return `${tab}\u001f${String(r.containerNo ?? "")}\u001f${String(r.policyNo ?? "")}\u001f${String(r.id)}`;
}

function csvEscape(s) {
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function mapReportRow(r) {
  return {
    id: r.id,
    policyNo: r.policyNo ?? "",
    containerNo: r.containerNo ?? "",
    received: Boolean(r.received),
    shipDate: r.shipDate ? formatIsoToDisplay(r.shipDate) : "",
    arrivalDate: r.arrivalDate ? formatIsoToDisplay(r.arrivalDate) : "",
    release: r.release ?? "",
    country: r.country ?? "",
    axis: r.axis ?? "",
    receiver: r.receiver ?? "",
    receiverNo: r.receiverNo ?? "",
    cartons: r.cartons ?? "",
    weight: r.weight != null ? String(r.weight) : "",
    contents: r.contents ?? "",
    clearanceCo: r.clearanceCo ?? "",
    profit:
      typeof r.profit === "number"
        ? r.profit.toFixed(4)
        : String(r.profit ?? ""),
    selected: Boolean(r.selected),
  };
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("cont-inv");
  const [status, setStatus] = useState("all");
  const [containerNo, setContainerNo] = useState("");
  const [dateFrom, setDateFrom] = useState("30/01/2026");
  const [dateTo, setDateTo] = useState("30/01/2026");
  const [releaseExport, setReleaseExport] = useState(false);
  const [receivingCompany, setReceivingCompany] = useState("");
  const [fromNo, setFromNo] = useState("");
  const [toNo, setToNo] = useState("");
  const [rows, setRows] = useState([]);
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
  const [profitPrint, setProfitPrint] = useState("show");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [metaProfit, setMetaProfit] = useState(null);
  const [reportMetaMessage, setReportMetaMessage] = useState("");

  useEffect(() => {
    setHiddenKeys(new Set());
  }, [activeTab]);

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    setReportError("");
    try {
      const q = { tab: activeTab, status };
      if (containerNo) q.containerNo = containerNo;
      const df = parseDisplayToIso(dateFrom);
      const dt = parseDisplayToIso(dateTo);
      if (df) q.dateFrom = df;
      if (dt) q.dateTo = dt;
      if (receivingCompany) q.receivingCompany = receivingCompany;
      if (fromNo) q.fromNo = fromNo;
      if (toNo) q.toNo = toNo;
      if (releaseExport) q.releaseExport = "true";
      const data = await api.get("/reports/run", q);
      setRows((data.rows ?? []).map(mapReportRow));
      setHiddenKeys(new Set());
      setMetaProfit(data.meta?.totalProfit != null ? Number(data.meta.totalProfit) : null);
      const m = data.meta?.message;
      setReportMetaMessage(typeof m === "string" ? m : "");
      if (!m && (data.rows ?? []).length === 0) {
        setReportMetaMessage(
          "لا صفوف ضمن التقرير الحالي (جرّب توسيع المرشحات أو تحقق من وجود بيانات في النظام).",
        );
      }
    } catch (e) {
      setReportError(e.message);
      setRows([]);
      setMetaProfit(null);
      setReportMetaMessage("");
    } finally {
      setReportLoading(false);
    }
  }, [
    activeTab,
    status,
    containerNo,
    dateFrom,
    dateTo,
    releaseExport,
    receivingCompany,
    fromNo,
    toNo,
  ]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => !hiddenKeys.has(stableRowKey(activeTab, r)));
  }, [rows, hiddenKeys, activeTab]);

  const footerProfitSum = useMemo(() => {
    const vis = visibleRows.reduce((s, r) => s + (parseFloat(r.profit) || 0), 0);
    if (hiddenKeys.size === 0 && metaProfit != null) return metaProfit.toFixed(4);
    return vis.toFixed(4);
  }, [visibleRows, hiddenKeys.size, metaProfit]);

  const hideSelectedRows = () => {
    const keys = visibleRows.filter((r) => r.selected).map((r) => stableRowKey(activeTab, r));
    if (!keys.length) return;
    setHiddenKeys((prev) => new Set([...prev, ...keys]));
  };

  const showAllRows = () => setHiddenKeys(new Set());

  const invertSelectionVisible = () => {
    const visKeys = new Set(visibleRows.map((r) => stableRowKey(activeTab, r)));
    setRows((prev) =>
      prev.map((r) => {
        const k = stableRowKey(activeTab, r);
        if (!visKeys.has(k)) return r;
        return { ...r, selected: !r.selected };
      }),
    );
  };

  const selectAllVisible = () => {
    const visKeys = new Set(visibleRows.map((r) => stableRowKey(activeTab, r)));
    setRows((prev) =>
      prev.map((r) => (visKeys.has(stableRowKey(activeTab, r)) ? { ...r, selected: true } : r)),
    );
  };

  const toggleRowSelect = (id) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)),
    );
  };

  const toggleReceivedLocal = (id) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, received: !r.received } : r)),
    );
  };

  const goEditSelectedContainer = () => {
    const picked = visibleRows.filter((r) => r.selected && String(r.containerNo ?? "").trim());
    if (!picked.length) {
      window.alert("حدّد صفاً واحداً على الأقل يحتوي رقم حاوية، ثم اضغط «تعديل».");
      return;
    }
    const no = String(picked[0].containerNo).trim();
    sessionStorage.setItem("reportsJumpContainerNo", no);
    window.dispatchEvent(new CustomEvent("app:set-page", { detail: { page: "list" } }));
  };

  const exportExcelCsv = () => {
    if (!visibleRows.length) {
      window.alert("لا صفوف ظاهرة للتصدير.");
      return;
    }
    const headers = [
      "اختيار",
      "ربح الحاوية",
      "شركة التخليص",
      "المحتويات",
      "الوزن",
      "عدد الكارتون",
      "رقم المستلم",
      "المستلم",
      "المحور",
      "البلد المصدر",
      "اطلاق الحاويات",
      "تاريخ الوصول",
      "تاريخ الشحن",
      "حاوية مستلمة",
      "رقم الحاوية",
      "رقم البوليصة",
      "ت",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    for (const r of visibleRows) {
      lines.push(
        [
          r.selected ? "1" : "",
          r.profit,
          r.clearanceCo,
          r.contents,
          r.weight,
          r.cartons,
          r.receiverNo,
          r.receiver,
          r.axis,
          r.country,
          r.release,
          r.arrivalDate,
          r.shipDate,
          r.received ? "1" : "",
          r.containerNo,
          r.policyNo,
          String(r.id),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    const safeTab = String(activeTab).replace(/[^a-z0-9_-]/gi, "_");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${safeTab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printReport = () => window.print();

  const tableEmptyMessage =
    rows.length === 0
      ? "لا بيانات في الجدول — اضغط «Run Report» أو أنشئ بيانات في الحاويات/الفواتير."
      : "جميع الصفوف مخفية — استخدم «اظهار حاويات» لإظهار الجدول.";

  const pageClass =
    profitPrint === "hide" ? "reports-page reports-print-hide-profit" : "reports-page";

  return (
    <div className={pageClass} dir="rtl">
      <div className="reports-window-title">Reports — التقارير</div>
      {reportError ? (
        <div style={{ margin: "6px 10px", padding: "8px", background: "#ffd0d0", fontSize: "12px" }}>
          {reportError}
        </div>
      ) : null}
      {reportLoading ? (
        <div style={{ margin: "4px 10px", fontSize: "12px" }}>جاري تحميل التقرير…</div>
      ) : null}
      {reportMetaMessage ? (
        <div
          style={{
            margin: "6px 10px",
            padding: "8px",
            background: "#fff8e1",
            border: "1px solid #e0c96a",
            fontSize: "12px",
          }}
        >
          {reportMetaMessage}
        </div>
      ) : null}

      <div className="reports-tabs">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`reports-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="reports-filters">
        <fieldset className="reports-fieldset status-fieldset">
          <legend>حالة الحاوية</legend>
          <label className="reports-radio">
            <input
              type="radio"
              name="cstatus"
              checked={status === "closed"}
              onChange={() => setStatus("closed")}
            />
            مغلقة
          </label>
          <label className="reports-radio">
            <input
              type="radio"
              name="cstatus"
              checked={status === "received"}
              onChange={() => setStatus("received")}
            />
            مستلمة
          </label>
          <label className="reports-radio">
            <input
              type="radio"
              name="cstatus"
              checked={status === "all"}
              onChange={() => setStatus("all")}
            />
            جميع الحاويات
          </label>
        </fieldset>

        <div className="reports-filters-mid">
          <div className="reports-filter-row">
            <span className="reports-lbl">رقم الحاوية</span>
            <input
              type="text"
              className="reports-input"
              value={containerNo}
              onChange={(e) => setContainerNo(e.target.value)}
            />
            <span className="reports-lbl">تاريخ الوصول من</span>
            <input
              type="text"
              className="reports-input reports-input-date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="reports-lbl">الى تاريخ</span>
            <input
              type="text"
              className="reports-input reports-input-date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <label className="reports-chk">
              <input
                type="checkbox"
                checked={releaseExport}
                onChange={(e) => setReleaseExport(e.target.checked)}
              />
              اطلاق الحاويات صادر
            </label>
          </div>
          <div className="reports-filter-row">
            <span className="reports-lbl wide">الشركة المستلمة</span>
            <input
              type="text"
              className="reports-input flex-grow"
              value={receivingCompany}
              onChange={(e) => setReceivingCompany(e.target.value)}
            />
            <span className="reports-lbl">من ت</span>
            <input
              type="text"
              className="reports-input reports-input-num"
              value={fromNo}
              onChange={(e) => setFromNo(e.target.value)}
            />
            <span className="reports-lbl">الى ت</span>
            <input
              type="text"
              className="reports-input reports-input-num"
              value={toNo}
              onChange={(e) => setToNo(e.target.value)}
            />
          </div>
        </div>

        <div className="reports-filter-actions">
          <button type="button" className="reports-btn-green" onClick={hideSelectedRows}>
            اخفاء حاويات
          </button>
          <button type="button" className="reports-btn-green" onClick={showAllRows}>
            اظهار حاويات
          </button>
          <button
            type="button"
            className="reports-btn-green reports-btn-toggle"
            onClick={invertSelectionVisible}
            title="عكس تحديد الصفوف الظاهرة"
          >
            ⇄
          </button>
        </div>
      </div>

      <div className="reports-grid-wrap">
        <div className="reports-side-actions">
          <button type="button" className="reports-fab reports-fab-edit" onClick={goEditSelectedContainer}>
            تعديل
          </button>
          <button type="button" className="reports-fab reports-fab-prep" onClick={selectAllVisible}>
            تجهيز
          </button>
        </div>
        <div className="reports-table-scroll">
          <table className="reports-table">
            <thead>
              <tr>
                <th className="reports-col-select">اختيار</th>
                <th className="reports-col-profit">ربح الحاوية</th>
                <th>شركة التخليص</th>
                <th>المحتويات</th>
                <th>الوزن</th>
                <th>عدد الكارتون</th>
                <th>رقم المستلم</th>
                <th>المستلم</th>
                <th>المحور</th>
                <th>البلد المصدر</th>
                <th>اطلاق الحاويات</th>
                <th>تاريخ الوصول</th>
                <th>تاريخ الشحن</th>
                <th>حاوية مستلمة</th>
                <th>رقم الحاوية</th>
                <th>رقم البوليصة</th>
                <th>ت</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: "center", padding: "14px", fontSize: "13px" }}>
                    {tableEmptyMessage}
                  </td>
                </tr>
              ) : null}
              {visibleRows.map((r) => (
                <tr key={stableRowKey(activeTab, r)}>
                  <td className="reports-col-select">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleRowSelect(r.id)}
                    />
                  </td>
                  <td className="reports-col-profit">{r.profit}</td>
                  <td className="cell-rtl">{r.clearanceCo}</td>
                  <td className="cell-rtl narrow">{r.contents}</td>
                  <td>{r.weight}</td>
                  <td>{r.cartons}</td>
                  <td dir="ltr">{r.receiverNo}</td>
                  <td className="cell-rtl">{r.receiver}</td>
                  <td className="cell-rtl">{r.axis}</td>
                  <td className="cell-rtl">{r.country}</td>
                  <td>{r.release}</td>
                  <td>{r.arrivalDate}</td>
                  <td>{r.shipDate}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.received}
                      onChange={() => toggleReceivedLocal(r.id)}
                      title="تعديل محلي للعرض فقط (لا يُحفظ في الخادم)"
                    />
                  </td>
                  <td dir="ltr">{r.containerNo}</td>
                  <td dir="ltr">{r.policyNo}</td>
                  <td>{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reports-footer">
        <div className="reports-footer-left">
          <div className="reports-stat">
            <span className="reports-stat-lbl">عدد الصفوف</span>
            <input
              type="text"
              className="reports-stat-input"
              readOnly
              value={String(visibleRows.length)}
            />
          </div>
          <div className="reports-stat">
            <span className="reports-stat-lbl">مجموع الارباح</span>
            <input
              type="text"
              className="reports-stat-input"
              readOnly
              value={footerProfitSum}
            />
          </div>
        </div>

        <div className="reports-footer-center">
          <button type="button" className="reports-btn-run" onClick={() => fetchReport()}>
            Run Report
          </button>
          <button type="button" className="reports-btn-preview" onClick={printReport}>
            Print Preview
          </button>
          <button type="button" className="reports-btn-excel" onClick={exportExcelCsv}>
            <span className="excel-icon">X</span>
            Excel
          </button>
        </div>

        <fieldset className="reports-print-box">
          <legend>خيارات طباعة ربح الحاوية</legend>
          <label className="reports-radio">
            <input
              type="radio"
              name="pprofit"
              checked={profitPrint === "show"}
              onChange={() => setProfitPrint("show")}
            />
            اظهار
          </label>
          <label className="reports-radio">
            <input
              type="radio"
              name="pprofit"
              checked={profitPrint === "hide"}
              onChange={() => setProfitPrint("hide")}
            />
            اخفاء
          </label>
        </fieldset>
      </div>
    </div>
  );
}
