/** ظ…ط¹ط±ظ‘ظپط§طھ ط§ظ„طµظپط­ط§طھ ط§ظ„ظ…ط³ظ…ظˆط­ط© ظ„ظ„طھظ†ظ‚ظ„ ظˆط§ظ„ط­ط¯ط« app:set-page */
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
  "pp",
  "suppliers",
  "official",
  "accounting",
  "io",
  "iv",
  "is",
  "freports",
  "hr",
  "crm",
  "settings",
]

/** ظ…ط¬ظ…ظˆط¹ط§طھ ط§ظ„ط´ط±ظٹط· ط§ظ„ط¬ط§ظ†ط¨ظٹ â€” ط¹ط±ط¨ظٹ ظˆط§ط¶ط­ */
export const NAV_GROUPS = [
  {
    title: "ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ…",
    items: [
      { id: "hub", label: "ظ†ط¸ط±ط© ط´ط§ظ…ظ„ط© (ط±ظˆط§ط¨ط·)" },
      { id: "dashboard", label: "ظ…ط¤ط´ط±ط§طھ ط§ظ„ط£ط¯ط§ط،" },
    ],
  },
  {
    title: "ط§ظ„طھط´ط؛ظٹظ„ ظˆط§ظ„ظ…ط®ط²ظ†",
    items: [
      { id: "list", label: "ط§ظ„ط­ط§ظˆظٹط§طھ" },
      { id: "reports", label: "ط§ظ„طھظ‚ط§ط±ظٹط±" },
      { id: "customers", label: "ط§ظ„ط²ط¨ط§ط¦ظ†" },
      { id: "stores", label: "ط§ظ„ظ…ط®ط§ط²ظ† ظˆط§ظ„ظ…ط³طھظˆط¯ط¹ط§طھ" },
      { id: "items", label: "ط§ظ„ط£طµظ†ط§ظپ" },
      { id: "stock", label: "ط£ط±طµط¯ط© ط§ظ„ظ…ط®ط²ظˆظ†" },
    ],
  },
  {
    title: "ط§ظ„ظ…ط´طھط±ظٹط§طھ ظˆط§ظ„ظ…ط¨ظٹط¹ط§طھ",
    items: [
      { id: "iv", label: "ظپظˆط§طھظٹط± ط§ظ„ط´ط±ط§ط،" },
      { id: "is", label: "ظپظˆط§طھظٹط± ط§ظ„ط¨ظٹط¹" },
      { id: "pp", label: "Purchase Products" },
      { id: "suppliers", label: "ط§ظ„ظ…ظˆط±ط¯ظˆظ† ظˆط§ظ„طھط®ظ„ظٹطµ" },
    ],
  },
  {
    title: "ط§ظ„ظ…ط­ط§ط³ط¨ط© ظˆط§ظ„ظ…ط§ظ„ظٹط©",
    items: [
      { id: "freports", label: "ط§ظ„ظ‚ظˆط§ط¦ظ… ظˆط§ظ„ط°ظ…ظ…" },
      { id: "accounting", label: "ط­ط±ظƒط§طھ ط§ظ„ط¹ظ…ظ„ط§طھ" },
      { id: "io", label: "ط¥ظٹط±ط§ط¯ / ظ…طµط±ظˆظپ" },
    ],
  },
  {
    title: "ط§ظ„ظ…ظˆط§ط±ط¯ ظˆط§ظ„ط¹ظ„ط§ظ‚ط§طھ",
    items: [
      { id: "hr", label: "ط§ظ„ظ…ظˆط§ط±ط¯ ط§ظ„ط¨ط´ط±ظٹط©" },
      { id: "crm", label: "ط¥ط¯ط§ط±ط© ط§ظ„ط¹ظ…ظ„ط§ط، (CRM)" },
    ],
  },
  {
    title: "ط§ظ„ظ…ط³طھظ†ط¯ط§طھ ظˆط§ظ„ط¥ط¯ط§ط±ط©",
    items: [
      { id: "official", label: "ظˆط«ط§ط¦ظ‚ ط±ط³ظ…ظٹط©" },
      { id: "settings", label: "ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ†ط¸ط§ظ…" },
    ],
  },
]

/** ط¹ظ†ط§طµط± طھظڈط®ظپظٹ ط¹ظ† ط£ظ…ظٹظ† ط§ظ„ظ…ط³طھظˆط¯ط¹ (ط¨ط¯ظˆظ† ط£ط³ط¹ط§ط± GL ظ…ط±ظƒط²ظٹط©) */
export const STORE_KEEPER_HIDDEN = new Set(["accounting", "freports", "settings"])

