import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Lightbulb, ChevronRight, Send, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch } from '../utils/helpers';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchInput from '../components/ui/SearchInput';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const STAGES = ['Pending', 'Approved', 'In Production', 'Editing', 'Editing Completed'];

const STAGE_STYLES = {
  Pending:            { pill: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  Approved:           { pill: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
  'In Production':    { pill: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  Editing:            { pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  'Editing Completed':{ pill: 'bg-green-100 text-green-700',   dot: 'bg-green-400' },
};

function StageBadge({ status }) {
  const s = STAGE_STYLES[status] || STAGE_STYLES.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function IdeaForm({ defaultValues, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Idea Title" placeholder="What's the idea?" required
        error={errors.title?.message}
        {...register('title', { required: 'Title is required' })}
      />
      <Textarea
        label="Description / Details"
        placeholder="Describe the idea, concept, references..."
        {...register('description')}
      />
      <Textarea
        label="Discussion Notes"
        placeholder="Notes from team discussion..."
        {...register('notes')}
      />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Add'} Idea
        </Button>
      </div>
    </form>
  );
}

function AssignForm({ label, employees, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const options = employees
    .filter((e) => (e.status || 'Active') === 'Active')
    .map((e) => ({ value: e.name, label: e.name }));
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Assign To" required
        options={options} placeholder="Select employee"
        error={errors.assignedTo?.message}
        {...register('assignedTo', { required: 'Please select an employee' })}
      />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>{label}</Button>
      </div>
    </form>
  );
}

export default function ContentIdeas() {
  const { data: ideas, loading, add, update, remove } = useFirestore('contentIdeas');
  const { add: addToPlanner } = useFirestore('content');
  const { add: addTask } = useFirestore('tasks');
  const { data: employees } = useFirestore('employees');

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('Pending');

  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [assignModal, setAssignModal] = useState(null); // { idea, taskType: 'production'|'editing' }

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [advancing, setAdvancing] = useState(null);
  const [sending, setSending] = useState(null);

  const counts = useMemo(() => {
    const c = {};
    STAGES.forEach((s) => { c[s] = ideas.filter((i) => (i.status || 'Pending') === s).length; });
    return c;
  }, [ideas]);

  const stageData = useMemo(() =>
    ideas.filter((i) => (i.status || 'Pending') === stageFilter),
    [ideas, stageFilter]
  );

  const filtered = filterBySearch(stageData, search, ['title', 'description', 'notes']);

  const openAdd = () => { setEditing(null); setIdeaModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setIdeaModalOpen(true); };
  const closeIdeaModal = () => { setIdeaModalOpen(false); setEditing(null); };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = { ...formData, status: editing?.status || 'Pending' };
      editing ? await update(editing.id, payload) : await add(payload);
      toast.success(editing ? 'Idea updated' : 'Idea added');
      closeIdeaModal();
      if (!editing) setStageFilter('Pending');
    } catch { toast.error('Something went wrong'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Idea deleted');
      setDeleteTarget(null);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  // Pending → Approved (direct, no assignment needed)
  const handleApprove = async (idea) => {
    setAdvancing(idea.id);
    try {
      await update(idea.id, { status: 'Approved' });
      toast.success('Idea approved');
    } catch { toast.error('Something went wrong'); }
    finally { setAdvancing(null); }
  };

  // Assignment: Approved → In Production  OR  Editing → assign editor
  const handleAssign = async ({ assignedTo }) => {
    const { idea, taskType } = assignModal;
    setAssigning(true);
    try {
      const isProduction = taskType === 'production';
      const taskTitle = isProduction
        ? `Production: ${idea.title}`
        : `Editing: ${idea.title}`;

      const taskId = await addTask({
        title: taskTitle,
        assignedTo,
        status: 'To Do',
        priority: 'Medium',
        category: 'Content',
        ideaId: idea.id,
        taskType,
        description: `${isProduction ? 'Production' : 'Editing'} task for content idea: "${idea.title}"`,
      });

      if (isProduction) {
        await update(idea.id, {
          status: 'In Production',
          productionAssignee: assignedTo,
          productionTaskId: taskId,
        });
        toast.success(`Production started — assigned to ${assignedTo}`);
        setStageFilter('In Production');
      } else {
        await update(idea.id, {
          editingAssignee: assignedTo,
          editingTaskId: taskId,
        });
        toast.success(`Editing assigned to ${assignedTo}`);
      }

      setAssignModal(null);
    } catch { toast.error('Something went wrong'); }
    finally { setAssigning(false); }
  };

  const handleSendToPlanner = async (idea) => {
    setSending(idea.id);
    try {
      await addToPlanner({
        title: idea.title,
        platform: 'Instagram',
        contentType: 'Post',
        status: 'Planned',
        scheduledDate: '',
      });
      await update(idea.id, { sentToPlanner: true });
      toast.success('Sent to Content Planner!');
    } catch { toast.error('Something went wrong'); }
    finally { setSending(null); }
  };

  const renderAction = (idea) => {
    const status = idea.status || 'Pending';

    if (status === 'Pending') {
      return (
        <Button size="sm" variant="secondary" loading={advancing === idea.id}
          onClick={() => handleApprove(idea)} className="gap-1 text-xs whitespace-nowrap">
          Approve <ChevronRight size={12} />
        </Button>
      );
    }

    if (status === 'Approved') {
      return (
        <Button size="sm" loading={advancing === idea.id}
          onClick={() => setAssignModal({ idea, taskType: 'production' })}
          className="gap-1 text-xs whitespace-nowrap">
          Start Production <ChevronRight size={12} />
        </Button>
      );
    }

    if (status === 'In Production') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <User size={12} />
          <span>{idea.productionAssignee}</span>
          <span className="text-gray-300">·</span>
          <span className="text-purple-600 font-medium">In Progress</span>
        </span>
      );
    }

    if (status === 'Editing') {
      if (!idea.editingAssignee) {
        return (
          <Button size="sm" variant="secondary"
            onClick={() => setAssignModal({ idea, taskType: 'editing' })}
            className="gap-1 text-xs whitespace-nowrap">
            Assign Editor <ChevronRight size={12} />
          </Button>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <User size={12} />
          <span>{idea.editingAssignee}</span>
          <span className="text-gray-300">·</span>
          <span className="text-orange-600 font-medium">Editing</span>
        </span>
      );
    }

    if (status === 'Editing Completed') {
      return idea.sentToPlanner ? (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Sent to Planner
        </span>
      ) : (
        <Button size="sm" loading={sending === idea.id}
          onClick={() => handleSendToPlanner(idea)} className="gap-1.5 text-xs">
          <Send size={12} /> Send to Planner
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Content Ideas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ideas.length} total ideas in pipeline</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Add Idea
        </Button>
      </div>

      {/* Pipeline stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAGES.map((stage) => {
          const s = STAGE_STYLES[stage];
          const isActive = stageFilter === stage;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(stage)}
              className={`bg-white rounded-xl border p-4 text-left transition-all
                ${isActive ? 'border-indigo-300 shadow-sm ring-1 ring-indigo-200' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <span className="text-xl font-bold text-gray-800">{counts[stage]}</span>
              </div>
              <p className="text-xs font-medium text-gray-600 leading-tight">{stage}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <StageBadge status={stageFilter} />
            <span className="text-sm text-gray-500">{filtered.length} ideas</span>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search ideas..." />
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState
            title={search ? 'No ideas match your search' : `No ideas in ${stageFilter}`}
            description={search ? 'Try a different search' : 'Ideas move through the pipeline stage by stage'}
            action={!search && stageFilter === 'Pending' && (
              <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Idea</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Title', 'Description', 'Notes', 'Action'].map((h) => (
                    <th key={h} className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((idea) => (
                  <tr key={idea.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800 max-w-[200px] truncate whitespace-nowrap">{idea.title}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-[260px] truncate">{idea.description || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 max-w-[220px] truncate text-xs">{idea.notes || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {renderAction(idea)}
                        <button onClick={() => openEdit(idea)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(idea)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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

      {/* Add / Edit Idea Modal */}
      <Modal open={ideaModalOpen} onClose={closeIdeaModal} title={editing ? 'Edit Idea' : 'New Content Idea'} size="md">
        <IdeaForm defaultValues={editing} onSubmit={handleSubmit} onCancel={closeIdeaModal} loading={submitting} />
      </Modal>

      {/* Assignment Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={assignModal?.taskType === 'production' ? 'Assign Production' : 'Assign Editor'}
        size="sm"
      >
        {assignModal && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{assignModal.idea.title}</span>
              <span className="text-gray-400"> · {assignModal.taskType === 'production' ? 'Who will handle production?' : 'Who will handle editing?'}</span>
            </p>
            <AssignForm
              label={assignModal.taskType === 'production' ? 'Start Production' : 'Assign Editor'}
              employees={employees}
              onSubmit={handleAssign}
              onCancel={() => setAssignModal(null)}
              loading={assigning}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Idea"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
      />
    </div>
  );
}
