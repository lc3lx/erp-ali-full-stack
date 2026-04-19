import * as u from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { api as E } from "../lib/api.js";
import { useAuth as ps } from "../context/AuthContext.jsx";
import { GlSaleVoucherPost as Ef } from "../components/GlDocumentPost.jsx";
import { DocumentStatusBadge as Id } from "../components/erp/DocumentStatusBadge.jsx";
import { ItemLineLinkPanel as Dd } from "../components/ItemLineLinkPanel.jsx";
import { SearchableDropdown as Zs } from "../components/SearchableDropdown.jsx";
import { formatIsoToDisplay as Et, toApiDateTime as Ct } from "../lib/dates.js";
import {
  MASTERS_REFRESH_EVENT as $n,
  navigateAppPage as kn,
  printRootWithLocale as Vt,
  printWithBanner as Ja,
} from "../lib/uiActions.js";
import "../App.css";

const s = { jsx, jsxs, Fragment };
function he(e) {
  return e == null || e === "" ? "" : String(e);
}
function Df(e) {
  const t = String(e ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const Lf = {
  "إغلاق": "إغلاق",
  "تعديل": "تعديل",
  "عمولة المكتب":
    "عمولة المكتب",
  "سعر نقل المتر المكعب":
    "سعر نقل المتر المكعب",
  "سعر الصرف": "سعر الصرف",
  "المجموع": "المجموع",
  "رقم الحاوية": "رقم الحاوية",
  "جديد": "جديد",
  "حذف": "حذف",
  "الزبون": "الزبون",
  "تاريخ الفاتورة":
    "تاريخ الفاتورة",
  "ط·آ§ط¸â€‍ط¸â€ڑط·آ§ط·آ¦ط¸â€¦ط·آ©": "القائمة",
  "إرسال للموافقة":
    "إرسال للموافقة",
  "اعتماد": "اعتماد",
  "رفض": "رفض",
  "العملة": "العملة",
  "ملاحظات": "ملاحظات",
  "حفظ الفاتورة": "حفظ الفاتورة",
  "حذف ط·آ³ط·آ·ط·آ±": "حذف سطر",
  "تعديل ط·آ³ط·آ·ط·آ±": "تعديل سطر",
  "سعر تحويل": "سعر تحويل",
  "دولار": "دولار",
  "دينار": "دينار",
  "ط·آ§ط¸â€‍دولار": "دولار",
  "المجموع ط·آ³ط·آ¹ط·آ±": "مجموع سعر",
  "المجموع ط·آ§ط¸â€‍ط¸â€¦ط·ع¾ط·آ±": "مجموع المتر",
  "المكعب": "المكعب",
  "وزن": "وزن",
  "عدد": "عدد",
  "القائمة": "القائمة",
  "سعر كل": "سعر كل",
  "ألف": "ألف",
  "قطعة داخل": "قطعة داخل",
  "الكرتون": "الكرتون",
  "التفاصيل": "التفاصيل",
  "الرقم": "الرقم",
  "لا توجد أسطر": "لا توجد أسطر",
  "المحاسبة": "المحاسبة",
  "المحاسبة ط·آ¯ط·آ§ط·آ¦ط¸â€ /ط¸â€¦ط·آ¯ط¸ظ¹ط¸â€ ":
    "المحاسبة دائن/مدين",
  "ط·آ§ط¸â€‍المجموع": "المجموع",
  "المسدد": "المسدد",
  "ط·آ§ط¸â€‍المجموع ط·آ§ط¸â€‍ط·آ¨ط·آ§ط¸â€ڑط¸ظ¹":
    "المتبقي",
  "الأرباح": "الأرباح",
  "بضاعة لهذا المستثمر":
    "بضاعة لهذا المستثمر",
  "طباعة": "طباعة",
  "عربي": "عربي",
  "ط·آ§ط·آ®ط·ع¾ط·آ± الزبون": "اختر الزبون",
  "¸â€‍ط·آ§ ط·آ£ط·آ³ط·آ·ط·آ±": "لا توجد أسطر",
  "ابحث عن زبون...":
    "ابحث عن زبون...",
  "أ¢â€“آ¶": "▶",
  "أ¢â‚¬â€‌": "—",
  "يوجد ": "يوجد ",
  " سطر بيع بكمية أكبر من المتاح في المستودع المحدد.":
    " سطر بيع بكمية أكبر من المتاح في المستودع المحدد.",
  "ابحث عن مستودع...": "ابحث عن مستودع...",
  "— بدون مستودع —": "— بدون مستودع —",
};
const mojibakeHintRegex = /(?:â€|Ã|Â|�|ط[\u00a0-\u00ff]|ظ[\u00a0-\u00ff])/g;
const windows1256EncodeMap = (() => {
  if (typeof TextDecoder === "undefined" || typeof Uint8Array === "undefined")
    return null;
  try {
    const e = new TextDecoder("windows-1256");
    const t = new Map();
    for (let n = 0; n < 256; n += 1) {
      const r = e.decode(Uint8Array.of(n));
      t.has(r) || t.set(r, n);
    }
    return t;
  } catch {
    return null;
  }
})();
const utf8Decoder =
  typeof TextDecoder !== "undefined"
    ? new TextDecoder("utf-8", { fatal: !1 })
    : null;
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
    let a = !0;
    for (const i of t) {
      const o = windows1256EncodeMap.get(i);
      if (o == null) {
        a = !1;
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
function br(e) {
  let t = he(e);
  for (const [n, r] of Object.entries(Lf)) t = t.split(n).join(r);
  t = decodeMojibakeWindows1256ToUtf8(t);
  for (const [n, r] of Object.entries(Lf)) t = t.split(n).join(r);
  return t;
}
function Rf() {
  const { user: e } = ps(),
    [t, n] = u.useState([]),
    [r, l] = u.useState(""),
    [a, i] = u.useState(null),
    [o, c] = u.useState([]),
    [d, x] = u.useState(null),
    [g, h] = u.useState(""),
    [C, D] = u.useState([]),
    [k, P] = u.useState([]),
    [p, m] = u.useState([]),
    [y, f] = u.useState(""),
    [S, b] = u.useState(""),
    [L, A] = u.useState([]),
    [z, _] = u.useState({}),
    [R, Y] = u.useState(""),
    [K, ie] = u.useState(""),
    [J, se] = u.useState(!1),
    [j, V] = u.useState(null),
    [U, W] = u.useState(""),
    ae = u.useRef(null),
    me = u.useRef(null),
    ze = u.useRef(null),
    pe = u.useRef(null);
  u.useEffect(() => {
    const v = ae.current;
    if (!v) return;
    const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
    let B = w.nextNode();
    for (; B; ) {
      const ee = B,
        oe = ee.nodeValue ?? "",
        ve = br(oe);
      (ve !== oe && (ee.nodeValue = ve), (B = w.nextNode()));
    }
    (v.querySelectorAll("[title]").forEach((ee) => {
      const oe = ee.getAttribute("title");
      if (!oe) return;
      const ve = br(oe);
      ve !== oe && ee.setAttribute("title", ve);
    }),
      v.querySelectorAll("input[placeholder]").forEach((ee) => {
        const oe = ee.getAttribute("placeholder");
        if (!oe) return;
        const ve = br(oe);
        ve !== oe && ee.setAttribute("placeholder", ve);
      }));
  }, [a, o, t, J, K, R]);
  const ge = u.useCallback(async (v) => {
    if (!v) return;
    const [w, B, ee] = await Promise.all([
      E.get(`/invoice-sale/${v}`),
      E.get(`/invoice-sale/${v}/items`),
      E.get(`/invoice-sale/${v}/totals`),
    ]);
    (i(w), c(B.items ?? []), x(ee));
  }, []);
  (u.useEffect(() => {
    let v = !1;
    return (
      (async () => {
        try {
          const [w, B, ee, oe] = await Promise.all([
            E.get("/invoice-sale", { page: 1, pageSize: 100 }),
            E.get("/containers", { page: 1, pageSize: 200 }),
            E.get("/parties", { type: "SUPPLIER", page: 1, pageSize: 300 }),
            E.get("/stores"),
          ]);
          if (v) return;
          const ve = w.items ?? [];
          (n(ve),
            l((Nt) => {
              var Xt;
              return Nt && ve.some((gn) => gn.id === Nt)
                ? Nt
                : (((Xt = ve[0]) == null ? void 0 : Xt.id) ?? "");
            }),
            D(B.items ?? []),
            P(ee.items ?? []),
            m(oe.items ?? []));
        } catch (w) {
          v || h(br(w.message));
        }
      })(),
      () => {
        v = !0;
      }
    );
  }, []),
    u.useEffect(() => {
      const v = (w) => {
        var ee;
        const B = (ee = w.detail) == null ? void 0 : ee.scope;
        B &&
          (async () => {
            try {
              if (B === "customers" || B === "all") {
                const oe = await E.get("/parties", {
                  type: "CUSTOMER",
                  page: 1,
                  pageSize: 300,
                });
                P(oe.items ?? []);
              }
              if (B === "stores" || B === "all") {
                const oe = await E.get("/stores");
                m(oe.items ?? []);
              }
              if (B === "all") {
                const oe = await E.get("/containers", {
                  page: 1,
                  pageSize: 200,
                });
                D(oe.items ?? []);
              }
            } catch (oe) {
              h(br(oe.message));
            }
          })();
      };
      return (
        window.addEventListener($n, v),
        () => window.removeEventListener($n, v)
      );
    }, []),
    u.useEffect(() => {
      var B;
      const v =
        (B = sessionStorage.getItem("saleVouchersJumpContainerNo")) == null
          ? void 0
          : B.trim();
      if (!v || !t.length) return;
      const w = t.find((ee) => {
        var oe;
        return (
          String(
            ((oe = ee.container) == null ? void 0 : oe.containerNo) ?? "",
          ).trim() === v
        );
      });
      (sessionStorage.removeItem("saleVouchersJumpContainerNo"), w && l(w.id));
    }, [t]),
    u.useEffect(() => {
      if (!r) {
        (i(null), c([]), x(null));
        return;
      }
      let v = !1;
      return (
        (async () => {
          try {
            (await ge(r), v || h(""));
          } catch (w) {
            v || h(br(w.message));
          }
        })(),
        () => {
          v = !0;
        }
      );
    }, [r, ge]),
    u.useEffect(() => {
      (ie(""), se(!1));
    }, [r]),
    u.useEffect(() => {
      (f((a == null ? void 0 : a.customerId) ?? ""),
        b((a == null ? void 0 : a.storeId) ?? ""));
    }, [
      a == null ? void 0 : a.id,
      a == null ? void 0 : a.customerId,
      a == null ? void 0 : a.storeId,
      a == null ? void 0 : a.updatedAt,
    ]),
    u.useEffect(() => {
      if (!r) {
        (A([]), _({}), Y(""));
        return;
      }
      let v = !1;
      return (
        (async () => {
          var w;
          try {
            const B = await E.get(`/invoice-sale/${r}/stock`);
            if (v) return;
            const ee = B.items ?? [];
            (A(ee), Y(((w = B.warehouse) == null ? void 0 : w.name) ?? ""));
            const oe = {};
            for (const ve of ee) oe[ve.itemId] = Number(ve.qtyOnHand ?? 0);
            _(oe);
          } catch {
            if (v) return;
            (A([]), _({}), Y(""));
          }
        })(),
        () => {
          v = !0;
        }
      );
    }, [r, o]));
  const xe = he((a == null ? void 0 : a.exchangeRate) ?? "6.8"),
    Me = a != null && a.voucherDate ? Et(a.voucherDate) : "",
    ye = (a == null ? void 0 : a.voucherNo) ?? "",
    Ce = br(he((a == null ? void 0 : a.currency) ?? "دولار")) || "دولار",
    F = d == null ? void 0 : d.aggregates,
    re = "is-header-form",
    te = async () => {
      if (r)
        try {
          (await E.post(`/invoice-sale/${r}/workflow/submit`, {}), await ge(r));
        } catch (v) {
          window.alert(br(v.message));
        }
    },
    Be = async () => {
      if (r)
        try {
          (await E.post(`/invoice-sale/${r}/workflow/approve`, {}),
            await ge(r));
        } catch (v) {
          window.alert(br(v.message));
        }
    },
    Se = async () => {
      if (!r) return;
      const v = window.prompt("سبب الرفض (اختياري)") ?? "";
      try {
        (await E.post(`/invoice-sale/${r}/workflow/reject`, {
          comment: v || null,
        }),
          await ge(r));
      } catch (w) {
        window.alert(br(w.message));
      }
    },
    Re = async (v) => {
      if ((v.preventDefault(), !r)) return;
      const w = document.getElementById(re);
      if (!w) return;
      const B = new FormData(w);
      try {
        (await E.patch(`/invoice-sale/${r}`, {
          voucherNo: String(B.get("voucherNo") || "").trim() || void 0,
          voucherDate: Ct(String(B.get("voucherDate") || "")) ?? null,
          exchangeRate: B.get("exchangeRate") || void 0,
          officeCommission: B.get("officeCommission") || void 0,
          cbmTransportPrice: B.get("cbmTransportPrice") || void 0,
          currency: B.get("currency") || void 0,
          containerId: B.get("containerId") || null,
          customerId: y || void 0,
          storeId: S || null,
          notes: B.get("notes") || null,
        }),
          await ge(r));
        const ee = await E.get("/invoice-sale", { page: 1, pageSize: 100 });
        (n(ee.items ?? []), se(!1));
      } catch (ee) {
        h(br(ee.message));
      }
    },
    T = async () => {
      var ee, oe;
      const v = (ee = C[0]) == null ? void 0 : ee.id,
        w = (oe = k[0]) == null ? void 0 : oe.id;
      if (!w) {
        window.alert("يجب اختيار زبون على الأقل.");
        return;
      }
      const B = window.prompt("رقم فاتورة البيع", `S-${Date.now()}`);
      if (!(!B || !B.trim()))
        try {
          const ve = await E.post("/invoice-sale", {
              voucherNo: B.trim(),
              containerId: v || undefined,
              customerId: w,
              currency: "دولار",
            }),
            Nt = await E.get("/invoice-sale", { page: 1, pageSize: 100 });
          (n(Nt.items ?? []), l(ve.id));
        } catch (ve) {
          h(br(ve.message));
        }
    },
    q = async () => {
      var v;
      if (!(!r || !window.confirm("حذف فاتورة البيع؟")))
        try {
          await E.delete(`/invoice-sale/${r}`);
          const B =
            (await E.get("/invoice-sale", { page: 1, pageSize: 100 })).items ??
            [];
          (n(B), l(((v = B[0]) == null ? void 0 : v.id) ?? ""));
        } catch (w) {
          h(br(w.message));
        }
    },
    G = async () => {
      if (r)
        try {
          (await E.post(`/invoice-sale/${r}/items`, {
            detail: "سطر جديد",
          }),
            await ge(r));
        } catch (v) {
          h(br(v.message));
        }
    },
    Ee = async () => {
      if (!(!r || !K || !window.confirm("حذف السطر؟")))
        try {
          (await E.delete(`/invoice-sale/${r}/items/${K}`),
            ie(""),
            await ge(r));
        } catch (v) {
          h(br(v.message));
        }
    },
    Ne = async () => {
      if (!r || !K) return;
      const v = o.find((ve) => ve.id === K);
      if (!v) return;
      const w = window.prompt("التفاصيل", v.detail ?? "");
      if (w == null) return;
      const B = window.prompt("رقم المادة", v.itemNo ?? "");
      if (B == null) return;
      const ee = window.prompt("الكمية", he(v.listQty ?? ""));
      if (ee == null) return;
      const oe = window.prompt("إجمالي السعر", he(v.totalPrice ?? ""));
      if (oe != null)
        try {
          (await E.patch(`/invoice-sale/${r}/items/${K}`, {
            detail: w,
            itemNo: B,
            listQty: Number(ee) || 0,
            totalPrice: Number(oe) || 0,
          }),
            await ge(r));
        } catch (ve) {
          h(br(ve.message));
        }
    },
    Pe = new Set([
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
    ]),
    O = new Set([
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
    ]),
    ne = (v, w, B) => {
      Pe.has(w) && (ie(v), V({ lineId: v, field: w }), W(he(B)));
    },
    Z = async () => {
      if (!j || !r) return;
      const { lineId: v, field: w } = j,
        B = {};
      O.has(w) ? (B[w] = Df(U)) : (B[w] = U.trim() || null);
      try {
        (await E.patch(`/invoice-sale/${r}/items/${v}`, B), await ge(r));
      } catch (ee) {
        h(br(ee.message));
      } finally {
        (V(null), W(""));
      }
    },
    _e = () => {
      (V(null), W(""));
    },
    Dt = () => {
      var w;
      const v = (w = t[0]) == null ? void 0 : w.id;
      v ? l(v) : window.alert("لا توجد فواتير بيع.");
    },
    I = () => {
      if (!t.length) {
        window.alert("لا توجد فواتير.");
        return;
      }
      const v = t.slice(0, 20).map((w, B) => {
        var ee;
        return `${B + 1}. ${br(w.voucherNo)} — ${br(((ee = w.container) == null ? void 0 : ee.containerNo) ?? "?")}`;
      });
      window.alert(`أحدث فواتير البيع:

${v.join(`
`)}`);
    },
    H = () => {
      var v;
      return (v = me.current) == null
        ? void 0
        : v.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    le = () => {
      var v;
      return (v = ze.current) == null
        ? void 0
        : v.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    N = () => {
      var v;
      return (v = pe.current) == null
        ? void 0
        : v.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    $ = () => {
      var w, B;
      const v =
        (B =
          (w = a == null ? void 0 : a.container) == null
            ? void 0
            : w.containerNo) == null
          ? void 0
          : B.trim();
      (v && sessionStorage.setItem("reportsJumpContainerNo", v), kn("list"));
    },
    X = o.filter((v) => {
      if (!v.itemId) return !1;
      const w = Number(v.listQty ?? 0);
      if (w <= 0) return !1;
      const B = Number(z[v.itemId] ?? 0);
      return w > B;
    });
  return s.jsxs("div", {
    className: "is-page",
    dir: "ltr",
    ref: ae,
    children: [
      g
        ? s.jsx("div", {
            className: "alert-error",
            style: { margin: 6 },
            children: g,
          })
        : null,
      s.jsx("div", { className: "is-titleline", children: "Purchase Vouchers" }),
      s.jsxs("div", {
        className: "is-top-wrap",
        ref: me,
        children: [
          s.jsxs("div", {
            className: "is-top-row",
            children: [
              s.jsx("button", {
                type: "button",
                className: "is-btn-edit",
                onClick: () => se((v) => !v),
                children: J ? "إغلاق" : "تعديل",
              }),
              s.jsx("span", { className: "is-lbl", children: "%0" }),
              s.jsx("span", {
                className: "is-lbl",
                children: "عمولة المكتب",
              }),
              s.jsx(
                "input",
                {
                  className: "is-small-input",
                  name: "officeCommission",
                  form: re,
                  readOnly: !J,
                  defaultValue: he(
                    (a == null ? void 0 : a.officeCommission) ?? "0",
                  ),
                },
                `oc-${r}-${a == null ? void 0 : a.updatedAt}`,
              ),
              s.jsx("span", {
                className: "is-lbl",
                children:
                  "سعر نقل المتر المكعب",
              }),
              s.jsx(
                "input",
                {
                  className: "is-small-input",
                  name: "cbmTransportPrice",
                  form: re,
                  readOnly: !J,
                  defaultValue: he(
                    (a == null ? void 0 : a.cbmTransportPrice) ?? "",
                  ),
                },
                `cbm-${r}-${a == null ? void 0 : a.updatedAt}`,
              ),
              s.jsx("div", { className: "is-spacer" }),
              s.jsx(
                "input",
                {
                  className: "is-rate-input",
                  name: "exchangeRate",
                  form: re,
                  readOnly: !J,
                  defaultValue: xe,
                },
                `er-${r}-${a == null ? void 0 : a.updatedAt}`,
              ),
              s.jsx("span", {
                className: "is-rate-lbl",
                children: "سعر الصرف",
              }),
            ],
          }),
          s.jsxs("form", {
            id: re,
            onSubmit: Re,
            children: [
              s.jsxs("div", {
                className: "is-mid-row",
                children: [
                  s.jsxs("div", {
                    className: "is-left-cluster",
                    children: [
                      s.jsxs("div", {
                        className: "is-balance-line",
                        children: [
                          s.jsx("span", {
                            className: "is-mini-title",
                            children: "المجموع",
                          }),
                          s.jsx("input", {
                            className: "is-balance-input",
                            value: he((d == null ? void 0 : d.total) ?? ""),
                            readOnly: !0,
                          }),
                        ],
                      }),
                      s.jsxs("div", {
                        className: "is-container-line",
                        children: [
                          s.jsx(
                            "select",
                            {
                              className: "is-container-input",
                              name: "containerId",
                              disabled: !J,
                              defaultValue:
                                (a == null ? void 0 : a.containerId) ?? "",
                              children: [
                                s.jsx("option", { value: "", children: "— بدون حاوية —" }),
                                ...C.map((v) =>
                                  s.jsx(
                                    "option",
                                    { value: v.id, children: br(v.containerNo) },
                                    v.id,
                                  ),
                                ),
                              ],
                            },
                            `ct-${r}-${a == null ? void 0 : a.updatedAt}`,
                          ),
                          s.jsx("span", {
                            className: "is-lbl",
                            children:
                              "رقم الحاوية",
                          }),
                        ],
                      }),
                      s.jsx("button", {
                        type: "button",
                        className: "is-blue-pill",
                        onClick: () =>
                          window.alert(`عملة السند: ${br((a == null ? void 0 : a.currency) ?? "—")}
سعر الصرف الحالي في النموذج: ${xe}`),
                        title: "عرض العملة وسعر الصرف",
                        children:
                          br((a == null ? void 0 : a.currency) ?? "العملة"),
                      }),
                    ],
                  }),
                  s.jsxs("div", {
                    className: "is-mini-actions",
                    children: [
                      s.jsx("button", {
                        type: "button",
                        className: "is-mini-act",
                        onClick: T,
                        children: "جديد",
                      }),
                      s.jsx("button", {
                        type: "button",
                        className: "is-mini-act red",
                        onClick: q,
                        children: "حذف",
                      }),
                    ],
                  }),
                  s.jsx(Zs, {
                    name: "customerId",
                    dir: "rtl",
                    className: "is-search-select",
                    inputClassName: "is-supplier-box",
                    disabled: !J,
                    value: y,
                    onChange: f,
                    options: k,
                    getOptionValue: (v) => v.id,
                    getOptionLabel: (v) => br(v.name),
                    placeholder: "اختر الزبون",
                    searchPlaceholder:
                      "ابحث عن زبون...",
                    clearLabel:
                      "— اختر الزبون —",
                    allowClear: !1,
                  }),
                  s.jsx("span", {
                    className: "is-lbl",
                    children: "الزبون",
                  }),
                  s.jsx("div", { className: "is-spacer" }),
                  s.jsx(
                    "input",
                    {
                      className: "is-date-input",
                      name: "voucherDate",
                      readOnly: !J,
                      placeholder: "dd/mm/yyyy",
                      defaultValue: Me,
                    },
                    `vd-${r}-${a == null ? void 0 : a.updatedAt}`,
                  ),
                  s.jsx("span", {
                    className: "is-lbl",
                    children: "تاريخ الفاتورة",
                  }),
                  s.jsxs("div", {
                    className: "is-voucher-stack",
                    children: [
                      s.jsx(
                        "input",
                        {
                          className: "is-voucher-input",
                          name: "voucherNo",
                          readOnly: !J,
                          defaultValue: br(ye),
                        },
                        `vn-${r}-${a == null ? void 0 : a.updatedAt}`,
                      ),
                      s.jsx("select", {
                        className: "is-voucher-list",
                        size: Math.min(5, Math.max(3, t.length || 3)),
                        value: r,
                        onChange: (v) => l(v.target.value),
                        children:
                          t.length === 0
                            ? s.jsx("option", {
                                value: "",
                                children: "—",
                              })
                            : t.map((v) =>
                                s.jsxs(
                                  "option",
                                  {
                                    value: v.id,
                                    children: [
                                      br(v.voucherNo),
                                      " (",
                                      br(v.currency),
                                      ")",
                                    ],
                                  },
                                  v.id,
                                ),
                              ),
                      }),
                    ],
                  }),
                  s.jsx("span", {
                    className: "is-lbl",
                    children: "القائمة",
                  }),
                  s.jsxs("div", {
                    className: "erp-workflow-row",
                    style: { gridColumn: "1 / -1" },
                    children: [
                      s.jsx(Id, {
                        status: a == null ? void 0 : a.documentStatus,
                      }),
                      (a == null ? void 0 : a.documentStatus) === "DRAFT" &&
                      ((e == null ? void 0 : e.role) === "DATA_ENTRY" ||
                        (e == null ? void 0 : e.role) === "ACCOUNTANT" ||
                        (e == null ? void 0 : e.role) === "ADMIN")
                        ? s.jsx("button", {
                            type: "button",
                            onClick: te,
                            children:
                              "إرسال للموافقة",
                          })
                        : null,
                      (a == null ? void 0 : a.documentStatus) === "SUBMITTED" &&
                      ((e == null ? void 0 : e.role) === "ACCOUNTANT" ||
                        (e == null ? void 0 : e.role) === "ADMIN")
                        ? s.jsxs(s.Fragment, {
                            children: [
                              s.jsx("button", {
                                type: "button",
                                onClick: Be,
                                children: "اعتماد",
                              }),
                              s.jsx("button", {
                                type: "button",
                                onClick: Se,
                                children: "رفض",
                              }),
                            ],
                          })
                        : null,
                    ],
                  }),
                  s.jsxs(
                    "select",
                    {
                      className: "is-currency-select",
                      name: "currency",
                      disabled: !J,
                      defaultValue: Ce,
                      children: [
                        s.jsx("option", {
                          value: "دولار",
                          children: "دولار",
                        }),
                        s.jsx("option", {
                          value: "دينار",
                          children: "دينار",
                        }),
                      ],
                    },
                    `cur-${r}-${a == null ? void 0 : a.updatedAt}`,
                  ),
                  s.jsx("span", {
                    className: "is-lbl",
                    children: "العملة",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-top-row third",
                children: [
                  s.jsx("div", { className: "is-spacer" }),
                  s.jsx(Zs, {
                    name: "storeId",
                    className: "is-search-select",
                    inputClassName: "is-store-select",
                    disabled: !J,
                    value: S,
                    onChange: b,
                    options: p,
                    getOptionValue: (v) => v.id,
                    getOptionLabel: (v) => br(v.name),
                    placeholder: "—",
                    searchPlaceholder: "ابحث عن مستودع...",
                    clearLabel: "— بدون مستودع —",
                  }),
                  s.jsx("span", {
                    className: "is-lbl",
                    children: "Store Target",
                  }),
                  s.jsx(
                    "input",
                    {
                      className: "is-notes-input",
                      name: "notes",
                      readOnly: !J,
                      defaultValue: br((a == null ? void 0 : a.notes) ?? ""),
                    },
                    `nt-${r}-${a == null ? void 0 : a.updatedAt}`,
                  ),
                  s.jsx("span", {
                    className: "is-lbl",
                    children: "ملاحظات",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-top-row",
                style: { marginTop: 8 },
                children: [
                  s.jsx("button", {
                    type: "submit",
                    className: "is-btn",
                    children: "حفظ الفاتورة",
                  }),
                  s.jsx("button", {
                    type: "button",
                    className: "is-item-btn green",
                    onClick: G,
                    children: "+ سطر",
                  }),
                  s.jsx("button", {
                    type: "button",
                    className: "is-item-btn red",
                    onClick: Ee,
                    disabled: !K,
                    children: "حذف سطر",
                  }),
                  s.jsx("button", {
                    type: "button",
                    className: "is-item-btn green",
                    onClick: Ne,
                    disabled: !K,
                    children: "تعديل سطر",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      s.jsx("div", {
        className: "is-table-wrap",
        ref: ze,
        children: s.jsxs("table", {
          className: "is-table",
          children: [
            s.jsx("thead", {
              children: s.jsxs("tr", {
                children: [
                  s.jsx("th", {}),
                  s.jsx("th", { children: "Item Code" }),
                  s.jsx("th", { children: "Item Image" }),
                  s.jsx("th", { children: "Item Details" }),
                  s.jsx("th", { children: "Pieces per Carton" }),
                  s.jsx("th", { children: "Cartons" }),
                  s.jsx("th", { children: "Total Pieces" }),
                ],
              }),
            }),
            s.jsx("tbody", {
              children:
                o.length === 0
                  ? s.jsx("tr", {
                      children: s.jsx("td", {
                        colSpan: 7,
                        style: { textAlign: "center", padding: 12 },
                        children: "لا توجد أسطر",
                      }),
                    })
                  : o.map((v) =>
                      s.jsxs(
                        "tr",
                        {
                          style: {
                            cursor: "pointer",
                            background: K === v.id ? "#e8f4ff" : void 0,
                          },
                          onClick: () => ie(v.id),
                          children: [
                            s.jsx("td", {
                              className: "is-arrow",
                              children: "▶",
                            }),
                            s.jsx("td", {
                              onDoubleClick: () => ne(v.id, "itemNo", v.itemNo),
                              children:
                                (j == null ? void 0 : j.lineId) === v.id &&
                                (j == null ? void 0 : j.field) === "itemNo"
                                  ? s.jsx("input", {
                                      autoFocus: !0,
                                      className: "is-mini-input",
                                      value: U,
                                      onChange: (w) => W(w.target.value),
                                      onBlur: Z,
                                      onKeyDown: (w) => {
                                        (w.key === "Enter" && Z(),
                                          w.key === "Escape" && _e());
                                      },
                                    })
                                  : br(v.itemNo ?? ""),
                            }),
                            s.jsx("td", {
                              children: "[Image]",
                            }),
                            s.jsx("td", {
                              className: "is-item-name",
                              onDoubleClick: () => ne(v.id, "detail", v.detail),
                              children:
                                (j == null ? void 0 : j.lineId) === v.id &&
                                (j == null ? void 0 : j.field) === "detail"
                                  ? s.jsx("input", {
                                      autoFocus: !0,
                                      className: "is-mini-input",
                                      value: U,
                                      onChange: (w) => W(w.target.value),
                                      onBlur: Z,
                                      onKeyDown: (w) => {
                                        (w.key === "Enter" && Z(),
                                          w.key === "Escape" && _e());
                                      },
                                    })
                                  : br(v.detail ?? ""),
                            }),
                            s.jsx("td", {
                              onDoubleClick: () =>
                                ne(v.id, "pcsInCarton", v.pcsInCarton),
                              children:
                                (j == null ? void 0 : j.lineId) === v.id &&
                                (j == null ? void 0 : j.field) === "pcsInCarton"
                                  ? s.jsx("input", {
                                      autoFocus: !0,
                                      className: "is-mini-input",
                                      value: U,
                                      onChange: (w) => W(w.target.value),
                                      onBlur: Z,
                                      onKeyDown: (w) => {
                                        (w.key === "Enter" && Z(),
                                          w.key === "Escape" && _e());
                                      },
                                    })
                                  : he(v.pcsInCarton),
                            }),
                            s.jsx("td", {
                              onDoubleClick: () =>
                                ne(v.id, "listQty", v.listQty),
                              children:
                                (j == null ? void 0 : j.lineId) === v.id &&
                                (j == null ? void 0 : j.field) === "listQty"
                                  ? s.jsx("input", {
                                      autoFocus: !0,
                                      className: "is-mini-input",
                                      value: U,
                                      onChange: (w) => W(w.target.value),
                                      onBlur: Z,
                                      onKeyDown: (w) => {
                                        (w.key === "Enter" && Z(),
                                          w.key === "Escape" && _e());
                                      },
                                    })
                                  : he(v.listQty),
                            }),
                            s.jsx("td", {
                              children: he((Number(v.pcsInCarton ?? 0) * Number(v.listQty ?? 0))),
                            }),
                          ],
                        },
                        v.id,
                      ),
                    ),
            }),
          ],
        }),
      }),
      R
        ? s.jsxs("div", {
            style: { marginTop: 6, fontSize: 12, color: "#334155" },
            children: [
              "Warehouse: ",
              s.jsx("strong", { children: br(R) }),
              " (",
              L.length,
              " items)",
            ],
          })
        : null,
      X.length > 0
        ? s.jsxs("div", {
            className: "alert-error",
            style: { marginTop: 6 },
            children: [
              "يوجد ",
              X.length,
              " سطر بيع بكمية أكبر من المتاح في المستودع المحدد.",
            ],
          })
        : null,
      s.jsxs("div", {
        className: "is-sum-row",
        children: [
          s.jsxs("div", {
            className: "is-sum-grid",
            children: [
              s.jsxs("div", {
                className: "is-sum-item",
                children: [
                  s.jsx("div", {
                    className: "is-sum-item-box",
                    children: he((F == null ? void 0 : F.totalPrice) ?? ""),
                  }),
                  s.jsx("div", {
                    className: "is-sum-item-label",
                    children: "Total Price",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-sum-item",
                children: [
                  s.jsx("div", {
                    className: "is-sum-item-box",
                    children: he((F == null ? void 0 : F.cbmSum) ?? ""),
                  }),
                  s.jsx("div", {
                    className: "is-sum-item-label",
                    children: "CBM Sum",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-sum-item",
                children: [
                  s.jsx("div", {
                    className: "is-sum-item-box",
                    children: he((F == null ? void 0 : F.listQty) ?? ""),
                  }),
                  s.jsx("div", {
                    className: "is-sum-item-label",
                    children: "List Qty",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-sum-item",
                children: [
                  s.jsx("div", {
                    className: "is-sum-item-box",
                    children: he(""),
                  }),
                  s.jsx("div", {
                    className: "is-sum-item-label",
                    children: "-",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-sum-item",
                children: [
                  s.jsx("div", {
                    className: "is-sum-item-box",
                    children: he((d == null ? void 0 : d.total) ?? ""),
                  }),
                  s.jsx("div", {
                    className: "is-sum-item-label",
                    children: "Total",
                  }),
                ],
              }),
            ],
          }),
          s.jsxs("div", {
            className: "is-accounting-row",
            children: [
              s.jsx("span", {
                className: "is-sum-label",
                children: "المحاسبة",
              }),
              s.jsx("input", {
                className: "is-sum-input yellow",
                value: he((a == null ? void 0 : a.accountingDebit) ?? "0"),
                readOnly: !0,
              }),
              s.jsx("span", {
                className: "is-sum-label",
                children:
                  "المحاسبة دائن/مدين",
              }),
            ],
          }),
        ],
      }),
      s.jsxs("div", {
        className: "is-sum-bottom",
        ref: pe,
        children: [
          s.jsxs("div", {
            className: "is-total-box",
            children: [
              s.jsxs("div", {
                className: "is-total-line",
                children: [
                  s.jsx("input", {
                    value: he((d == null ? void 0 : d.total) ?? ""),
                    readOnly: !0,
                  }),
                  s.jsx("span", {
                    children: "المجموع",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-total-line",
                children: [
                  s.jsx("input", {
                    value: he((d == null ? void 0 : d.paid) ?? ""),
                    readOnly: !0,
                  }),
                  s.jsx("span", { children: "المسدد" }),
                ],
              }),
              s.jsxs("div", {
                className: "is-total-line",
                children: [
                  s.jsx("input", {
                    value: he((d == null ? void 0 : d.remaining) ?? ""),
                    readOnly: !0,
                  }),
                  s.jsx("span", {
                    children:
                      "المجموع المتبقي",
                  }),
                ],
              }),
              s.jsxs("div", {
                className: "is-total-line",
                children: [
                  s.jsx("input", {
                    value: he((d == null ? void 0 : d.profit) ?? ""),
                    readOnly: !0,
                  }),
                  s.jsx("span", { children: "الأرباح" }),
                ],
              }),
            ],
          }),
          s.jsx("div", {
            className: "is-yellow-note",
            children:
              "بضاعة لهذا المستثمر",
          }),
        ],
      }),
      s.jsx(Dd, {
        mode: "sale",
        voucherId: r,
        line: o.find((v) => v.id === K),
        onSaved: () => ge(r),
      }),
      s.jsx(Ef, {
        voucherId: r,
        glJournalEntryId: a == null ? void 0 : a.glJournalEntryId,
        documentStatus: a == null ? void 0 : a.documentStatus,
        onPosted: () => ge(r),
      }),
      s.jsxs("div", {
        className: "is-bottom-actions",
        children: [
          s.jsx("button", {
            type: "button",
            className: "is-btn",
            onClick: T,
            children: "NEW",
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn red",
            onClick: q,
            children: "Delete",
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn",
            onClick: () => {
              var v;
              return (v = document.getElementById(re)) == null
                ? void 0
                : v.requestSubmit();
            },
            children: "Save",
          }),
          s.jsxs("button", {
            type: "button",
            className: "is-btn yellow",
            onClick: () => Vt(ae.current, { dir: "rtl", lang: "ar" }),
            children: [
              "طباعة",
              s.jsx("br", {}),
              "عربي",
            ],
          }),
          s.jsxs("button", {
            type: "button",
            className: "is-btn yellow",
            onClick: () => Vt(ae.current, { dir: "ltr", lang: "en" }),
            children: ["Print", s.jsx("br", {}), "EN"],
          }),
          s.jsxs("button", {
            type: "button",
            className: "is-btn yellow",
            onClick: $,
            children: ["Open Container", s.jsx("br", {}), "in List"],
          }),
          s.jsxs("button", {
            type: "button",
            className: "is-btn yellow",
            onClick: () => {
              const v = window.confirm(`موافق = نسخة Pride
إلغاء = نسخة Faqr`);
              Ja(ae.current, v ? "Pride copy" : "Faqr copy");
            },
            children: ["Pride", s.jsx("br", {}), "Faqr"],
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn",
            onClick: Dt,
            children: "Last Voucher",
          }),
          s.jsxs("button", {
            type: "button",
            className: "is-btn",
            onClick: I,
            children: ["Last Edited", s.jsx("br", {}), "Vouchers"],
          }),
          s.jsxs("button", {
            type: "button",
            className: "is-btn",
            onClick: () => r && ge(r),
            children: ["Reload Last", s.jsx("br", {}), "Voucher"],
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn green",
            onClick: () => {
              (se(!1), h(""), ie(""));
            },
            children: "X",
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn blue",
            onClick: N,
            children: "third",
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn blue",
            onClick: le,
            children: "second",
          }),
          s.jsx("button", {
            type: "button",
            className: "is-btn blue",
            onClick: H,
            children: "main",
          }),
        ],
      }),
    ],
  });
}

export default Rf;
