"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Modal from "@/components/ui/Modal";
import DeleteConfirm from "@/components/ui/DeleteConfirm";
import { useToast, Toaster } from "@/components/ui/Toast";
import type { Expense } from "@/types";
import { api } from "@/lib/api";
import styles from "./Expenses.module.css";

const ExpenseTrendChart = dynamic(
    () => import("@/components/charts/ExpenseTrendChart"),
    { ssr: false },
);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const categoryBadge: Record<string, string> = {
    Salaries: "bi", Software: "bg", Freelancers: "ba", Rent: "bb", Marketing: "br",
};
const typeBadge: Record<string, string> = { Fixed: "bb", Variable: "ba" };
const catColors: Record<string, string> = {
    Salaries: "var(--indigo)", Freelancers: "var(--emerald)", Rent: "var(--blue)",
    Software: "var(--amber)", Marketing: "var(--red)", "Content Shoots": "var(--amber)",
    Travel: "var(--blue)", Utilities: "var(--text3)", Miscellaneous: "var(--text3)",
};

const emptyForm = {
    date: "", category: "Salaries", vendor: "", amount: "",
    payMethod: "Bank Transfer", type: "Fixed", description: "", recurring: false, dueDate: "",
};

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function expenseStatus(exp: Expense): 'paid' | 'overdue' | 'due-soon' | 'pending' | 'none' {
    if (exp.paid) return 'paid';
    if (!exp.dueDate) return 'none';
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(exp.dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0)  return 'overdue';
    if (diffDays <= 5) return 'due-soon';
    return 'pending';
}

function fmt(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
}

function nowMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(m: string, delta: number) {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonth(m: string) {
    const [y, mo] = m.split("-");
    return `${MONTHS[Number(mo) - 1]} ${y}`;
}

export default function Expenses() {
    const { toasts, dismiss, toast } = useToast();

    const [expenses, setExpenses]   = useState<Expense[]>([]);
    const [loaded, setLoaded]       = useState(false);
    const [isOpen, setIsOpen]       = useState(false);
    const [editing, setEditing]     = useState<Expense | null>(null);
    const [form, setForm]           = useState(emptyForm);
    const [catFilter, setCatFilter] = useState("All Categories");
    const [deleteId, setDeleteId]   = useState<string | null>(null);
    const [deleting, setDeleting]   = useState(false);
    const [month, setMonth]         = useState(nowMonth);
    const [applying, setApplying]   = useState(false);
    const [payExpense, setPayExpense] = useState<Expense | null>(null);
    const [paidDate, setPaidDate]     = useState('');
    const [paidAmount, setPaidAmount] = useState('');

    function load() {
        setLoaded(false);
        api.getExpenses({ month })
            .then((d) => { setExpenses(d as Expense[]); setLoaded(true); })
            .catch(() => setLoaded(true));
    }

    useEffect(() => { load(); }, [month]);

    const displayed = catFilter === "All Categories"
        ? expenses
        : expenses.filter((e) => e.category === catFilter);

    function openAdd() {
        setEditing(null);
        const d = new Date();
        const defaultDate = `${month}-${String(d.getDate()).padStart(2, "0")}`;
        setForm({ ...emptyForm, date: defaultDate });
        setIsOpen(true);
    }

    function openEdit(e: Expense) {
        setEditing(e);
        setForm({
            date: e.date, category: e.category, vendor: e.vendor || "",
            amount: String(e.amount), payMethod: e.payMethod || "Bank Transfer",
            type: e.type, description: e.description || "", recurring: e.recurring ?? false,
            dueDate: e.dueDate || "",
        });
        setIsOpen(true);
    }

    function openPayModal(exp: Expense) {
        setPaidDate(todayStr());
        setPaidAmount(String(exp.amount));
        setPayExpense(exp);
    }

    async function confirmMarkPaid() {
        if (!payExpense) return;
        try {
            const updated = await api.updateExpense(payExpense._id, { paid: true, paidDate, amount: Number(paidAmount) || payExpense.amount });
            setExpenses(prev => prev.map(e => e._id === payExpense._id ? updated as Expense : e));
            toast.success(`${payExpense.vendor || payExpense.category} marked as paid.`);
        } catch (e: unknown) {
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Something went wrong.'}`);
        }
        setPayExpense(null);
    }

    const save = async () => {
        if (!form.amount) { toast.error("Amount is required."); return; }
        try {
            const payload = { ...form, amount: Number(form.amount) };
            if (editing) {
                const updated = await api.updateExpense(editing._id, payload);
                setExpenses((prev) => prev.map((e) => e._id === editing._id ? (updated as Expense) : e));
                toast.success("Expense updated.");
            } else {
                const created = await api.createExpense(payload);
                setExpenses((prev) => [created as Expense, ...prev]);
                toast.success("Expense added.");
            }
            setIsOpen(false);
        } catch (e: unknown) {
            toast.error(`Failed to save: ${e instanceof Error ? e.message : "Something went wrong."}`);
        }
    };

    async function confirmDelete() {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await api.deleteExpense(deleteId);
            setExpenses((prev) => prev.filter((e) => e._id !== deleteId));
            toast.success("Expense deleted.");
        } catch (e: unknown) {
            toast.error(`Delete failed: ${e instanceof Error ? e.message : "Something went wrong."}`);
        }
        setDeleting(false);
        setDeleteId(null);
    }

    async function applyRecurring() {
        setApplying(true);
        try {
            const res = await api.applyRecurringExpenses(month) as { created: number; expenses: Expense[] };
            if (res.created === 0) {
                toast.info("No new recurring expenses to apply for this month.");
            } else {
                load();
                toast.success(`${res.created} recurring expense${res.created !== 1 ? "s" : ""} applied.`);
            }
        } catch (e: unknown) {
            toast.error(`Failed: ${e instanceof Error ? e.message : "Something went wrong."}`);
        }
        setApplying(false);
    }

    const total          = expenses.reduce((s, e) => s + e.amount, 0);
    const fixed          = expenses.filter((e) => e.type === "Fixed").reduce((s, e) => s + e.amount, 0);
    const variable       = expenses.filter((e) => e.type === "Variable").reduce((s, e) => s + e.amount, 0);
    const recurringCount = expenses.filter(e => e.recurring).length;
    const recurringTotal = expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0);

    const catTotals = expenses.reduce(
        (acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; },
        {} as Record<string, number>,
    );
    const catBars = Object.entries(catTotals).sort(([, a], [, b]) => b - a).slice(0, 7);
    const maxCat  = catBars[0]?.[1] || 1;
    const largest = catBars[0];

    return (
        <div>
            <div className="topbar">
                <div className="topbar-title">Expense Management</div>
                <div className="topbar-right">
                    <div className="fp">
                        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                            <option>All Categories</option>
                            <option>Salaries</option>
                            <option>Rent</option>
                            <option>Software</option>
                            <option>Freelancers</option>
                            <option>Marketing</option>
                            <option>Content Shoots</option>
                            <option>Travel</option>
                            <option>Utilities</option>
                        </select>
                    </div>
                    <button className="btn btn-p" onClick={openAdd}>
                        <i className="ti ti-plus" /> Add Expense
                    </button>
                </div>
            </div>

            <div className="content">
                {/* Month navigator */}
                <div className={styles.monthNav}>
                    <button className={`btn ${styles.monthBtn}`} onClick={() => setMonth(m => shiftMonth(m, -1))}>
                        <i className="ti ti-chevron-left" />
                    </button>
                    <span className={styles.monthLabel}>{fmtMonth(month)}</span>
                    <button className={`btn ${styles.monthBtn}`} onClick={() => setMonth(m => shiftMonth(m, 1))}>
                        <i className="ti ti-chevron-right" />
                    </button>
                    <button
                        className={`btn ${styles.applyBtn}`}
                        onClick={applyRecurring}
                        disabled={applying}
                        title="Copy recurring expenses from previous month into this month"
                    >
                        <i className={`ti ${applying ? "ti-loader-2" : "ti-refresh"}`} />
                        Apply Recurring
                    </button>
                    <button className={`btn ${styles.todayBtn}`} onClick={() => setMonth(nowMonth())}>
                        Today
                    </button>
                </div>

                {/* KPIs */}
                <div className={`grid4 ${styles.grid4mb}`}>
                    <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
                        <div className="kpi-label">Total Expenses</div>
                        <div className="kpi-value">{total > 0 ? fmt(total) : "—"}</div>
                        <div className={`kpi-change ${styles.kpiChangeSub}`}>{fmtMonth(month)}</div>
                    </div>
                    <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-blue)', '--kpi-tint-border': 'var(--kpi-blue-border)' } as React.CSSProperties}>
                        <div className="kpi-label">Fixed Costs</div>
                        <div className="kpi-value">{fixed > 0 ? fmt(fixed) : "—"}</div>
                        <div className={`kpi-change ${styles.kpiChangeSub}`}>
                            {total > 0 ? Math.round((fixed / total) * 100) : 0}% of total
                        </div>
                    </div>
                    <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
                        <div className="kpi-label">Variable Costs</div>
                        <div className="kpi-value">{variable > 0 ? fmt(variable) : "—"}</div>
                        <div className={`kpi-change ${styles.kpiChangeSub}`}>
                            {total > 0 ? Math.round((variable / total) * 100) : 0}% of total
                        </div>
                    </div>
                    <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-indigo)', '--kpi-tint-border': 'var(--kpi-indigo-border)' } as React.CSSProperties}>
                        <div className="kpi-label">Recurring</div>
                        <div className="kpi-value">{recurringTotal > 0 ? fmt(recurringTotal) : "—"}</div>
                        <div className={`kpi-change ${styles.kpiChangeSub}`}>
                            {recurringCount} recurring {recurringCount === 1 ? "entry" : "entries"}
                        </div>
                    </div>
                </div>

                <div className="grid2">
                    <div className="card">
                        <div className="card-title">Expense by Category</div>
                        {catBars.length === 0 ? (
                            <div className={styles.emptySmall}>No expense data yet</div>
                        ) : (
                            catBars.map(([label, amt]) => (
                                <div key={label} className="bar-row">
                                    <span className="bar-label">{label}</span>
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ width: `${Math.round((amt / maxCat) * 100)}%`, background: catColors[label] || "var(--text3)" }} />
                                    </div>
                                    <span className="bar-val">{fmt(amt)}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="card">
                        <div className="card-title">
                            Expense Trend <span className="card-sub">Last 6 months</span>
                        </div>
                        <div className="cw"><ExpenseTrendChart /></div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-title">
                        Expenses — {fmtMonth(month)}
                        {largest && <span className="card-sub">Largest: {largest[0]} · {fmt(largest[1])}</span>}
                    </div>
                    {!loaded ? (
                        <div className={styles.emptySmall}>Loading…</div>
                    ) : displayed.length === 0 ? (
                        <div className={styles.emptyCenter}>
                            <div className={styles.emptyCenterMsg}>
                                {catFilter !== "All Categories"
                                    ? `No ${catFilter} expenses in ${fmtMonth(month)}`
                                    : `No expenses in ${fmtMonth(month)}`}
                            </div>
                            {catFilter === "All Categories" && (
                                <button className="btn btn-p" onClick={openAdd}>
                                    <i className="ti ti-plus" /> Add first expense
                                </button>
                            )}
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th><th>Category</th><th>Vendor</th>
                                    <th>Description</th><th>Amount</th><th>Type</th>
                                    <th>Status</th><th />
                                </tr>
                            </thead>
                            <tbody>
                                {displayed.map((exp) => {
                                    const status = expenseStatus(exp);
                                    return (
                                        <tr key={exp._id}>
                                            <td>{exp.date}</td>
                                            <td>
                                                <div className={styles.catCell}>
                                                    <span className={`badge ${categoryBadge[exp.category] || "bb"}`}>
                                                        {exp.category}
                                                    </span>
                                                    {exp.recurring && (
                                                        <span className={styles.recurringBadge} title="Recurring">
                                                            <i className="ti ti-refresh" /> Recurring
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{exp.vendor || "—"}</td>
                                            <td>{exp.description || "—"}</td>
                                            <td className={styles.amountCell}>₹{exp.amount.toLocaleString("en-IN")}</td>
                                            <td>
                                                <span className={`badge ${typeBadge[exp.type]}`}>{exp.type}</span>
                                            </td>
                                            <td>
                                                {status === 'none' ? <span className={styles.statusNone}>—</span> : (
                                                    <span className={`${styles.statusBadge} ${styles['status_' + status]}`}>
                                                        {status === 'paid' && <i className="ti ti-check" />}
                                                        {status === 'overdue' && <i className="ti ti-alert-circle" />}
                                                        {status === 'due-soon' && <i className="ti ti-clock" />}
                                                        {status === 'pending' && <i className="ti ti-calendar" />}
                                                        {status === 'paid' ? 'Paid' : status === 'overdue' ? 'Overdue' : status === 'due-soon' ? 'Due Soon' : 'Pending'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className={styles.actionRow}>
                                                    {status !== 'paid' && (
                                                        <button className={`btn ${styles.btnSmGreen}`} title="Mark as Paid" onClick={() => openPayModal(exp)}>
                                                            <i className={`ti ti-check ${styles.iconSm}`} />
                                                        </button>
                                                    )}
                                                    <button className={`btn ${styles.btnSm}`} title="Edit" onClick={() => openEdit(exp)}>
                                                        <i className={`ti ti-pencil ${styles.iconSm}`} />
                                                    </button>
                                                    <button className={`btn ${styles.btnSmRed}`} title="Delete" onClick={() => setDeleteId(exp._id)}>
                                                        <i className={`ti ti-trash ${styles.iconSm}`} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <Modal title={editing ? "Edit Expense" : "Add Expense"} isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={save}>
                <div className="form-row">
                    <div>
                        <label className="form-label">Date</label>
                        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="form-label">Category</label>
                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                            <option>Salaries</option><option>Rent</option><option>Software</option>
                            <option>Freelancers</option><option>Marketing</option><option>Content Shoots</option>
                            <option>Travel</option><option>Pantry</option><option>Utilities</option><option>Miscellaneous</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div>
                        <label className="form-label">Vendor</label>
                        <input placeholder="Vendor name" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                    </div>
                    <div>
                        <label className="form-label">Amount (₹)</label>
                        <input type="number" placeholder="50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div>
                        <label className="form-label">Payment Method</label>
                        <select value={form.payMethod} onChange={(e) => setForm({ ...form, payMethod: e.target.value })}>
                            <option>Bank Transfer</option><option>UPI</option><option>Cash</option><option>Card</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Type</label>
                        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            <option>Fixed</option><option>Variable</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className={styles.descField}>
                        <label className="form-label">Description</label>
                        <input placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div>
                        <label className="form-label">Due Date <span className={styles.optionalLabel}>(optional)</span></label>
                        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                    </div>
                </div>
                <div className={styles.recurringRow}>
                    <label className={styles.recurringLabel}>
                        <input
                            type="checkbox"
                            checked={form.recurring}
                            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                            className={styles.recurringCheck}
                        />
                        <div>
                            <span className={styles.recurringTitle}>Recurring expense</span>
                            <span className={styles.recurringSub}>Repeats every month — use &quot;Apply Recurring&quot; to copy to a new month</span>
                        </div>
                    </label>
                </div>
            </Modal>

            {deleteId && (
                <DeleteConfirm
                    title="Delete Expense"
                    message="This will permanently delete this expense. This cannot be undone."
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteId(null)}
                    loading={deleting}
                />
            )}

            {payExpense && (
                <div className="modal-overlay" onClick={() => setPayExpense(null)}>
                    <div className={`modal ${styles.payModal}`} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Mark as Paid</div>
                            <button className="modal-close" onClick={() => setPayExpense(null)}>
                                <i className="ti ti-x" />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className={styles.payDetails}>
                                <div className={styles.payRow}>
                                    <span className={styles.payLabel}>Vendor</span>
                                    <span className={styles.payValue}>{payExpense.vendor || "—"}</span>
                                </div>
                                <div className={styles.payRow}>
                                    <span className={styles.payLabel}>Category</span>
                                    <span className={styles.payValue}>{payExpense.category}</span>
                                </div>
                                <div className={styles.payRow}>
                                    <span className={styles.payLabel}>Amount (₹)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className={`form-input ${styles.payAmountInput}`}
                                        value={paidAmount}
                                        onChange={e => setPaidAmount(e.target.value)}
                                    />
                                </div>
                                {payExpense.dueDate && (
                                    <div className={styles.payRow}>
                                        <span className={styles.payLabel}>Due Date</span>
                                        <span className={styles.payValue}>{payExpense.dueDate}</span>
                                    </div>
                                )}
                            </div>
                            <div className={styles.payDateRow}>
                                <label className="form-label">Payment Date</label>
                                <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setPayExpense(null)}>Cancel</button>
                            <button className="btn btn-p" onClick={confirmMarkPaid}>
                                <i className="ti ti-check" /> Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toaster toasts={toasts} dismiss={dismiss} />
        </div>
    );
}
