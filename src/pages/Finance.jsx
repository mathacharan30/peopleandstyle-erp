import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch, formatDate, formatCurrency } from '../utils/helpers';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchInput from '../components/ui/SearchInput';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card'];

function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function IncomeForm({ defaultValues, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Date" type="date" required
          error={errors.date?.message}
          {...register('date', { required: 'Date is required' })}
        />
        <Input
          label="Amount (₹)" type="number" placeholder="0" required
          error={errors.amount?.message}
          {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })}
        />
        <div className="sm:col-span-2">
          <Select
            label="Payment Method"
            options={PAYMENT_METHODS} placeholder="Select method"
            {...register('paymentMethod')}
          />
        </div>
      </div>
      <Textarea label="Description" placeholder="Notes..." {...register('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Income
        </Button>
      </div>
    </form>
  );
}

function ExpenseForm({ defaultValues, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Date" type="date" required
          error={errors.date?.message}
          {...register('date', { required: 'Date is required' })}
        />
        <Input
          label="Amount (₹)" type="number" placeholder="0" required
          error={errors.amount?.message}
          {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })}
        />
        <Select
          label="Payment Method"
          options={PAYMENT_METHODS} placeholder="Select method"
          {...register('paymentMethod')}
        />
        <Input label="Paid To" placeholder="Vendor / Person name" {...register('paidTo')} />
      </div>
      <Textarea label="Description" placeholder="Describe what this expense was for..." {...register('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Expense
        </Button>
      </div>
    </form>
  );
}

const BOOKING_SOURCES = ['Booking Rent', 'Commission', 'Deposit Received', 'Advance'];

function IncomeTab() {
  const { data, loading, add, update, remove } = useFirestore('income');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const bySource = useMemo(() => {
    if (sourceFilter === 'sales') return data.filter((r) => r.source === 'Sale');
    if (sourceFilter === 'bookings') return data.filter((r) => BOOKING_SOURCES.includes(r.source));
    if (sourceFilter === 'other') return data.filter((r) => !BOOKING_SOURCES.includes(r.source) && r.source !== 'Sale');
    return data;
  }, [data, sourceFilter]);

  const filtered = filterBySearch(bySource, search, ['source', 'description', 'reference', 'paymentMethod']);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = { ...formData, amount: Number(formData.amount), source: editing?.source || 'Miscellaneous' };
      editing ? await update(editing.id, payload) : await add(payload);
      toast.success(editing ? 'Income updated' : 'Income added');
      closeModal();
    } catch { toast.error('Something went wrong'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Income deleted');
      setDeleteTarget(null);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'sales', label: 'Sales' },
    { key: 'other', label: 'Other' },
  ];

  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search income..." />
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSourceFilter(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
                  ${sourceFilter === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Add Income
        </Button>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState
          title="No income records"
          description={search || sourceFilter !== 'all' ? 'Try a different search or filter' : 'Record your first income entry'}
          action={!search && sourceFilter === 'all' && <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Income</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Source', 'Description', 'Reference', 'Payment', 'Amount', 'Actions'].map((h) => (
                  <th key={h} className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.source}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{r.description || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{r.reference || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.paymentMethod || '—'}</td>
                  <td className="px-5 py-3 font-semibold text-green-600 whitespace-nowrap">{formatCurrency(r.amount)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Income' : 'Add Income'} size="md">
        <IncomeForm defaultValues={editing} onSubmit={handleSubmit} onCancel={closeModal} loading={submitting} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Income" message="Remove this income record? This cannot be undone." />
    </>
  );
}

function ExpenseTab() {
  const { data, loading, add, update, remove } = useFirestore('expenses');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const bySource = useMemo(() => {
    if (sourceFilter === 'bookings') return data.filter((r) => r.reference);
    if (sourceFilter === 'other') return data.filter((r) => !r.reference);
    return data;
  }, [data, sourceFilter]);

  const filtered = filterBySearch(bySource, search, ['description', 'paidTo', 'paymentMethod']);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = { ...formData, amount: Number(formData.amount) };
      editing ? await update(editing.id, payload) : await add(payload);
      toast.success(editing ? 'Expense updated' : 'Expense added');
      closeModal();
    } catch { toast.error('Something went wrong'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Expense deleted');
      setDeleteTarget(null);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'other', label: 'Other' },
  ];

  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search expenses..." />
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSourceFilter(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
                  ${sourceFilter === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="danger" onClick={openAdd}>
          <Plus size={16} /> Add Expense
        </Button>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState
          title="No expense records"
          description={search || sourceFilter !== 'all' ? 'Try a different search or filter' : 'Record your first expense'}
          action={!search && sourceFilter === 'all' && <Button variant="danger" onClick={openAdd} size="sm"><Plus size={14} /> Add Expense</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Description', 'Paid To', 'Reference', 'Payment', 'Amount', 'Actions'].map((h) => (
                  <th key={h} className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{r.description || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.paidTo || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{r.reference || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.paymentMethod || '—'}</td>
                  <td className="px-5 py-3 font-semibold text-red-600 whitespace-nowrap">{formatCurrency(r.amount)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Expense' : 'Add Expense'} size="md">
        <ExpenseForm defaultValues={editing} onSubmit={handleSubmit} onCancel={closeModal} loading={submitting} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Expense" message="Remove this expense record? This cannot be undone." />
    </>
  );
}

export default function Finance() {
  const [tab, setTab] = useState('income');
  const { data: incomeData } = useFirestore('income');
  const { data: expenseData } = useFirestore('expenses');

  const totalIncome = useMemo(() => incomeData.reduce((s, r) => s + (Number(r.amount) || 0), 0), [incomeData]);
  const totalExpenses = useMemo(() => expenseData.reduce((s, r) => s + (Number(r.amount) || 0), 0), [expenseData]);
  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Finance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track income and expenses</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={TrendingUp} label="Total Income" value={formatCurrency(totalIncome)} color="green" />
        <SummaryCard icon={TrendingDown} label="Total Expenses" value={formatCurrency(totalExpenses)} color="red" />
        <SummaryCard icon={Wallet} label="Net Balance" value={formatCurrency(netBalance)} color="green" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          <button
            onClick={() => setTab('income')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${tab === 'income' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <TrendingUp size={15} /> Income
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === 'income' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {incomeData.length}
            </span>
          </button>
          <button
            onClick={() => setTab('expenses')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${tab === 'expenses' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <TrendingDown size={15} /> Expenses
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === 'expenses' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
              {expenseData.length}
            </span>
          </button>
        </div>

        {tab === 'income' && <IncomeTab />}
        {tab === 'expenses' && <ExpenseTab />}
      </div>
    </div>
  );
}
