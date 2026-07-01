import { useState, useMemo, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch, formatDate, formatCurrency, generateBookingId } from '../utils/helpers';
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

const SERVICE_TYPES = ['Rental Clothes', 'Rental Jewellery', 'Photography', 'Makeup'];
const PAYMENT_STATUSES = ['Pending', 'Paid'];
const BOOKING_STATUSES = ['Pending', 'Delivered', 'Returned'];
const DAMAGE_OPTIONS = ['No', 'Yes'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card'];
const EXPENSE_CATEGORIES = ['Vendor Payment', 'Deposit Refund', 'Commission Paid', 'Transport', 'Other'];

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function BookingForm({ defaultValues, customers, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  const customerOptions = customers.map((c) => ({ value: c.name, label: c.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title="Customer & Dates">
        <div className="sm:col-span-2">
          <Select
            label="Customer" required
            options={customerOptions} placeholder="Select customer"
            error={errors.customerName?.message}
            {...register('customerName', { required: 'Customer is required' })}
          />
        </div>
        <Input label="Booking Date" type="date" required error={errors.bookingDate?.message}
          {...register('bookingDate', { required: 'Booking date is required' })} />
        <Input label="Event Date" type="date" required error={errors.eventDate?.message}
          {...register('eventDate', { required: 'Event date is required' })} />
        <Input label="Delivery Date" type="date" {...register('deliveryDate')} />
        <Input label="Return Date" type="date" {...register('returnDate')} />
      </Section>

      <Section title="Service Details">
        <Select label="Service Type" required options={SERVICE_TYPES} placeholder="Select service"
          error={errors.serviceType?.message}
          {...register('serviceType', { required: 'Service type is required' })} />
        <Input label="Product Name" placeholder="Product name" required error={errors.productName?.message}
          {...register('productName', { required: 'Product name is required' })} />
        <Input label="Category" placeholder="e.g. Lehenga, Necklace Set" {...register('category')} />
      </Section>

      <Section title="Pricing">
        <Input label="Rent Price (₹)" type="number" placeholder="0"
          {...register('rentPrice', { min: { value: 0, message: 'Must be positive' } })} />
        <Input label="Refundable Deposit (₹)" type="number" placeholder="0"
          {...register('deposit', { min: { value: 0, message: 'Must be positive' } })} />
        <Input label="Total Amount (₹)" type="number" placeholder="0"
          {...register('totalAmount', { min: { value: 0, message: 'Must be positive' } })} />
        <Input label="Commission (₹)" type="number" placeholder="0"
          {...register('commission', { min: { value: 0, message: 'Must be positive' } })} />
      </Section>

      <Section title="Status">
        <Select label="Payment Status" options={PAYMENT_STATUSES} placeholder="Select" {...register('paymentStatus')} />
        <Select label="Booking Status" options={BOOKING_STATUSES} placeholder="Select" {...register('bookingStatus')} />
        <Select label="Damage" options={DAMAGE_OPTIONS} placeholder="Select" {...register('damage')} />
      </Section>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100">
          Remarks
        </h3>
        <Textarea label="Remarks" placeholder="Any additional notes..." {...register('remarks')} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.bookingId ? 'Update' : 'Add'} Booking
        </Button>
      </div>
    </form>
  );
}

function QuickIncomeForm({ booking, onSubmit, onCancel, loading }) {
  const today = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      date: today,
      source: 'Booking Rent',
      reference: booking.bookingId,
      description: `${booking.customerName}${booking.productName ? ' — ' + booking.productName : ''}`,
      paymentMethod: 'Cash',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-green-50 rounded-lg p-3 text-sm">
        <span className="font-semibold text-green-800">{booking.customerName}</span>
        <span className="text-green-400 ml-2 text-xs font-mono">{booking.bookingId}</span>
        <div className="text-xs text-green-600 mt-1">
          Total: {formatCurrency(booking.totalAmount)} · Deposit: {formatCurrency(booking.deposit)}
        </div>
      </div>
      <Input label="Amount Received (₹)" type="number" placeholder="0" required
        error={errors.amount?.message}
        {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" required {...register('date', { required: true })} />
        <Select label="Payment Method" options={PAYMENT_METHODS} {...register('paymentMethod')} />
      </div>
      <Input label="Source" {...register('source')} />
      <Input label="Reference" {...register('reference')} />
      <Textarea label="Description" rows={2} {...register('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>Add Income</Button>
      </div>
    </form>
  );
}

function QuickExpenseForm({ booking, prefill, onSubmit, onCancel, loading }) {
  const today = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      date: today,
      category: prefill?.category || 'Vendor Payment',
      amount: prefill?.amount || '',
      paidTo: prefill?.paidTo || '',
      reference: booking.bookingId,
      description: prefill?.description || `${booking.customerName} — ${booking.bookingId}`,
      paymentMethod: 'Cash',
    },
  });

  const isRefund = prefill?.category === 'Deposit Refund';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className={`rounded-lg p-3 text-sm ${isRefund ? 'bg-orange-50' : 'bg-red-50'}`}>
        <span className={`font-semibold ${isRefund ? 'text-orange-800' : 'text-red-800'}`}>{booking.customerName}</span>
        <span className={`ml-2 text-xs font-mono ${isRefund ? 'text-orange-400' : 'text-red-400'}`}>{booking.bookingId}</span>
        {isRefund && (
          <div className="text-xs text-orange-500 mt-1">Deposit on record: {formatCurrency(booking.deposit)}</div>
        )}
      </div>
      <Input label="Amount (₹)" type="number" placeholder="0" required
        error={errors.amount?.message}
        {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" required {...register('date', { required: true })} />
        <Select label="Payment Method" options={PAYMENT_METHODS} {...register('paymentMethod')} />
      </div>
      <Select label="Category" options={EXPENSE_CATEGORIES} {...register('category')} />
      <Input label="Paid To" placeholder="Vendor / Person name" {...register('paidTo')} />
      <Input label="Reference" {...register('reference')} />
      <Textarea label="Description" rows={2} {...register('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" className="flex-1" type="submit" loading={loading}>
          {isRefund ? 'Record Refund' : 'Add Expense'}
        </Button>
      </div>
    </form>
  );
}

function BookingExpandedRow({ booking, incomeData, expenseData, colSpan, onAddIncome, onAddExpense }) {
  const linkedIncome = incomeData.filter((i) => i.reference === booking.bookingId);
  const linkedExpenses = expenseData.filter((e) => e.reference === booking.bookingId);

  const totalIncome = linkedIncome.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalExpenses = linkedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const net = totalIncome - totalExpenses;

  return (
    <tr className="bg-gray-50/60">
      <td colSpan={colSpan} className="px-4 py-4 border-b border-gray-100">
        {/* Summary bar */}
        <div className="flex items-center gap-6 flex-wrap mb-4">
          <div>
            <span className="text-xs text-gray-400 uppercase font-medium block">Income</span>
            <span className="font-semibold text-green-600">{formatCurrency(totalIncome)}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase font-medium block">Expenses</span>
            <span className="font-semibold text-red-500">{formatCurrency(totalExpenses)}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase font-medium block">Net</span>
            <span className={`font-semibold ${net >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
              {formatCurrency(net)}
            </span>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              onClick={onAddIncome}
              className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors flex items-center gap-1"
            >
              <TrendingUp size={12} /> Income
            </button>
            <button
              onClick={onAddExpense}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors flex items-center gap-1"
            >
              <TrendingDown size={12} /> Expense
            </button>
          </div>
        </div>

        {/* Income & Expenses panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Income */}
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Payments Received ({linkedIncome.length})
              </span>
            </div>
            {linkedIncome.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 italic">No income recorded yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {linkedIncome.map((item) => (
                  <div key={item.id} className="px-3 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-medium text-gray-700">{item.source}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(item.date)}{item.paymentMethod ? ` · ${item.paymentMethod}` : ''}
                      </div>
                      {item.description && (
                        <div className="text-xs text-gray-400 truncate max-w-xs">{item.description}</div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-green-600 whitespace-nowrap ml-4">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                Payments Made ({linkedExpenses.length})
              </span>
            </div>
            {linkedExpenses.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 italic">No expenses recorded yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {linkedExpenses.map((item) => (
                  <div key={item.id} className="px-3 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-medium text-gray-700">{item.category}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(item.date)}{item.paidTo ? ` · ${item.paidTo}` : ''}
                      </div>
                      {item.description && (
                        <div className="text-xs text-gray-400 truncate max-w-xs">{item.description}</div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-red-500 whitespace-nowrap ml-4">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Bookings() {
  const { data: bookings, loading, add, update, remove } = useFirestore('bookings');
  const { data: customers } = useFirestore('customers');
  const { data: incomeData, add: addIncome } = useFirestore('income');
  const { data: expenseData, add: addExpense } = useFirestore('expenses');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [incomeModalBooking, setIncomeModalBooking] = useState(null);
  const [expenseModalBooking, setExpenseModalBooking] = useState(null);
  const [expensePrefill, setExpensePrefill] = useState(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const receivedMap = useMemo(() => {
    const map = {};
    incomeData.forEach((item) => {
      if (item.reference) map[item.reference] = (map[item.reference] || 0) + (Number(item.amount) || 0);
    });
    return map;
  }, [incomeData]);

  let filtered = filterBySearch(bookings, search, ['bookingId', 'customerName', 'productName', 'serviceType', 'category']);
  if (statusFilter) filtered = filtered.filter((b) => b.bookingStatus === statusFilter);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (b) => { setEditing(b); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        rentPrice: Number(data.rentPrice) || 0,
        deposit: Number(data.deposit) || 0,
        totalAmount: Number(data.totalAmount) || 0,
        commission: Number(data.commission) || 0,
        paymentStatus: data.paymentStatus || 'Pending',
        bookingStatus: data.bookingStatus || 'Pending',
        damage: data.damage || 'No',
      };
      if (editing) {
        await update(editing.id, payload);
        toast.success('Booking updated');
      } else {
        await add({ ...payload, bookingId: generateBookingId() });
        toast.success('Booking added');
      }
      closeModal();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (booking, newStatus) => {
    try {
      await update(booking.id, { ...booking, bookingStatus: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Booking deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddIncome = async (data) => {
    setQuickSubmitting(true);
    try {
      await addIncome({ ...data, amount: Number(data.amount) || 0 });
      toast.success('Income recorded');
      setIncomeModalBooking(null);
    } catch {
      toast.error('Failed to save income');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const handleAddExpense = async (data) => {
    setQuickSubmitting(true);
    try {
      await addExpense({ ...data, amount: Number(data.amount) || 0 });
      toast.success('Expense recorded');
      setExpenseModalBooking(null);
      setExpensePrefill(null);
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const openExpense = (booking, prefill = null) => {
    setExpenseModalBooking(booking);
    setExpensePrefill(prefill);
  };

  const TABLE_COLS = 10;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bookings.length} total bookings</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> New Booking
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search bookings..." />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description={search || statusFilter ? 'Try different filters' : 'Create your first booking'}
            action={!search && !statusFilter && (
              <Button onClick={openAdd} size="sm"><Plus size={14} /> New Booking</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['', 'Booking ID', 'Customer', 'Service', 'Event Date', 'Rent', 'Total', 'Received', 'Payment', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap
                        ${h === 'Actions' ? 'text-right' : ''} ${h === '' ? 'w-8' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const received = receivedMap[b.bookingId] || 0;
                  const isExpanded = expandedId === b.id;
                  return (
                    <Fragment key={b.id}>
                      <tr
                        onClick={() => toggleExpand(b.id)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/40' : ''} border-b border-gray-50`}
                      >
                        <td className="px-3 py-3">
                          <span className="p-0.5 rounded text-gray-400 inline-flex">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{b.bookingId}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{b.customerName}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          <div>{b.serviceType}</div>
                          <div className="text-xs text-gray-400">{b.productName}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(b.eventDate)}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatCurrency(b.rentPrice)}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatCurrency(b.totalAmount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={received > 0 ? 'font-semibold text-green-600' : 'text-gray-400'}>
                            {formatCurrency(received)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge>{b.paymentStatus || 'Pending'}</Badge></td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={b.bookingStatus || 'Pending'}
                            onChange={(e) => handleStatusChange(b, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500
                              ${(b.bookingStatus || 'Pending') === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                b.bookingStatus === 'Delivered' ? 'bg-blue-100 text-blue-800' :
                                b.bookingStatus === 'Returned' ? 'bg-purple-100 text-purple-800' :
                                'bg-green-100 text-green-800'}`}
                          >
                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <BookingExpandedRow
                          booking={b}
                          incomeData={incomeData}
                          expenseData={expenseData}
                          colSpan={TABLE_COLS + 1}
                          onAddIncome={() => setIncomeModalBooking(b)}
                          onAddExpense={() => openExpense(b)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking form modal */}
      <Modal open={modalOpen} onClose={closeModal}
        title={editing ? `Edit Booking — ${editing.bookingId}` : 'New Booking'} size="xl">
        <BookingForm
          defaultValues={editing}
          customers={customers}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={submitting}
        />
      </Modal>

      {/* Quick income modal */}
      <Modal
        open={!!incomeModalBooking}
        onClose={() => setIncomeModalBooking(null)}
        title={`Add Income — ${incomeModalBooking?.bookingId || ''}`}
        size="md"
      >
        {incomeModalBooking && (
          <QuickIncomeForm
            booking={incomeModalBooking}
            onSubmit={handleAddIncome}
            onCancel={() => setIncomeModalBooking(null)}
            loading={quickSubmitting}
          />
        )}
      </Modal>

      {/* Quick expense / deposit refund modal */}
      <Modal
        open={!!expenseModalBooking}
        onClose={() => { setExpenseModalBooking(null); setExpensePrefill(null); }}
        title={
          expensePrefill?.category === 'Deposit Refund'
            ? `Deposit Refund — ${expenseModalBooking?.bookingId || ''}`
            : `Add Expense — ${expenseModalBooking?.bookingId || ''}`
        }
        size="md"
      >
        {expenseModalBooking && (
          <QuickExpenseForm
            booking={expenseModalBooking}
            prefill={expensePrefill}
            onSubmit={handleAddExpense}
            onCancel={() => { setExpenseModalBooking(null); setExpensePrefill(null); }}
            loading={quickSubmitting}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Booking"
        message={`Delete booking ${deleteTarget?.bookingId}? This cannot be undone.`}
      />
    </div>
  );
}
