import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card'];

function SaleForm({ defaultValues, customers, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  const customerOptions = customers.map((c) => ({ value: c.name, label: c.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Date" type="date" required
          error={errors.date?.message}
          {...register('date', { required: 'Date is required' })}
        />
        <Select
          label="Customer"
          options={customerOptions}
          placeholder="Select customer"
          {...register('customerName')}
        />
        <div className="sm:col-span-2">
          <Input
            label="Item / Product Name" placeholder="Product sold" required
            error={errors.itemName?.message}
            {...register('itemName', { required: 'Item name is required' })}
          />
        </div>
        <Input
          label="Quantity" type="number" placeholder="1"
          {...register('quantity', { min: { value: 1, message: 'Min 1' } })}
        />
        <Input
          label="Unit Price (₹)" type="number" placeholder="0"
          {...register('unitPrice', { min: { value: 0, message: 'Must be positive' } })}
        />
        <Input
          label="Total Amount (₹)" type="number" placeholder="0" required
          error={errors.totalAmount?.message}
          {...register('totalAmount', { required: 'Total amount is required', min: { value: 1, message: 'Must be > 0' } })}
        />
        <Select
          label="Payment Method"
          options={PAYMENT_METHODS}
          placeholder="Select method"
          {...register('paymentMethod')}
        />
      </div>
      <Textarea label="Description / Notes" placeholder="Notes..." {...register('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Sale
        </Button>
      </div>
    </form>
  );
}

export default function Sales() {
  const { data, loading, add, update, remove } = useFirestore('sales');
  const { data: customers } = useFirestore('customers');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = filterBySearch(data, search, ['customerName', 'itemName', 'description', 'paymentMethod']);
  const totalSales = useMemo(() => data.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0), [data]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        quantity: Number(formData.quantity) || 1,
        unitPrice: Number(formData.unitPrice) || 0,
        totalAmount: Number(formData.totalAmount) || 0,
      };
      editing ? await update(editing.id, payload) : await add(payload);
      toast.success(editing ? 'Sale updated' : 'Sale recorded');
      closeModal();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Sale deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.length} records · Total: {formatCurrency(totalSales)}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> New Sale
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search sales..." />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No sales records"
            description={search ? 'Try a different search' : 'Record your first sale'}
            action={!search && <Button onClick={openAdd} size="sm"><Plus size={14} /> New Sale</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Date', 'Customer', 'Item', 'Qty', 'Unit Price', 'Total', 'Payment', 'Actions'].map((h) => (
                    <th key={h} className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.customerName || '—'}</td>
                    <td className="px-5 py-3 text-gray-700">
                      <div className="font-medium">{r.itemName}</div>
                      {r.description && <div className="text-xs text-gray-400 truncate max-w-xs">{r.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{r.quantity || 1}</td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatCurrency(r.unitPrice)}</td>
                    <td className="px-5 py-3 font-semibold text-indigo-600 whitespace-nowrap">{formatCurrency(r.totalAmount)}</td>
                    <td className="px-5 py-3 text-gray-600">{r.paymentMethod || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Sale' : 'New Sale'} size="md">
        <SaleForm defaultValues={editing} customers={customers} onSubmit={handleSubmit} onCancel={closeModal} loading={submitting} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Sale"
        message="Remove this sale record? This cannot be undone."
      />
    </div>
  );
}
