import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, IndianRupee } from 'lucide-react';
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

const SERVICE_TYPES = ['Rental', 'Makeup', 'Jewellery'];
const PAYMENT_STATUSES = ['Pending', 'Paid'];
const BOOKING_STATUSES = ['Pending', 'Delivered', 'Returned'];
const DAMAGE_OPTIONS = ['No', 'Yes'];

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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

  const customerOptions = customers.map((c) => ({ value: c.name, label: c.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title="Customer & Dates">
        <div className="sm:col-span-2">
          <Select
            label="Customer"
            required
            options={customerOptions}
            placeholder="Select customer"
            error={errors.customerName?.message}
            {...register('customerName', { required: 'Customer is required' })}
          />
        </div>
        <Input
          label="Booking Date"
          type="date"
          required
          error={errors.bookingDate?.message}
          {...register('bookingDate', { required: 'Booking date is required' })}
        />
        <Input
          label="Event Date"
          type="date"
          required
          error={errors.eventDate?.message}
          {...register('eventDate', { required: 'Event date is required' })}
        />
        <Input label="Delivery Date" type="date" {...register('deliveryDate')} />
        <Input label="Return Date" type="date" {...register('returnDate')} />
      </Section>

      <Section title="Service Details">
        <Select
          label="Service Type"
          required
          options={SERVICE_TYPES}
          placeholder="Select service"
          error={errors.serviceType?.message}
          {...register('serviceType', { required: 'Service type is required' })}
        />
        <Input
          label="Product Name"
          placeholder="Product name"
          required
          error={errors.productName?.message}
          {...register('productName', { required: 'Product name is required' })}
        />
        <Input
          label="Category"
          placeholder="e.g. Lehenga, Necklace Set"
          error={errors.category?.message}
          {...register('category')}
        />
      </Section>

      <Section title="Pricing">
        <Input
          label="Rent Price (₹)"
          type="number"
          placeholder="0"
          required
          error={errors.rentPrice?.message}
          {...register('rentPrice', {
            required: 'Rent price is required',
            min: { value: 0, message: 'Must be positive' },
          })}
        />
        <Input
          label="Refundable Deposit (₹)"
          type="number"
          placeholder="0"
          {...register('deposit', { min: { value: 0, message: 'Must be positive' } })}
        />
        <Input
          label="Total Amount (₹)"
          type="number"
          placeholder="0"
          {...register('totalAmount', { min: { value: 0, message: 'Must be positive' } })}
        />
        <Input
          label="Commission (₹)"
          type="number"
          placeholder="0"
          {...register('commission', { min: { value: 0, message: 'Must be positive' } })}
        />
      </Section>

      <Section title="Status">
        <Select
          label="Payment Status"
          options={PAYMENT_STATUSES}
          placeholder="Select"
          {...register('paymentStatus')}
        />
        <Select
          label="Booking Status"
          options={BOOKING_STATUSES}
          placeholder="Select"
          {...register('bookingStatus')}
        />
        <Select
          label="Damage"
          options={DAMAGE_OPTIONS}
          placeholder="Select"
          {...register('damage')}
        />
      </Section>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100">
          Remarks
        </h3>
        <Textarea
          label="Remarks"
          placeholder="Any additional notes..."
          {...register('remarks')}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.bookingId ? 'Update' : 'Add'} Booking
        </Button>
      </div>
    </form>
  );
}

export default function Bookings() {
  const { data: bookings, loading, add, update, remove } = useFirestore('bookings');
  const { data: customers } = useFirestore('customers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  let filtered = filterBySearch(bookings, search, ['bookingId', 'customerName', 'productName', 'serviceType', 'category']);
  if (statusFilter) filtered = filtered.filter((b) => b.bookingStatus === statusFilter);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (b) => { setEditing(b); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

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
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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
                  {['Booking ID', 'Customer', 'Service', 'Event Date', 'Rent', 'Total', 'Payment', 'Status', 'Damage', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap
                        ${h === 'Actions' ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{b.bookingId}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{b.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <div>{b.serviceType}</div>
                      <div className="text-xs text-gray-400">{b.productName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(b.eventDate)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatCurrency(b.rentPrice)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge>{b.paymentStatus || 'Pending'}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge>{b.bookingStatus || 'Pending'}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge>{b.damage || 'No'}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? `Edit Booking — ${editing.bookingId}` : 'New Booking'}
        size="xl"
      >
        <BookingForm
          defaultValues={editing}
          customers={customers}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={submitting}
        />
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
