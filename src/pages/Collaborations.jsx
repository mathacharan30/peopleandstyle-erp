import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Phone, User, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch } from '../utils/helpers';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchInput from '../components/ui/SearchInput';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

function CollaborationForm({ defaultValues, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: defaultValues?.name || '',
      serviceName: defaultValues?.serviceName || '',
      location: defaultValues?.location || '',
      status: defaultValues?.status || 'Active',
    },
  });

  // Seed contacts: use existing contacts array, or migrate legacy single phone field
  const [contacts, setContacts] = useState(() => {
    if (defaultValues?.contacts?.length) return defaultValues.contacts;
    if (defaultValues?.phone) return [{ name: defaultValues.name || '', phone: defaultValues.phone }];
    return [{ name: '', phone: '' }];
  });

  const addContact = () => setContacts((prev) => [...prev, { name: '', phone: '' }]);
  const removeContact = (i) => setContacts((prev) => prev.filter((_, idx) => idx !== i));
  const updateContact = (i, field, value) => {
    setContacts((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const onFormSubmit = (data) => {
    const validContacts = contacts.filter((c) => c.name.trim() || c.phone.trim());
    onSubmit({ ...data, contacts: validContacts });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
      {/* Vendor info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Vendor / Business Name" placeholder="e.g. Royal Rentals" required
          error={errors.name?.message}
          {...register('name', { required: 'Vendor name is required' })}
        />
        <Input
          label="Service" placeholder="e.g. Photography, Bridal Wear"
          error={errors.serviceName?.message}
          {...register('serviceName', { required: 'Service name is required' })}
        />
        <Input label="Location" placeholder="City / Area" {...register('location')} />
        <Select label="Status" options={['Active', 'Inactive']} placeholder="Select status" {...register('status')} />
      </div>

      {/* Contacts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Contacts <span className="text-indigo-500">({contacts.length})</span>
          </h3>
          <button
            type="button"
            onClick={addContact}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Plus size={12} /> Add Contact
          </button>
        </div>

        <div className="space-y-2">
          {contacts.map((contact, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="relative">
                  <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={contact.name}
                    onChange={(e) => updateContact(i, 'name', e.target.value)}
                    placeholder="Contact name"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900
                      dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div className="relative">
                  <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={contact.phone}
                    onChange={(e) => updateContact(i, 'phone', e.target.value)}
                    placeholder="Phone number"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900
                      dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Collaborator
        </Button>
      </div>
    </form>
  );
}

export default function Collaborations() {
  const { data: collabs, loading, add, update, remove } = useFirestore('collaborations');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Search across vendor name, service, location AND all contacts
  let filtered = collabs.filter((c) => {
    if (statusFilter && (c.status || 'Active') !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const inVendor = [c.name, c.serviceName, c.location].some((f) => f?.toLowerCase().includes(q));
    const inContacts = (c.contacts || []).some(
      (ct) => ct.name?.toLowerCase().includes(q) || ct.phone?.includes(q)
    );
    // legacy single-phone support
    const inLegacy = c.phone?.includes(q);
    return inVendor || inContacts || inLegacy;
  });

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };
  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = { ...data, status: data.status || 'Active' };
      editing ? await update(editing.id, payload) : await add(payload);
      toast.success(editing ? 'Collaborator updated' : 'Collaborator added');
      closeModal();
    } catch { toast.error('Something went wrong'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Collaborator removed');
      setDeleteTarget(null);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  const activeCount = collabs.filter((c) => (c.status || 'Active') === 'Active').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Collaborations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {collabs.length} total &mdash; <span className="text-green-600 font-medium">{activeCount} active</span>
          </p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Add Collaborator</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search vendor, service, contact..." />
          <select
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg
              dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState
            title="No collaborators found"
            description={search || statusFilter ? 'Try different filters' : 'Add your first collaborator'}
            action={!search && !statusFilter && (
              <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Collaborator</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['', '#', 'Vendor / Business', 'Service', 'Location', 'Contacts', 'Status', 'Actions'].map((h) => (
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
                {filtered.map((c, i) => {
                  const contacts = c.contacts?.length
                    ? c.contacts
                    : c.phone ? [{ name: c.name, phone: c.phone }] : [];
                  const isExpanded = expandedId === c.id;

                  return (
                    <>
                      <tr
                        key={c.id}
                        onClick={() => toggleExpand(c.id)}
                        className={`cursor-pointer hover:bg-gray-50/50 transition-colors border-b border-gray-50
                          ${isExpanded ? 'bg-gray-50/40' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <span className="text-gray-400 inline-flex">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.serviceName || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.location || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                            <User size={11} />
                            {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge>{c.status || 'Active'}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${c.id}-exp`} className="bg-gray-50/60">
                          <td colSpan={8} className="px-6 py-4 border-b border-gray-100">
                            {contacts.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No contacts added yet</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {contacts.map((ct, idx) => (
                                  <div key={idx} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-semibold text-indigo-600">
                                        {ct.name?.charAt(0)?.toUpperCase() || '?'}
                                      </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-gray-800 truncate">{ct.name || '—'}</p>
                                      <p className="text-xs text-gray-500">{ct.phone || '—'}</p>
                                    </div>
                                    {ct.phone && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <a
                                          href={`tel:${ct.phone}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-medium"
                                          title="Call"
                                        >
                                          <Phone size={14} /> Call
                                        </a>
                                        <a
                                          href={`https://wa.me/${ct.phone.replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors text-xs font-medium"
                                          title="WhatsApp"
                                        >
                                          <MessageCircle size={14} /> WhatsApp
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Collaborator' : 'Add Collaborator'} size="md">
        <CollaborationForm defaultValues={editing} onSubmit={handleSubmit} onCancel={closeModal} loading={submitting} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Remove Collaborator" message={`Remove "${deleteTarget?.name}"? This cannot be undone.`} />
    </div>
  );
}
