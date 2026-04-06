/**
 * لوحة شاملة: ربط بصري بين المخزن التشغيلي، المبيعات، المشتريات، والمحاسبة.
 */
export default function AccountingHubPage() {
  const go = (id) => {
    window.dispatchEvent(new CustomEvent("app:set-page", { detail: { page: id } }));
  };

  const sections = [
    {
      title: "التشغيل والمخزن",
      blurb: "الحاويات، الأصناف، والمخازن المرتبطة بالسندات",
      cards: [
        {
          page: "list",
          title: "الحاويات",
          desc: "عرض وتعديل الشحنات، بنود البضاعة، وتكاليف الحاوية — قلب التشغيل.",
          accent: "hub-accent--teal",
        },
        {
          page: "reports",
          title: "التقارير التشغيلية",
          desc: "جرد وتقارير حسب الحاوية والمبيعات والمخزون الظاهر.",
          accent: "hub-accent--slate",
        },
        {
          page: "customers",
          title: "إدارة الزبائن",
          desc: "إضافة وتعديل وحذف العملاء — يظهرون في الحاويات وفواتير البيع.",
          accent: "hub-accent--indigo",
        },
        {
          page: "stores",
          title: "المخازن والمستودعات",
          desc: "تعريف موقع واحد لكل من فواتير الشراء/البيع وجرد المخزون والأرصدة — يُنشأ المستودع تلقائياً مع المخزن.",
          accent: "hub-accent--emerald",
        },
        {
          page: "items",
          title: "الأصناف والباركود",
          desc: "كتالوج الأصناف، التصنيف، ووحدة القياس للمخزون.",
          accent: "hub-accent--amber",
        },
        {
          page: "stock",
          title: "أرصدة المخزون",
          desc: "عرض الكميات وتحويل البضاعة بين مواقع المخازن.",
          accent: "hub-accent--slate",
        },
        {
          page: "dashboard",
          title: "مؤشرات سريعة",
          desc: "مبيعات الشهر، الحاويات النشطة، وأعلى المخزون.",
          accent: "hub-accent--indigo",
        },
      ],
    },
    {
      title: "المشتريات والموردين",
      blurb: "فواتير الشراء مرتبطة بالحاوية والمورد",
      cards: [
        {
          page: "iv",
          title: "فواتير الشراء",
          desc: "سندات الموردين، الأسطر، والترحيل إلى المحاسبة العامة.",
          accent: "hub-accent--amber",
        },
        {
          page: "suppliers",
          title: "الموردون والتخليص",
          desc: "بيانات الموردين وشركات التخليص.",
          accent: "hub-accent--rose",
        },
      ],
    },
    {
      title: "المبيعات والزبائن",
      blurb: "فواتير البيع مرتبطة بالعميل والحاوية",
      cards: [
        {
          page: "is",
          title: "فواتير البيع",
          desc: "سندات العملاء، المجاميع، والربط مع الأستاذ العام.",
          accent: "hub-accent--indigo",
        },
      ],
    },
    {
      title: "المحاسبة والحركة المالية",
      blurb: "قيود، أستاذ، وحركات العملات الحالية",
      cards: [
        {
          page: "freports",
          title: "القوائم المالية والذمم",
          desc: "قائمة الدخل، الميزانية، كشف الحساب، وأعمار الذمم.",
          accent: "hub-accent--violet",
        },
        {
          page: "accounting",
          title: "حركات المحاسبة (لوحة العملات)",
          desc: "الشاشة الكلاسيكية متعددة العملات حتى يتم دمجها بالكامل مع GL.",
          accent: "hub-accent--cyan",
        },
        {
          page: "io",
          title: "إيرادات ومصاريف",
          desc: "تسجيل يومي مع إمكانية الترحيل للأستاذ العام.",
          accent: "hub-accent--rose",
        },
      ],
    },
    {
      title: "الموارد البشرية و CRM",
      blurb: "",
      cards: [
        {
          page: "hr",
          title: "الموارد البشرية",
          desc: "موظفون وسلف — قابل للتوسع لمسير الرواتب.",
          accent: "hub-accent--cyan",
        },
        {
          page: "crm",
          title: "CRM",
          desc: "عملاء محتملون وعروض أسعار.",
          accent: "hub-accent--indigo",
        },
      ],
    },
    {
      title: "المستندات والإدارة",
      blurb: "",
      cards: [
        {
          page: "official",
          title: "وثائق رسمية",
          desc: "مسودات وخطابات للطباعة.",
          accent: "hub-accent--violet",
        },
        {
          page: "settings",
          title: "إعدادات النظام",
          desc: "ترويسة، عملة افتراضية، وتهيئة JSON عامة.",
          accent: "hub-accent--slate",
        },
      ],
    },
  ];

  return (
    <div className="hub-page">
      <header className="hub-hero">
        <p className="hub-eyebrow">منصة متكاملة</p>
        <h1 className="hub-title">التشغيل · المخازن · الزبائن · الموردين · المحاسبة</h1>
        <p className="hub-lead">
          انتقل بسرعة بين الحاويات، فواتير الشراء والبيع، والمحاسبة العامة. المخازن والأطراف
          (زبائن/موردين) تُستخدم داخل شاشات الحاويات والفواتير؛ التقارير تعرض صورة المخزون
          التشغيلي حسب إعداداتك.
        </p>
      </header>

      {sections.map((sec) => (
        <section key={sec.title} className="hub-section">
          <div className="hub-section-head">
            <h2 className="hub-section-title">{sec.title}</h2>
            {sec.blurb ? <p className="hub-section-blurb">{sec.blurb}</p> : null}
          </div>
          <div className="hub-card-grid">
            {sec.cards.map((c) => (
              <button
                key={c.page}
                type="button"
                className="hub-card"
                onClick={() => go(c.page)}
              >
                <span className={`hub-card-accent ${c.accent}`} aria-hidden />
                <span className="hub-card-title">{c.title}</span>
                <span className="hub-card-desc">{c.desc}</span>
                <span className="hub-card-cta">فتح ←</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <footer className="hub-footnote">
        لتوسيع المخزون المحاسبي الكامل (جرد، دفعات، بنوك) راجع خطة النظام في وثيقة المواصفات
        داخل المشروع.
      </footer>
    </div>
  );
}
