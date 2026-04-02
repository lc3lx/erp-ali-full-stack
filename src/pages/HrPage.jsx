import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "../App.css";

export default function HrPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState("");
  const [loanPrincipal, setLoanPrincipal] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [salary, setSalary] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await api.get("/hr/employees");
      setItems(d.items ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/hr/employees", { fullName: name, phone, baseSalary: salary || null });
      setName("");
      setPhone("");
      setSalary("");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  const removeEmp = async (id) => {
    try {
      await api.delete(`/hr/employees/${id}`);
      if (selected === id) setSelected("");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  const addLoan = async () => {
    try {
      await api.post(`/hr/employees/${selected}/loans`, {
        principal: loanPrincipal,
        startDate: new Date().toISOString(),
      });
      setLoanPrincipal("");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  const deleteLoan = async (loanId) => {
    try {
      await api.delete(`/hr/loans/${loanId}`);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  return (
    <div className="master-page io-page" dir="rtl">
      <h2 className="master-title">الموارد البشرية</h2>
      {err ? <div className="master-banner master-banner-err">{err}</div> : null}
      <form className="master-form" onSubmit={add}>
        <label className="master-field">
          الاسم
          <input className="io-date-input master-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="master-field">
          هاتف
          <input className="io-date-input master-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="master-field">
          راتب أساسي
          <input className="io-date-input master-input" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </label>
        <button type="submit" className="io-btn-primary">
          إضافة موظف
        </button>
      </form>
      <table className="master-table">
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الراتب</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.fullName}</td>
              <td>{r.baseSalary != null ? String(r.baseSalary) : ""}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button type="button" className="io-btn" onClick={() => setSelected(r.id)}>
                  سلف
                </button>
                <button type="button" className="io-btn" onClick={() => removeEmp(r.id)}>
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected ? (
        <div className="master-form" style={{ marginTop: 12 }}>
          <h3 className="master-form-title">سلف الموظف</h3>
          <label className="master-field">
            المبلغ
            <input className="io-date-input master-input" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} />
          </label>
          <button type="button" className="io-btn-primary" onClick={addLoan} disabled={!loanPrincipal}>
            إضافة سلفة
          </button>
          <ul>
            {(items.find((x) => x.id === selected)?.loans ?? []).map((l) => (
              <li key={l.id}>
                أصل السلفة: {String(l.principal)}{" "}
                <button type="button" className="io-btn" onClick={() => deleteLoan(l.id)}>
                  حذف
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
