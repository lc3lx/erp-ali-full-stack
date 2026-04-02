/** @param {string} pageId */
export function navigateAppPage(pageId) {
  window.dispatchEvent(new CustomEvent("app:set-page", { detail: { page: pageId } }));
}

/** يُحدَّث القوائم المنسدلة في الحاويات والفواتير دون إعادة تحميل الصفحة */
export const MASTERS_REFRESH_EVENT = "app:masters-refresh";

/** @param {'customers' | 'stores' | 'all'} scope */
export function dispatchMastersRefresh(scope) {
  window.dispatchEvent(new CustomEvent(MASTERS_REFRESH_EVENT, { detail: { scope } }));
}

/**
 * طباعة مع اتجاه/لغة مؤقتة ثم إرجاع الوضع (afterprint).
 * @param {HTMLElement | null | undefined} rootEl عنصر المحتوى (اختياري)
 * @param {{ dir?: 'ltr' | 'rtl'; lang?: string }} opts
 */
export function printRootWithLocale(rootEl, opts = {}) {
  const dir = opts.dir ?? "ltr";
  const lang = opts.lang ?? (dir === "rtl" ? "ar" : "en");
  const html = document.documentElement;
  const prevHtmlDir = html.getAttribute("dir");
  const prevHtmlLang = html.getAttribute("lang");
  const prevRootDir = rootEl?.getAttribute("dir");

  html.setAttribute("dir", dir);
  html.setAttribute("lang", lang);
  if (rootEl) rootEl.setAttribute("dir", dir);

  const restore = () => {
    if (prevHtmlDir) html.setAttribute("dir", prevHtmlDir);
    else html.removeAttribute("dir");
    if (prevHtmlLang) html.setAttribute("lang", prevHtmlLang);
    else html.removeAttribute("lang");
    if (rootEl) {
      if (prevRootDir) rootEl.setAttribute("dir", prevRootDir);
      else rootEl.removeAttribute("dir");
    }
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

/**
 * يضيف شريطاً مؤقتاً ثم يطبع (مثلاً نسخة زبون/مورد).
 * @param {HTMLElement | null | undefined} rootEl
 * @param {string} bannerText
 */
export function printWithBanner(rootEl, bannerText) {
  if (!rootEl) {
    window.print();
    return;
  }
  const banner = document.createElement("div");
  banner.setAttribute("data-print-banner", "1");
  banner.style.cssText =
    "padding:10px;margin-bottom:8px;text-align:center;font-weight:bold;border:1px solid #333;background:#f5f5f5;";
  banner.textContent = bannerText;
  rootEl.prepend(banner);
  const cleanup = () => {
    banner.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

/** @param {string} filename @param {string} text */
export function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  const bom = "\ufeff";
  const blob = new Blob([bom + text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** @param {string} v */
export function escapeCsv(v) {
  const t = String(v ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}
