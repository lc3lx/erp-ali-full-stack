import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      try {
        setData(await api.get("/finance/dashboard/kpis"));
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);
  if (err) return <div className="master-banner master-banner-err">{err}</div>;
  if (!data) return <div className="master-muted">جاري التحميل…</div>;
  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">لوحة المؤشرات</h2>
      <div className="master-layout" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <div className="master-panel" style={{ padding: 16 }}>
          <div className="master-muted">حاويات غير مغلقة</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.activeContainers}</div>
        </div>
        <div className="master-panel" style={{ padding: 16 }}>
          <div className="master-muted">مبيعات الشهر</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.monthSalesTotal?.toFixed?.(2) ?? data.monthSalesTotal}</div>
        </div>
        <div className="master-panel" style={{ padding: 16 }}>
          <div className="master-muted">مشتريات الشهر</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.monthPurchasesTotal?.toFixed?.(2) ?? data.monthPurchasesTotal}</div>
        </div>
        <div className="master-panel" style={{ padding: 16 }}>
          <div className="master-muted">نمو المبيعات (MoM)</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{Number(data.salesMoM ?? 0).toFixed(1)}%</div>
        </div>
        <div className="master-panel" style={{ padding: 16 }}>
          <div className="master-muted">نمو المشتريات (MoM)</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{Number(data.purchasesMoM ?? 0).toFixed(1)}%</div>
        </div>
      </div>
      <h3 className="master-form-title">أعلى الأرصدة المخزنية</h3>
      <ul>
        {(data.topStock ?? []).map((r, i) => (
          <li key={i}>
            {r.item} @ {r.warehouse}: {r.qty}
          </li>
        ))}
      </ul>
      <h3 className="master-form-title">المبيعات آخر 6 أشهر</h3>
      <div className="master-form">
        {(data.monthlySales ?? []).map((m) => {
          const max = Math.max(...(data.monthlySales ?? []).map((x) => Number(x.total || 0)), 1);
          const width = `${Math.max(8, (Number(m.total || 0) / max) * 100)}%`;
          return (
            <div key={m.month} style={{ marginBottom: 8 }}>
              <div className="master-muted">{m.month}</div>
              <div style={{ background: "#e2e8f0", height: 16, borderRadius: 6 }}>
                <div style={{ width, height: 16, borderRadius: 6, background: "#0d9488" }} />
              </div>
            </div>
          );
        })}
      </div>
      <h3 className="master-form-title">المشتريات آخر 6 أشهر</h3>
      <div className="master-form">
        {(data.monthlyPurchases ?? []).map((m) => {
          const max = Math.max(...(data.monthlyPurchases ?? []).map((x) => Number(x.total || 0)), 1);
          const width = `${Math.max(8, (Number(m.total || 0) / max) * 100)}%`;
          return (
            <div key={m.month} style={{ marginBottom: 8 }}>
              <div className="master-muted">{m.month}</div>
              <div style={{ background: "#e2e8f0", height: 16, borderRadius: 6 }}>
                <div style={{ width, height: 16, borderRadius: 6, background: "#6366f1" }} />
              </div>
            </div>
          );
        })}
      </div>
      <h3 className="master-form-title">صافي الحركة الشهرية (مبيعات - مشتريات)</h3>
      <ul>
        {(data.monthlyNet ?? []).map((n) => (
          <li key={n.month}>
            {n.month}: {Number(n.total ?? 0).toFixed(2)}
          </li>
        ))}
      </ul>
      <h3 className="master-form-title">الحاويات حسب الحالة</h3>
      <ul>
        {(data.containersByStatus ?? []).map((s) => (
          <li key={s.status}>
            {s.status}: {s.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
