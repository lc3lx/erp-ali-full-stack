/** معرّفات الصفحات المسموحة للتنقل والحدث app:set-page */
export const ALL_PAGE_IDS = [
  "hub",
  "dashboard",
  "list",
  "reports",
  "customers",
  "stores",
  "items",
  "warehouses",
  "stock",
  "suppliers",
  "official",
  "finance",
  "accounting",
  "io",
  "iv",
  "is",
  "treasury",
  "freports",
  "hr",
  "crm",
  "settings",
]

/** مجموعات الشريط الجانبي — عربي واضح */
export const NAV_GROUPS = [
  {
    title: "لوحة التحكم",
    items: [
      { id: "hub", label: "نظرة شاملة (روابط)" },
      { id: "dashboard", label: "مؤشرات الأداء" },
    ],
  },
  {
    title: "التشغيل والمخزن",
    items: [
      { id: "list", label: "الحاويات" },
      { id: "reports", label: "التقارير" },
      { id: "customers", label: "الزبائن" },
      { id: "stores", label: "المخازن" },
      { id: "items", label: "الأصناف" },
      { id: "warehouses", label: "المستودعات" },
      { id: "stock", label: "أرصدة المخزون" },
    ],
  },
  {
    title: "المشتريات والمبيعات",
    items: [
      { id: "iv", label: "فواتير الشراء" },
      { id: "is", label: "فواتير البيع" },
      { id: "suppliers", label: "الموردون والتخليص" },
    ],
  },
  {
    title: "المحاسبة والمالية",
    items: [
      { id: "finance", label: "المحاسبة العامة" },
      { id: "treasury", label: "الصناديق والخزينة" },
      { id: "freports", label: "القوائم والذمم" },
      { id: "accounting", label: "حركات العملات" },
      { id: "io", label: "إيراد / مصروف" },
    ],
  },
  {
    title: "الموارد والعلاقات",
    items: [
      { id: "hr", label: "الموارد البشرية" },
      { id: "crm", label: "إدارة العملاء (CRM)" },
    ],
  },
  {
    title: "المستندات والإدارة",
    items: [
      { id: "official", label: "وثائق رسمية" },
      { id: "settings", label: "إعدادات النظام" },
    ],
  },
]

/** عناصر تُخفي عن أمين المستودع (بدون أسعار GL مركزية) */
export const STORE_KEEPER_HIDDEN = new Set(["finance", "accounting", "treasury", "freports", "settings"])
