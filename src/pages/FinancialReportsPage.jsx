import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function FinancialReportsPage() {
  const [tab, setTab] = useState("is");
  const [err, setErr] = useState("");
  const [out, setOut] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asOf, setAsOf] = useState("");
  const [partyId, setPartyId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [parties, setParties] = useState([]);
  const [containers, setContainers] = useState([]);

  const loadLookups = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api.get("/parties", { page: 1, pageSize: 500 }),
        api.get("/containers", { page: 1, pageSize: 500 }),
      ]);
      setParties(p.items ?? []);
      setContainers(c.items ?? []);
    } catch {
      /* يبقى الحقل اليدوي متاحاً */
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const run = async () => {
    setErr("");
    setOut(null);
    try {
      if (tab === "is") {
        const d = await api.get("/finance/reports/income-statement", { from, to });
        setOut(d);
      } else if (tab === "bs") {
        const d = await api.get("/finance/reports/balance-sheet", { asOf });
        setOut(d);
      } else if (tab === "cf") {
        const d = await api.get("/finance/reports/cash-flow", { from, to });
        setOut(d);
      } else if (tab === "soa") {
        const d = await api.get("/finance/reports/statement-of-account", { partyId, from, to });
        setOut(d);
      } else if (tab === "aging") {
        const d = await api.get("/finance/reports/aging", { partyId, asOf });
        setOut(d);
      } else if (tab === "cont") {
        const d = await api.get(`/finance/reports/container-pnl/${containerId}`);
        setOut(d);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">القوائم المالية والذمم</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      <div className="master-toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
        {[
          ["is", "قائمة الدخل"],
          ["bs", "الميزانية العمومية"],
          ["cf", "تدفقات نقدية"],
          ["soa", "كشف حساب"],
          ["aging", "أعمار الذمم"],
          ["cont", "ربحية حاوية"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={tab === k ? "io-btn-primary" : "io-btn"}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="master-form">
        {(tab === "is" || tab === "cf" || tab === "soa") && (
          <>
            <label className="master-field">
              من <input type="date" className="io-date-input master-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="master-field">
              إلى <input type="date" className="io-date-input master-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        {(tab === "bs" || tab === "aging") && (
          <label className="master-field">
            كما في <input type="date" className="io-date-input master-input" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </label>
        )}
        {(tab === "soa" || tab === "aging") && (
          <>
            <label className="master-field">
              الطرف (زبون / مورد / تخليص)
              <select
                className="io-date-input master-input"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
              >
                <option value="">— اختر —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="master-field">
              أو أدخل UUID يدوياً
              <input className="io-date-input master-input" dir="ltr" value={partyId} onChange={(e) => setPartyId(e.target.value)} />
            </label>
          </>
        )}
        {tab === "cont" && (
          <>
            <label className="master-field">
              الحاوية
              <select
                className="io-date-input master-input"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
              >
                <option value="">— اختر —</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.containerNo ?? c.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="master-field">
              أو معرّف الحاوية (UUID)
              <input className="io-date-input master-input" dir="ltr" value={containerId} onChange={(e) => setContainerId(e.target.value)} />
            </label>
          </>
        )}
        <button type="button" className="io-btn-primary" onClick={run}>
          عرض
        </button>
      </div>

      {out ? (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f4f4f5",
            overflow: "auto",
            fontSize: 12,
            direction: "ltr",
            textAlign: "left",
          }}
        >
          {JSON.stringify(out, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
