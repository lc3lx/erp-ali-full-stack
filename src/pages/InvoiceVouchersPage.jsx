import * as u from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { api as E } from "../lib/api.js";
import { useAuth as ps } from "../context/AuthContext.jsx";
import { GlPurchaseVoucherPost as Pf } from "../components/GlDocumentPost.jsx";
import { DocumentStatusBadge as Id } from "../components/erp/DocumentStatusBadge.jsx";
import { ItemLineLinkPanel as Dd } from "../components/ItemLineLinkPanel.jsx";
import { SearchableDropdown as Zs } from "../components/SearchableDropdown.jsx";
import { formatIsoToDisplay as Et, toApiDateTime as Ct } from "../lib/dates.js";
import { MASTERS_REFRESH_EVENT as $n, navigateAppPage as kn, printRootWithLocale as Vt } from "../lib/uiActions.js";
import "../App.css";

const s = { jsx, jsxs, Fragment };

function ue(e) {
  return e == null || e === "" ? "" : String(e);
}

function Oe(e) {
  const t = String(e ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const Tf = {
  "إغلاق": "إغلاق",
  "تعديل": "تعديل",
  "عمولة المكتب": "عمولة المكتب",
  "سعر نقل المتر المكعب": "سعر نقل المتر المكعب",
  "سعر الصرف": "سعر الصرف",
  "مجموع": "المجموع",
  "رقم الحاوية": "رقم الحاوية",
  "جديد": "جديد",
  "حذف": "حذف",
  "المورد": "المورد",
  "تاريخ الفاتورة": "تاريخ الفاتورة",
  "تاريخ العامة": "تاريخ الفاتورة",
  "إرسال للموافقة": "إرسال للموافقة",
  "اعتماد": "اعتماد",
  "رفض": "رفض",
  "العملة": "العملة",
  "ملاحظات": "ملاحظات",
  "حفظ السند": "حفظ الفاتورة",
  "حذف سطر": "حذف سطر",
  "تعديل سطر": "تعديل سطر",
  "الدولار": "الدولار",
  "دولار": "دولار",
  "دينار": "دينار",
  "وزن": "وزن",
  "القائمة": "القائمة",
  "التفاصيل": "التفاصيل",
  "رقم": "الرقم",
  "لا أسطر": "لا توجد أسطر",
  "طباعة": "طباعة",
  "عربي": "عربي",
  "اختر المورد": "اختر المورد",
  "ابحث عن مورد...": "ابحث عن مورد...",
  "سبب الرفض (اختياري)": "سبب الرفض (اختياري)",
  "تحتاج على الأقل حاوية ومورد في الجداول.": "يجب وجود حاوية ومورد على الأقل في الجداول.",
  "رقم سند الشراء؟": "رقم فاتورة الشراء",
  "حذف السند؟": "حذف الفاتورة؟",
  "اسم المادة": "اسم المادة",
  "رقم المادة": "رقم المادة",
  "سطر جديد": "سطر جديد",
  "الوزن الإجمالي": "الوزن الإجمالي",
  "مجموع السعر": "مجموع السعر",
  "حذف السطر؟": "حذف السطر؟",
  "لا توجد فواتير شراء في القائمة.": "لا توجد فواتير شراء في القائمة.",
  "لا توجد فواتير.": "لا توجد فواتير.",
  "أحدث السندات (حسب التعديل):": "أحدث الفواتير (حسب آخر تعديل):",
  "فتح الحاوية في قائمة الحاويات": "فتح الحاوية في قائمة الحاويات",
  "▶": "▶",
  "—": "—",
};

const mojibakeHintRegex =
  /(?:\u00E2\u0080|\u00C3|\u00C2|\uFFFD|\u0637[\u00A0-\u00FF]|\u0638[\u00A0-\u00FF])/g;

const windows1256EncodeMap = (() => {
  if (typeof TextDecoder === "undefined" || typeof Uint8Array === "undefined") {
    return null;
  }
  try {
    const e = new TextDecoder("windows-1256");
    const t = new Map();
    for (let n = 0; n < 256; n += 1) {
      const r = e.decode(Uint8Array.of(n));
      if (!t.has(r)) t.set(r, n);
    }
    return t;
  } catch {
    return null;
  }
})();

const utf8Decoder =
  typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: false }) : null;

