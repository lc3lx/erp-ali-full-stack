import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { printRootWithLocale } from "../lib/uiActions.js";
import "../App.css";

const DEFAULT_BODY = `نحنو نطلب منكم التكرم بالموافقة على دخول مزاد العملة وتحويل مبلغ (58,052) دولار أمريكي فقط لا غير لصالح المستفيد أدناه.

Beneficiary Name: AS PRIDE COMPANY LIMITED
A/C NO: NRA15622142010500004363
Beneficiary Bank Name: ZHEJIANG CHOUZHOU COMMERCIAL BANK CO., LTD, YIWU
SWIFTBIC: CZCBCN2X`;

export default function OfficialDocumentsPage() {
  const [docList, setDocList] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [n1, setN1] = useState("52");
  const [n2, setN2] = useState("51");
  const [n3, setN3] = useState("52");
  const [timeStr] = useState("01:33:42 ص");
  const [dateStr] = useState("08/08/2025");
  const [weekday] = useState("الجمعة");
  const [companyAddr, setCompanyAddr] = useState(
    "عنوان الشركة بغداد- بغداد الجديدة - محلة 713 زقاق 73 دار 4",
  );
  const [companyPhones, setCompanyPhones] = useState("هواتف الشركة 07800602210 - 07709999616");
  const [recipient, setRecipient] = useState("tbi المصرف العراقي للتجارة");
  const [subject, setSubject] = useState("طلب دخول مزاد العمله وتحويل حوالة");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [printAddr, setPrintAddr] = useState("pride");
  const [hideNumDate, setHideNumDate] = useState(false);
  const [printType, setPrintType] = useState("with");
  const [party1Name, setParty1Name] = useState("");
  const [party1Address, setParty1Address] = useState("");
  const [party2Name, setParty2Name] = useState("");
  const [party2Address, setParty2Address] = useState("");
  const [party3Name, setParty3Name] = useState("");
  const [party3Address, setParty3Address] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const pageRootRef = useRef(null);
  const bodyRef = useRef(null);

  const refreshList = useCallback(async () => {
    const d = await api.get("/official-documents", { page: 1, pageSize: 200 });
    setDocList(d.items ?? []);
  }, []);

  useEffect(() => {
    refreshList().catch(() => setDocList([]));
  }, [refreshList]);

  const applyDoc = (doc) => {
    if (!doc) return;
    setN1(doc.serial1 ?? "");
    setN2(doc.serial2 ?? "");
    setN3(doc.serial3 ?? "");
    setRecipient(doc.recipient ?? "");
    setSubject(doc.subject ?? "");
    setBody(doc.body ?? "");
    setPrintAddr(doc.printAddr ?? "pride");
    setPrintType(doc.printType ?? "with");
    setHideNumDate(Boolean(doc.hideNumDate));
    setParty1Name(doc.party1Name ?? "");
    setParty1Address(doc.party1Address ?? "");
    setParty2Name(doc.party2Name ?? "");
    setParty2Address(doc.party2Address ?? "");
    setParty3Name(doc.party3Name ?? "");
    setParty3Address(doc.party3Address ?? "");
  };

  const onSelectDoc = async (id) => {
    setSelectedId(id);
    if (!id) return;
    setErr("");
    try {
      const doc = await api.get(`/official-documents/${id}`);
      applyDoc(doc);
    } catch (e) {
      setErr(e.message);
    }
  };

  const payload = () => ({
    serial1: n1 || null,
    serial2: n2 || null,
    serial3: n3 || null,
    recipient: recipient || null,
    subject: subject || null,
    body,
    printAddr,
    printType,
    hideNumDate,
    party1Name: party1Name || null,
    party1Address: party1Address || null,
    party2Name: party2Name || null,
    party2Address: party2Address || null,
    party3Name: party3Name || null,
    party3Address: party3Address || null,
  });

  const onSave = async () => {
    setErr("");
    setMsg("");
    try {
      if (selectedId) {
        await api.patch(`/official-documents/${selectedId}`, payload());
        setMsg("تم التحديث");
      } else {
        const d = await api.post("/official-documents", payload());
        setSelectedId(d.id);
        setMsg("تم الحفظ");
      }
      await refreshList();
    } catch (e) {
      setErr(e.message);
    }
  };

  const onNew = () => {
    setSelectedId("");
    applyDoc({
      serial1: "52",
      serial2: "51",
      serial3: "52",
      recipient: "tbi المصرف العراقي للتجارة",
      subject: "طلب دخول مزاد العمله وتحويل حوالة",
      body: DEFAULT_BODY,
      printAddr: "pride",
      printType: "with",
      hideNumDate: false,
      party1Name: "",
      party1Address: "",
      party2Name: "",
      party2Address: "",
      party3Name: "",
      party3Address: "",
    });
    setMsg("مسودة جديدة — اضغط حفظ لإنشاء مستند");
  };

  const onDelete = async () => {
    if (!selectedId || !window.confirm("حذف المستند من الخادم؟")) return;
    setErr("");
    try {
      await api.delete(`/official-documents/${selectedId}`);
      setSelectedId("");
      onNew();
      await refreshList();
      setMsg("تم الحذف");
    } catch (e) {
      setErr(e.message);
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      /* ignore */
    }
  };

  const pasteBody = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setBody(t);
    } catch {
      /* ignore */
    }
  };

  const selectLatestSavedDoc = () => {
    const d = docList[0];
    if (d) {
      onSelectDoc(d.id);
      setMsg("تم اختيار أحدث مستند في القائمة");
    } else window.alert("لا توجد مستندات محفوظة بعد.");
  };

  const focusBodyEditor = () => {
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="od-page" dir="rtl" ref={pageRootRef}>
      {err ? (
        <div style={{ padding: 8, margin: 6, background: "#ffd0d0", fontSize: 12 }}>{err}</div>
      ) : null}
      {msg ? (
        <div style={{ padding: 8, margin: 6, background: "#d8ffd8", fontSize: 12 }}>{msg}</div>
      ) : null}
      <div className="od-title">
        Official Documents — الوثائق الرسمية
        <span style={{ fontSize: 12, marginInlineStart: 8, color: "#444" }}>
          (مسجّل في السيرفر: {docList.length})
        </span>
      </div>

      <div className="od-row" style={{ marginBottom: 8, alignItems: "center", gap: 8 }}>
        <span className="od-lbl-inline">مستند محفوظ:</span>
        <select
          className="od-input-combo"
          value={selectedId}
          onChange={(e) => onSelectDoc(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="">— مستند جديد / اختر من القائمة —</option>
          {docList.map((d) => (
            <option key={d.id} value={d.id}>
              {(d.subject || "").slice(0, 40)} ({d.id.slice(0, 8)}…)
            </option>
          ))}
        </select>
        <button type="button" className="od-btn od-btn-green" onClick={onSave}>
          حفظ / تحديث
        </button>
        <button type="button" className="od-btn od-btn-grey" onClick={onNew}>
          مسودة جديدة
        </button>
        <button type="button" className="od-btn od-btn-red" onClick={onDelete} disabled={!selectedId}>
          حذف
        </button>
      </div>

      <div className="od-header">
        <div className="od-header-right">
          <input
            type="text"
            className="od-input-long"
            value={companyAddr}
            onChange={(e) => setCompanyAddr(e.target.value)}
          />
          <input
            type="text"
            className="od-input-long"
            value={companyPhones}
            onChange={(e) => setCompanyPhones(e.target.value)}
          />
        </div>

        <div className="od-header-left">
          <div className="od-numbers-wrap">
            <div className="od-numbers">
              <input type="text" className="od-num-input" value={n1} onChange={(e) => setN1(e.target.value)} />
              <input type="text" className="od-num-input" value={n2} onChange={(e) => setN2(e.target.value)} />
              <input type="text" className="od-num-input od-num-active" value={n3} onChange={(e) => setN3(e.target.value)} />
            </div>
            <span className="od-lbl-count">العدد</span>
          </div>

          <div className="od-datetime-block">
            <div className="od-time-date-row">
              <span className="od-lbl">تاريخها</span>
              <input type="text" className="od-box-sm" readOnly value={dateStr} />
              <input type="text" className="od-box-sm" readOnly value={timeStr} />
            </div>
            <div className="od-weekday">{weekday}</div>
          </div>
        </div>
      </div>

      <div className="od-row">
        <span className="od-lbl-inline">الى /</span>
        <input
          type="text"
          className="od-input-combo"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          list="od-recipient-list"
        />
        <datalist id="od-recipient-list">
          <option value="tbi المصرف العراقي للتجارة" />
        </datalist>
      </div>

      <div className="od-row">
        <span className="od-lbl-inline">م /</span>
        <input type="text" className="od-input-combo" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="od-salutation">تحية طيبة ...</div>

      <div className="od-body-row">
        <div className="od-side-btns">
          <button type="button" className="od-fab od-fab-copy" onClick={copyBody}>
            Copy
          </button>
          <button type="button" className="od-fab od-fab-paste" onClick={pasteBody}>
            Paste
          </button>
        </div>
        <textarea
          ref={bodyRef}
          className="od-body-text"
          dir="auto"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="od-parties">
        <div className="od-party-col">
          <div className="od-party-row">
            <span className="od-party-lbl">عنوان الطرف الثالث</span>
            <input type="text" className="od-party-txt" value={party3Address} onChange={(e) => setParty3Address(e.target.value)} />
          </div>
          <div className="od-party-row">
            <span className="od-party-lbl">اسم الطرف الثالث</span>
            <input type="text" className="od-party-txt" value={party3Name} onChange={(e) => setParty3Name(e.target.value)} />
          </div>
        </div>
        <div className="od-party-col">
          <div className="od-party-row">
            <span className="od-party-lbl">عنوان الطرف الثاني</span>
            <input type="text" className="od-party-txt" value={party2Address} onChange={(e) => setParty2Address(e.target.value)} />
          </div>
          <div className="od-party-row">
            <span className="od-party-lbl">اسم الطرف الثاني</span>
            <input type="text" className="od-party-txt" value={party2Name} onChange={(e) => setParty2Name(e.target.value)} />
          </div>
        </div>
        <div className="od-party-col">
          <div className="od-party-row">
            <span className="od-party-lbl">عنوان الطرف الاول</span>
            <input type="text" className="od-party-txt" value={party1Address} onChange={(e) => setParty1Address(e.target.value)} />
          </div>
          <div className="od-party-row">
            <span className="od-party-lbl">اسم الطرف الاول</span>
            <input type="text" className="od-party-txt" value={party1Name} onChange={(e) => setParty1Name(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="od-closing-row">
        <span className="od-appreciation">مع التقدير</span>
      </div>

      <div className="od-actions">
        <button type="button" className="od-btn od-btn-grey" onClick={selectLatestSavedDoc}>
          آخر قائمة
        </button>
        <button type="button" className="od-btn od-btn-green" onClick={focusBodyEditor}>
          تعديل قائمة
        </button>

        <fieldset className="od-box od-box-orange">
          <legend className="od-box-legend">Print Address</legend>
          <label className="od-radio">
            <input type="radio" name="printAddr" checked={printAddr === "pride"} onChange={() => setPrintAddr("pride")} />
            Pride
          </label>
          <label className="od-radio">
            <input type="radio" name="printAddr" checked={printAddr === "faqr"} onChange={() => setPrintAddr("faqr")} />
            Faqr
          </label>
          <label className="od-chk">
            <input type="checkbox" checked={hideNumDate} onChange={(e) => setHideNumDate(e.target.checked)} />
            اخفاء العدد والتاريخ
          </label>
        </fieldset>

        <fieldset className="od-box od-box-orange">
          <legend className="od-box-legend">نوع الطباعة</legend>
          <label className="od-radio">
            <input type="radio" name="printType" checked={printType === "with"} onChange={() => setPrintType("with")} />
            مع الختم
          </label>
          <label className="od-radio">
            <input type="radio" name="printType" checked={printType === "without"} onChange={() => setPrintType("without")} />
            بدون الختم
          </label>
        </fieldset>

        <button
          type="button"
          className="od-btn od-btn-gold"
          onClick={() => printRootWithLocale(pageRootRef.current, { dir: "rtl", lang: "ar" })}
        >
          طباعة
        </button>
        <button type="button" className="od-btn od-btn-green" onClick={onSave}>
          حفظ بالخادم
        </button>
        <button type="button" className="od-btn od-btn-red" onClick={onDelete} disabled={!selectedId}>
          الغاء قائمة
        </button>
        <button type="button" className="od-btn od-btn-grey" onClick={onNew}>
          قائمة جديدة
        </button>
      </div>
    </div>
  );
}
