import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch } from '../utils/helpers';
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

const STATUS_OPTIONS = ['Active', 'Inactive'];

function InternForm({ defaultValues, onSubmit, onCancel, loading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Name"
          placeholder="Full name"
          required
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />
        <Input
          label="Phone"
          placeholder="+91 98765 43210"
          required
          error={errors.phone?.message}
          {...register('phone', {
            required: 'Phone is required',
            pattern: { value: /^[0-9+\s()-]{7,15}$/, message: 'Invalid phone' },
          })}
        />
        <Input
          label="Role"
          placeholder="e.g. Content Creator, Coordinator"
          error={errors.role?.message}
          {...register('role')}
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          placeholder="Select status"
          {...register('status')}
        />
      </div>
      <Textarea
        label="Assigned Work"
        placeholder="Describe the work assigned..."
        {...register('assignedWork')}
      />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Intern
        </Button>
      </div>
    </form>
  );
}

export default function Interns() {
  const { data: interns, loading, add, update, remove } = useFirestore('interns');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = filterBySearch(interns, search, ['name', 'phone', 'role', 'assignedWork']);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (i) => { setEditing(i); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = { ...data, status: data.status || 'Active' };
      if (editing) {
        await update(editing.id, payload);
        toast.success('Intern updated');
      } else {
        await add(payload);
        toast.success('Intern added');
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
      toast.success('Intern removed');
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
          <h1 className="text-xl font-bold text-gray-900">Interns</h1>
          <p className="text-sm text-gray-500 mt-0.5">{interns.length} total interns</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Add Intern
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search interns..." />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No interns found"
            description={search ? 'Try a different search' : 'Add your first intern'}
            action={!search && <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Intern</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Name', 'Phone', 'Role', 'Assigned Work', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide
                        ${h === 'Actions' ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((intern, i) => (
                  <tr key={intern.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs w-8">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{intern.name}</td>
                    <td className="px-5 py-3 text-gray-600">{intern.phone}</td>
                    <td className="px-5 py-3 text-gray-600">{intern.role || '—'}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs">
                      <p className="truncate">{intern.assignedWork || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{intern.status || 'Active'}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(intern)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(intern)}
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
        title={editing ? 'Edit Intern' : 'Add Intern'}
        size="md"
      >
        <InternForm
          defaultValues={editing}
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
        title="Remove Intern"
        message={`Remove "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