function mojibakeScore(e) {
  if (!e) return 0;
  const t = e.match(mojibakeHintRegex);
  return t ? t.length : 0;
}

function decodeMojibakeWindows1256ToUtf8(e) {
  if (!e || !windows1256EncodeMap || !utf8Decoder) return e;
  let t = e;
  for (let n = 0; n < 3; n += 1) {
    const r = mojibakeScore(t);
    if (!r) break;

    const l = [];
    let a = true;
    for (const i of t) {
      const o = windows1256EncodeMap.get(i);
      if (o == null) {
        a = false;
        break;
      }
      l.push(o);
    }

    if (!a || !l.length) break;

    let i = t;
    try {
      i = utf8Decoder.decode(new Uint8Array(l));
    } catch {
      break;
    }

    if (!i || i === t) break;
    if (mojibakeScore(i) > r) break;
    t = i;
  }
  return t;
}

function Sr(e) {
  let t = ue(e);
  for (const [n, r] of Object.entries(Tf)) t = t.split(n).join(r);
  t = decodeMojibakeWindows1256ToUtf8(t);
  for (const [n, r] of Object.entries(Tf)) t = t.split(n).join(r);
  return t;
}

function If(){const{user:e}=ps(),[t,n]=u.useState([]),[r,l]=u.useState(""),[a,i]=u.useState(null),[o,c]=u.useState([]),[d,x]=u.useState(null),[g,h]=u.useState(""),[C,D]=u.useState([]),[k,P]=u.useState([]),[p,m]=u.useState([]),[y,f]=u.useState(""),[S,b]=u.useState(""),[L,A]=u.useState([]),[z,_]=u.useState({}),[R,Y]=u.useState(""),[K,ie]=u.useState(""),[J,se]=u.useState(!1),[j,V]=u.useState(null),[U,W]=u.useState(""),ae=u.useRef(null),me=u.useRef(null),ze=u.useRef(null);u.useEffect(()=>{const N=ae.current;if(!N)return;const $=document.createTreeWalker(N,NodeFilter.SHOW_TEXT);let X=$.nextNode();for(;X;){const v=X,w=v.nodeValue??"",B=Sr(w);B!==w&&(v.nodeValue=B),X=$.nextNode()}N.querySelectorAll("[title]").forEach(v=>{const w=v.getAttribute("title");if(!w)return;const B=Sr(w);B!==w&&v.setAttribute("title",B)}),N.querySelectorAll("input[placeholder]").forEach(v=>{const w=v.getAttribute("placeholder");if(!w)return;const B=Sr(w);B!==w&&v.setAttribute("placeholder",B)})},[a,o,t,J,K,R]);const pe=u.useCallback(async N=>{if(!N)return;const[$,X,v]=await Promise.all([E.get(`/invoice-vouchers/${N}`),E.get(`/invoice-vouchers/${N}/items`),E.get(`/invoice-vouchers/${N}/totals`)]);i($),c(X.items??[]),x(v)},[]);u.useEffect(()=>{let N=!1;return(async()=>{try{const[$,X,v,w]=await Promise.all([E.get("/invoice-vouchers",{page:1,pageSize:100}),E.get("/containers",{page:1,pageSize:200}),E.get("/parties",{type:"SUPPLIER",page:1,pageSize:300}),E.get("/stores")]);if(N)return;const B=$.items??[];n(B),l(ee=>{var oe;return ee&&B.some(ve=>ve.id===ee)?ee:((oe=B[0])==null?void 0:oe.id)??""}),D(X.items??[]),P(v.items??[]),m(w.items??[])}catch($){N||h($.message)}})(),()=>{N=!0}},[]),u.useEffect(()=>{const N=$=>{var v;const X=(v=$.detail)==null?void 0:v.scope;X!=="stores"&&X!=="all"||(async()=>{try{if(X==="stores"){const w=await E.get("/stores");m(w.items??[])}else{const[w,B,ee]=await Promise.all([E.get("/containers",{page:1,pageSize:200}),E.get("/parties",{type:"SUPPLIER",page:1,pageSize:300}),E.get("/stores")]);D(w.items??[]),P(B.items??[]),m(ee.items??[])}}catch(w){h(w.message)}})()};return window.addEventListener($n,N),()=>window.removeEventListener($n,N)},[]),u.useEffect(()=>{var X;const N=(X=sessionStorage.getItem("purchaseVouchersJumpContainerNo"))==null?void 0:X.trim();if(!N||!t.length)return;const $=t.find(v=>{var w;return String(((w=v.container)==null?void 0:w.containerNo)??"").trim()===N});sessionStorage.removeItem("purchaseVouchersJumpContainerNo"),$&&l($.id)},[t]),u.useEffect(()=>{if(!r){i(null),c([]),x(null);return}let N=!1;return(async()=>{try{await pe(r),N||h("")}catch($){N||h($.message)}})(),()=>{N=!0}},[r,pe]),u.useEffect(()=>{ie(""),se(!1)},[r]),u.useEffect(()=>{f((a==null?void 0:a.supplierId)??""),b((a==null?void 0:a.storeId)??"")},[a==null?void 0:a.id,a==null?void 0:a.supplierId,a==null?void 0:a.storeId,a==null?void 0:a.updatedAt]),u.useEffect(()=>{if(!r){A([]),_({}),Y("");return}let N=!1;return(async()=>{var $;try{const X=await E.get(`/invoice-vouchers/${r}/stock`);if(N)return;const v=X.items??[];A(v),Y((($=X.warehouse)==null?void 0:$.name)??"");const w={};for(const B of v)w[B.itemId]=Number(B.qtyOnHand??0);_(w)}catch{if(N)return;A([]),_({}),Y("")}})(),()=>{N=!0}},[r,o]);const ge=ue((a==null?void 0:a.exchangeRate)??"6.7"),xe=a!=null&&a.voucherDate?Et(a.voucherDate):"",Me=(a==null?void 0:a.voucherNo)??"",ye=Sr(ue((a==null?void 0:a.currency)??"دولار"))||"دولار",Ce=d==null?void 0:d.aggregates,F="iv-header-form",re=async()=>{if(r)try{await E.post(`/invoice-vouchers/${r}/workflow/submit`,{}),await pe(r)}catch(N){window.alert(N.message)}},te=async()=>{if(r)try{await E.post(`/invoice-vouchers/${r}/workflow/approve`,{}),await pe(r)}catch(N){window.alert(N.message)}},Be=async()=>{if(!r)return;const N=window.prompt("سبب الرفض (اختياري)")??"";try{await E.post(`/invoice-vouchers/${r}/workflow/reject`,{comment:N||null}),await pe(r)}catch($){window.alert($.message)}},Se=async N=>{if(N.preventDefault(),!r)return;const $=document.getElementById(F);if(!$)return;const X=new FormData($);try{await E.patch(`/invoice-vouchers/${r}`,{voucherNo:String(X.get("voucherNo")||"").trim()||void 0,voucherDate:Ct(String(X.get("voucherDate")||""))??null,exchangeRate:X.get("exchangeRate")||void 0,officeCommission:X.get("officeCommission")||void 0,cbmTransportPrice:X.get("cbmTransportPrice")||void 0,currency:X.get("currency")||void 0,containerId:X.get("containerId")||void 0,supplierId:y||void 0,storeId:S||null,notes:X.get("notes")||null}),await pe(r);const v=await E.get("/invoice-vouchers",{page:1,pageSize:100});n(v.items??[]),se(!1)}catch(v){h(v.message)}},Re=async()=>{var v,w;const N=(v=C[0])==null?void 0:v.id,$=(w=k[0])==null?void 0:w.id;if(!N||!$){window.alert("يجب وجود حاوية ومورد على الأقل في البيانات.");return}const X=window.prompt("رقم فاتورة الشراء",`P-${Date.now()}`);if(!(!X||!X.trim()))try{const B=await E.post("/invoice-vouchers",{voucherNo:X.trim(),containerId:N,supplierId:$,currency:"دولار"}),ee=await E.get("/invoice-vouchers",{page:1,pageSize:100});n(ee.items??[]),l(B.id)}catch(B){h(B.message)}},T=async()=>{var N;if(!(!r||!window.confirm("حذف فاتورة الشراء؟")))try{await E.delete(`/invoice-vouchers/${r}`);const X=(await E.get("/invoice-vouchers",{page:1,pageSize:100})).items??[];n(X),l(((N=X[0])==null?void 0:N.id)??"")}catch($){h($.message)}},q=async()=>{if(!r)return;const N=window.prompt("اسم المادة","سطر جديد");if(N==null)return;const $=window.prompt("رقم المادة","");if($==null)return;const X=window.prompt("Price to Customer Sum","");if(X==null)return;const v=window.prompt("Weight Sum","");if(v==null)return;const w=window.prompt("Weight","");if(w==null)return;const B=window.prompt("CBM Sum","");if(B==null)return;const ee=window.prompt("CBM","");if(ee==null)return;const oe=window.prompt("Boxes Sum","");if(oe==null)return;const ve=window.prompt("Pieces Sum","");if(ve==null)return;const Nt=window.prompt("Price Sum","");if(Nt==null)return;const Xt=window.prompt("Carton PCS","");if(Xt==null)return;const gn=window.prompt("Price","");if(gn!=null)try{await E.post(`/invoice-vouchers/${r}/items`,{itemName:N.trim()||null,itemNo:$.trim()||null,priceToCustomerSum:Oe(X),weightSum:Oe(v),weight:Oe(w),cbmSum:Oe(B),cbm:Oe(ee),boxesSum:Oe(oe),piecesSum:Oe(ve),priceSum:Oe(Nt),cartonPcs:Oe(Xt),unitPrice:Oe(gn)}),await pe(r)}catch(lr){h(lr.message)}},G=async()=>{if(!(!r||!K||!window.confirm("حذف السطر؟")))try{await E.delete(`/invoice-vouchers/${r}/items/${K}`),ie(""),await pe(r)}catch(N){h(N.message)}},Ee=async()=>{if(!r||!K)return;const N=o.find(kl=>kl.id===K);if(!N)return;const $=window.prompt("اسم المادة",N.itemName??"");if($==null)return;const X=window.prompt("رقم المادة",N.itemNo??"");if(X==null)return;const v=window.prompt("Price to Customer Sum",ue(N.priceToCustomerSum??""));if(v==null)return;const w=window.prompt("الوزن الإجمالي",ue(N.weightSum??""));if(w==null)return;const B=window.prompt("Weight",ue(N.weight??""));if(B==null)return;const ee=window.prompt("CBM Sum",ue(N.cbmSum??""));if(ee==null)return;const oe=window.prompt("CBM",ue(N.cbm??""));if(oe==null)return;const ve=window.prompt("Boxes Sum",ue(N.boxesSum??""));if(ve==null)return;const Nt=window.prompt("Pieces Sum",ue(N.piecesSum??""));if(Nt==null)return;const Xt=window.prompt("مجموع السعر",ue(N.priceSum??""));if(Xt==null)return;const gn=window.prompt("Carton PCS",ue(N.cartonPcs??""));if(gn==null)return;const lr=window.prompt("Price",ue(N.unitPrice??""));if(lr!=null)try{await E.patch(`/invoice-vouchers/${r}/items/${K}`,{itemName:$.trim()||null,itemNo:X.trim()||null,priceToCustomerSum:Oe(v),weightSum:Oe(w),weight:Oe(B),cbmSum:Oe(ee),cbm:Oe(oe),boxesSum:Oe(ve),piecesSum:Oe(Nt),priceSum:Oe(Xt),cartonPcs:Oe(gn),unitPrice:Oe(lr)}),await pe(r)}catch(kl){h(kl.message)}},Ne=new Set(["priceToCustomerSum","weightSum","weight","cbmSum","cbm","boxesSum","piecesSum","priceSum","cartonPcs","unitPrice","itemName","itemNo"]),Pe=new Set(["priceToCustomerSum","weightSum","weight","cbmSum","cbm","boxesSum","piecesSum","priceSum","cartonPcs","unitPrice"]),O=(N,$,X)=>{Ne.has($)&&(ie(N),V({lineId:N,field:$}),W(ue(X)))},ne=async()=>{if(!j||!r)return;const{lineId:N,field:$}=j,X={};Pe.has($)?X[$]=Oe(U):X[$]=U.trim()||null;try{await E.patch(`/invoice-vouchers/${r}/items/${N}`,X),await pe(r)}catch(v){h(v.message)}finally{V(null),W("")}},Z=()=>{V(null),W("")},_e=()=>{var $;const N=($=t[0])==null?void 0:$.id;N?l(N):window.alert("لا توجد فواتير شراء في القائمة.")},Dt=()=>{if(!t.length){window.alert("لا توجد فواتير.");return}const N=t.slice(0,20).map(($,X)=>{var v;return`${X+1}. ${$.voucherNo} — ${((v=$.container)==null?void 0:v.containerNo)??"?"}`});window.alert(`أحدث الفواتير (حسب آخر تعديل):

${N.join(`
`)}`)},I=()=>{var N;return(N=me.current)==null?void 0:N.scrollIntoView({behavior:"smooth",block:"start"})},H=()=>{var N;return(N=ze.current)==null?void 0:N.scrollIntoView({behavior:"smooth",block:"start"})},le=()=>{var $,X;const N=(X=($=a==null?void 0:a.container)==null?void 0:$.containerNo)==null?void 0:X.trim();N&&sessionStorage.setItem("reportsJumpContainerNo",N),kn("list")};return s.jsxs("div",{className:"iv-page",dir:"ltr",ref:ae,children:[g?s.jsx("div",{className:"alert-error",style:{margin:6},children:g}):null,s.jsx("div",{className:"iv-titleline",children:"Invoice Vouchers"}),s.jsxs("div",{className:"iv-top-tabs",ref:me,children:[s.jsx("button",{type:"button",className:"iv-tab active",onClick:I,children:"Invoice Vouchers"}),s.jsx("button",{type:"button",className:"iv-tab",onClick:H,children:"Details"}),s.jsx("div",{className:"iv-spacer"}),s.jsx("button",{type:"button",className:"iv-mini-btn",onClick:()=>se(N=>!N),children:J?"Lock":"Edit"})]}),s.jsxs("form",{id:F,onSubmit:Se,children:[s.jsxs("div",{className:"iv-controls-row",children:[s.jsx("button",{type:"submit",className:"iv-btn-soft iv-btn-edit",children:"Save"}),s.jsx("span",{className:"iv-lbl-small",children:"%"}),s.jsx("input",{className:"iv-mini-input",name:"officeCommission",readOnly:!J,defaultValue:ue((a==null?void 0:a.officeCommission)??"0")},`oc-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"office commossion"}),s.jsx("input",{className:"iv-mini-input",name:"cbmTransportPrice",readOnly:!J,defaultValue:ue((a==null?void 0:a.cbmTransportPrice)??"")},`cbm-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"cbm transport price"}),s.jsx("input",{className:"iv-mini-input",value:ue((a==null?void 0:a.policyNo)??""),readOnly:!0}),s.jsx("div",{className:"iv-spacer"}),s.jsx("input",{className:"iv-rate-input",name:"exchangeRate",readOnly:!J,defaultValue:ge},`er-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"سعر الصرف"}),s.jsx("input",{className:"iv-date-input",name:"voucherDate",readOnly:!J,placeholder:"dd/mm/yyyy",defaultValue:xe},`vd-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"Date"}),s.jsx("input",{className:"iv-voucher-input",name:"voucherNo",readOnly:!J,defaultValue:Me},`vn-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"Voucher No"})]}),s.jsxs("div",{className:"iv-controls-row second",children:[s.jsx("select",{className:"iv-blue-input",name:"containerId",disabled:!J,defaultValue:(a==null?void 0:a.containerId)??"",children:C.map(N=>s.jsx("option",{value:N.id,children:N.containerNo},N.id))},`ct-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"Container No"}),s.jsx(Zs,{name:"supplierId",dir:"rtl",className:"iv-search-select",inputClassName:"iv-balance-input",disabled:!J,value:y,onChange:f,options:k,getOptionValue:N=>N.id,getOptionLabel:N=>N.name,placeholder:"اختر المورد",searchPlaceholder:"ابحث عن مورد...",clearLabel:"— اختر المورد —",allowClear:!1}),s.jsx("span",{className:"iv-lbl-small",children:"Supplier"}),s.jsxs("div",{className:"iv-voucher-stack",children:[s.jsxs("select",{className:"iv-currency-select",name:"currency",disabled:!J,defaultValue:ye,children:[s.jsx("option",{value:"دولار",children:"دولار"}),s.jsx("option",{value:"دينار",children:"دينار"})]},`cur-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("select",{className:"iv-voucher-list",size:Math.min(5,Math.max(3,t.length||3)),value:r,onChange:N=>l(N.target.value),children:t.length===0?s.jsx("option",{value:"",children:"—"}):t.map(N=>s.jsxs("option",{value:N.id,children:[N.voucherNo," (",N.currency,")"]},N.id))})]})]}),s.jsxs("div",{className:"erp-workflow-row",style:{margin:"6px 0"},children:[s.jsx(Id,{status:a==null?void 0:a.documentStatus}),(a==null?void 0:a.documentStatus)==="DRAFT"&&((e==null?void 0:e.role)==="DATA_ENTRY"||(e==null?void 0:e.role)==="ACCOUNTANT"||(e==null?void 0:e.role)==="ADMIN")?s.jsx("button",{type:"button",onClick:re,children:"إرسال للموافقة"}):null,(a==null?void 0:a.documentStatus)==="SUBMITTED"&&((e==null?void 0:e.role)==="ACCOUNTANT"||(e==null?void 0:e.role)==="ADMIN")?s.jsxs(s.Fragment,{children:[s.jsx("button",{type:"button",onClick:te,children:"اعتماد"}),s.jsx("button",{type:"button",onClick:Be,children:"رفض"})]}):null]}),s.jsxs("div",{className:"iv-controls-row third",children:[s.jsx("button",{type:"button",className:"iv-blue-wide",onClick:le,title:"فتح الحاوية في قائمة الحاويات",children:"container vouchers"}),s.jsx("div",{className:"iv-spacer"}),s.jsx(Zs,{name:"storeId",className:"iv-search-select",inputClassName:"iv-small-select",disabled:!J,value:S,onChange:b,options:p,getOptionValue:N=>N.id,getOptionLabel:N=>N.name,placeholder:"—",searchPlaceholder:"ابحث عن مستودع...",clearLabel:"— بدون مستودع —"}),s.jsx("span",{className:"iv-lbl-small",children:"Store Targit"}),s.jsx("input",{className:"iv-mini-input notes",name:"notes",readOnly:!J,defaultValue:(a==null?void 0:a.notes)??""},`nt-${r}-${a==null?void 0:a.updatedAt}`),s.jsx("span",{className:"iv-lbl-small",children:"Nots"})]})]}),s.jsxs("div",{className:"iv-controls-row",style:{marginTop:6},children:[s.jsx("button",{type:"button",className:"iv-item-btn green",onClick:Re,children:"NEW voucher"}),s.jsx("button",{type:"button",className:"iv-item-btn red",onClick:T,children:"Delete voucher"}),s.jsx("button",{type:"button",className:"iv-item-btn green",onClick:q,children:"Add line"}),s.jsx("button",{type:"button",className:"iv-item-btn red",onClick:G,disabled:!K,children:"Delete line"}),s.jsx("button",{type:"button",className:"iv-item-btn green",onClick:Ee,disabled:!K,children:"Edit line"})]}),s.jsxs("div",{className:"iv-table-wrap",ref:ze,children:[s.jsxs("div",{className:"iv-side-item-actions",children:[s.jsx("button",{type:"button",className:"iv-item-btn red",onClick:G,disabled:!K,children:"Delete Item"}),s.jsx("button",{type:"button",className:"iv-item-btn green",onClick:q,children:"Add Item"})]}),s.jsxs("table",{className:"iv-table",children:[s.jsx("thead",{children:s.jsxs("tr",{children:[s.jsx("th",{}),s.jsxs("th",{children:["Price to",s.jsx("br",{}),"Costumer Sum"]}),s.jsxs("th",{children:["Weight",s.jsx("br",{}),"Sum"]}),s.jsx("th",{children:"Weight"}),s.jsxs("th",{children:["cbm",s.jsx("br",{}),"Sum"]}),s.jsx("th",{children:"cbm"}),s.jsxs("th",{children:["Boxes",s.jsx("br",{}),"Sum"]}),s.jsxs("th",{children:["Pieces",s.jsx("br",{}),"Sum"]}),s.jsx("th",{children:"Price Sum"}),s.jsx("th",{children:"carton pcs"}),s.jsx("th",{children:"price"}),s.jsx("th",{children:"Item Name"}),s.jsx("th",{children:"item no"}),s.jsx("th",{children:"available"}),s.jsx("th",{children:"seq"}),s.jsx("th",{children:"pic"})]})}),s.jsx("tbody",{children:o.length===0?s.jsx("tr",{children:s.jsx("td",{colSpan:16,style:{textAlign:"center",padding:12},children:"لا أسطر"})}):o.map(N=>s.jsxs("tr",{style:{cursor:"pointer",background:K===N.id?"#e8f4ff":void 0},onClick:()=>ie(N.id),children:[s.jsx("td",{className:"iv-arrow",children:"▶"}),s.jsx("td",{onDoubleClick:()=>O(N.id,"priceToCustomerSum",N.priceToCustomerSum),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="priceToCustomerSum"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.priceToCustomerSum)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"weightSum",N.weightSum),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="weightSum"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.weightSum)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"weight",N.weight),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="weight"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.weight)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"cbmSum",N.cbmSum),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="cbmSum"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.cbmSum)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"cbm",N.cbm),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="cbm"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.cbm)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"boxesSum",N.boxesSum),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="boxesSum"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.boxesSum)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"piecesSum",N.piecesSum),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="piecesSum"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.piecesSum)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"priceSum",N.priceSum),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="priceSum"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.priceSum)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"cartonPcs",N.cartonPcs),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="cartonPcs"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.cartonPcs)}),s.jsx("td",{onDoubleClick:()=>O(N.id,"unitPrice",N.unitPrice),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="unitPrice"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):ue(N.unitPrice)}),s.jsx("td",{className:"iv-item-name",onDoubleClick:()=>O(N.id,"itemName",N.itemName),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="itemName"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):N.itemName??""}),s.jsx("td",{onDoubleClick:()=>O(N.id,"itemNo",N.itemNo),children:(j==null?void 0:j.lineId)===N.id&&(j==null?void 0:j.field)==="itemNo"?s.jsx("input",{autoFocus:!0,className:"iv-mini-input",value:U,onChange:$=>W($.target.value),onBlur:ne,onKeyDown:$=>{$.key==="Enter"&&ne(),$.key==="Escape"&&Z()}}):N.itemNo??""}),s.jsx("td",{children:N.itemId?ue(z[N.itemId]??0):"—"}),s.jsx("td",{children:N.seq}),s.jsx("td",{children:N.itemId?"linked":"—"})]},N.id))})]})]}),R?s.jsxs("div",{style:{marginTop:6,fontSize:12,color:"#334155"},children:["Warehouse: ",s.jsx("strong",{children:R})," (",L.length," items)"]}):null,s.jsx(Dd,{mode:"purchase",voucherId:r,line:o.find(N=>N.id===K),onSaved:()=>pe(r)}),s.jsx("div",{className:"iv-summary-row",children:s.jsxs("div",{className:"iv-sum-grid",children:[s.jsxs("div",{className:"iv-sum-item",children:[s.jsx("div",{className:"iv-sum-item-box",children:ue((Ce==null?void 0:Ce.priceToCustomerSum)??"")}),s.jsx("div",{className:"iv-sum-item-label",children:"Price to Customer Sum"})]}),s.jsxs("div",{className:"iv-sum-item",children:[s.jsx("div",{className:"iv-sum-item-box",children:ue((Ce==null?void 0:Ce.weightSum)??"")}),s.jsx("div",{className:"iv-sum-item-label",children:"Weight Sum"})]}),s.jsxs("div",{className:"iv-sum-item",children:[s.jsx("div",{className:"iv-sum-item-box",children:ue((Ce==null?void 0:Ce.boxesSum)??"")}),s.jsx("div",{className:"iv-sum-item-label",children:"Boxes Sum"})]}),s.jsxs("div",{className:"iv-sum-item",children:[s.jsx("div",{className:"iv-sum-item-box",children:ue((Ce==null?void 0:Ce.piecesSum)??"")}),s.jsx("div",{className:"iv-sum-item-label",children:"Pieces Sum"})]}),s.jsxs("div",{className:"iv-sum-item",children:[s.jsx("div",{className:"iv-sum-item-box",children:ue((d==null?void 0:d.summation)??"")}),s.jsx("div",{className:"iv-sum-item-label",children:"Summation"})]})]})}),s.jsxs("div",{className:"iv-balance-panel",children:[s.jsxs("div",{className:"iv-balance-line",children:[s.jsx("input",{className:"iv-balance-small",value:ue((d==null?void 0:d.summation)??""),readOnly:!0}),s.jsx("span",{children:"summation"})]}),s.jsxs("div",{className:"iv-balance-line",children:[s.jsx("input",{className:"iv-balance-small",value:ue((d==null?void 0:d.paid)??""),readOnly:!0}),s.jsx("span",{children:"paied"})]}),s.jsxs("div",{className:"iv-balance-line",children:[s.jsx("input",{className:"iv-balance-small",value:ue((d==null?void 0:d.balance)??""),readOnly:!0}),s.jsx("span",{children:"balance"})]})]}),s.jsx(Pf,{voucherId:r,glJournalEntryId:a==null?void 0:a.glJournalEntryId,documentStatus:a==null?void 0:a.documentStatus,onPosted:()=>pe(r)}),s.jsxs("div",{className:"iv-bottom-actions",children:[s.jsx("button",{type:"button",className:"iv-bottom-btn",onClick:Re,children:"NEW"}),s.jsx("button",{type:"button",className:"iv-bottom-btn red",onClick:T,children:"Delete"}),s.jsx("button",{type:"button",className:"iv-bottom-btn",onClick:()=>{var N;return(N=document.getElementById(F))==null?void 0:N.requestSubmit()},children:"Save"}),s.jsxs("button",{type:"button",className:"iv-bottom-btn yellow",onClick:()=>Vt(ae.current,{dir:"rtl",lang:"ar"}),children:["طباعة",s.jsx("br",{}),"عربي"]}),s.jsxs("button",{type:"button",className:"iv-bottom-btn yellow",onClick:()=>Vt(ae.current,{dir:"ltr",lang:"en"}),children:["Print",s.jsx("br",{}),"English"]}),s.jsx("button",{type:"button",className:"iv-bottom-btn",onClick:_e,children:"Last Voucher"}),s.jsxs("button",{type:"button",className:"iv-bottom-btn",onClick:Dt,children:["Last Edited",s.jsx("br",{}),"Vouchers"]}),s.jsxs("button",{type:"button",className:"iv-bottom-btn",onClick:()=>r&&pe(r),children:["Re Load Last",s.jsx("br",{}),"Voucher"]}),s.jsx("button",{type:"button",className:"iv-bottom-btn green",onClick:()=>kn("is"),children:"Direct Sal"}),s.jsx("button",{type:"button",className:"iv-bottom-btn green",onClick:()=>{se(!1),h(""),ie("")},children:"X"}),s.jsx("button",{type:"button",className:"iv-bottom-btn green",onClick:H,children:"second"}),s.jsx("button",{type:"button",className:"iv-bottom-btn blue",onClick:I,children:"main"})]})]})}

export default If;

