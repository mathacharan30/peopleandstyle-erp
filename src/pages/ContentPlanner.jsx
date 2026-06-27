import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Instagram, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch, formatDate } from '../utils/helpers';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchInput from '../components/ui/SearchInput';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const PLATFORMS = ['Instagram', 'Facebook'];
const CONTENT_TYPES = ['Post', 'Reel', 'Story'];
const STATUSES = ['Planned', 'Posted'];

const PlatformIcon = ({ platform }) => {
  if (platform === 'Instagram') return <Instagram size={14} className="text-pink-500" />;
  if (platform === 'Facebook') return <Facebook size={14} className="text-blue-600" />;
  return null;
};

function ContentForm({ defaultValues, onSubmit, onCancel, loading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Title"
        placeholder="Content title"
        required
        error={errors.title?.message}
        {...register('title', { required: 'Title is required' })}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Platform"
          required
          options={PLATFORMS}
          placeholder="Select platform"
          error={errors.platform?.message}
          {...register('platform', { required: 'Platform is required' })}
        />
        <Select
          label="Content Type"
          required
          options={CONTENT_TYPES}
          placeholder="Select type"
          error={errors.contentType?.message}
          {...register('contentType', { required: 'Content type is required' })}
        />
        <Input
          label="Scheduled Date"
          type="date"
          required
          error={errors.scheduledDate?.message}
          {...register('scheduledDate', { required: 'Scheduled date is required' })}
        />
        <Select
          label="Status"
          options={STATUSES}
          placeholder="Select status"
          {...register('status')}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Content
        </Button>
      </div>
    </form>
  );
}

export default function ContentPlanner() {
  const { data: content, loading, add, update, remove } = useFirestore('content');
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  let filtered = filterBySearch(content, search, ['title', 'platform', 'contentType']);
  if (platformFilter) filtered = filtered.filter((c) => c.platform === platformFilter);
  if (statusFilter) filtered = filtered.filter((c) => (c.status || 'Planned') === statusFilter);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = { ...data, status: data.status || 'Planned' };
      if (editing) {
        await update(editing.id, payload);
        toast.success('Content updated');
      } else {
        await add(payload);
        toast.success('Content added');
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
      toast.success('Content deleted');
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
          <h1 className="text-xl font-bold text-gray-900">Content Planner</h1>
          <p className="text-sm text-gray-500 mt-0.5">{content.length} total items</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Add Content
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search content..." />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No content found"
            description={search || platformFilter || statusFilter ? 'Try different filters' : 'Plan your first content'}
            action={!search && !platformFilter && !statusFilter && (
              <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Content</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Title', 'Platform', 'Type', 'Scheduled Date', 'Status', 'Actions'].map((h) => (
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
                {filtered.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs w-8">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{item.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <PlatformIcon platform={item.platform} />
                        {item.platform}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{item.contentType}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(item.scheduledDate)}</td>
                    <td className="px-5 py-3">
                      <Badge>{item.status || 'Planned'}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
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
        title={editing ? 'Edit Content' : 'Add Content'}
        size="md"
      >
        <ContentForm
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
        title="Delete Content"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
      />
    </div>
  );
}
