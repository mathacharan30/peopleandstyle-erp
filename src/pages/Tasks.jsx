import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, CheckSquare, Clock, CircleDot, PauseCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch, formatDate } from '../utils/helpers';
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

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['To Do', 'In Progress', 'Completed', 'On Hold'];
const CATEGORIES = ['Delivery', 'Pickup', 'Makeup', 'Jewellery', 'Admin', 'Marketing', 'Other'];

const priorityColor = { Low: 'gray', Medium: 'blue', High: 'yellow', Urgent: 'red' };
const statusColor = { 'To Do': 'gray', 'In Progress': 'blue', 'Completed': 'green', 'On Hold': 'yellow' };

const statusIcons = {
  'To Do': CircleDot,
  'In Progress': Clock,
  'Completed': CheckSquare,
  'On Hold': PauseCircle,
};

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-500',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function TaskForm({ defaultValues, employees, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  const employeeOptions = employees
    .filter((e) => (e.status || 'Active') === 'Active')
    .map((e) => ({ value: e.name, label: `${e.name}${e.role ? ` — ${e.role}` : ''}` }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Task Title" placeholder="What needs to be done?" required
        error={errors.title?.message}
        {...register('title', { required: 'Title is required' })}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Assigned To" required
          options={employeeOptions} placeholder="Select employee"
          error={errors.assignedTo?.message}
          {...register('assignedTo', { required: 'Please assign to an employee' })}
        />
        <Select label="Category" options={CATEGORIES} placeholder="Select category" {...register('category')} />
        <Select
          label="Priority" required
          options={PRIORITIES} placeholder="Select priority"
          error={errors.priority?.message}
          {...register('priority', { required: 'Priority is required' })}
        />
        <Select label="Status" options={STATUSES} placeholder="Select status" {...register('status')} />
        <div className="sm:col-span-2">
          <Input label="Due Date" type="date" {...register('dueDate')} />
        </div>
      </div>
      <Textarea label="Description" placeholder="Task details, instructions..." rows={3} {...register('description')} />
      <Textarea label="Remarks" placeholder="Additional notes..." rows={2} {...register('remarks')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {defaultValues?.id ? 'Update' : 'Create'} Task
        </Button>
      </div>
    </form>
  );
}

export default function Tasks() {
  const { data: tasks, loading, add, update, remove } = useFirestore('tasks');
  const { data: employees } = useFirestore('employees');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((t) => (t.status || 'To Do') === 'To Do').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
    onHold: tasks.filter((t) => t.status === 'On Hold').length,
  }), [tasks]);

  let filtered = filterBySearch(tasks, search, ['title', 'assignedTo', 'category', 'description']);
  if (statusFilter) filtered = filtered.filter((t) => (t.status || 'To Do') === statusFilter);
  if (priorityFilter) filtered = filtered.filter((t) => t.priority === priorityFilter);
  if (assigneeFilter) filtered = filtered.filter((t) => t.assignedTo === assigneeFilter);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        status: data.status || 'To Do',
        priority: data.priority || 'Medium',
      };
      editing ? await update(editing.id, payload) : await add(payload);
      toast.success(editing ? 'Task updated' : 'Task created');
      closeModal();
    } catch { toast.error('Something went wrong'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Task deleted');
      setDeleteTarget(null);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  const quickStatus = async (task, newStatus) => {
    try {
      await update(task.id, { ...task, status: newStatus });
      toast.success(`Marked as ${newStatus}`);
    } catch { toast.error('Update failed'); }
  };

  const activeEmployees = employees.filter((e) => (e.status || 'Active') === 'Active');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tasks.length} total tasks</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Create Task</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={CircleDot} label="To Do" value={stats.todo} color="gray" />
        <StatCard icon={Clock} label="In Progress" value={stats.inProgress} color="blue" />
        <StatCard icon={CheckSquare} label="Completed" value={stats.completed} color="green" />
        <StatCard icon={PauseCircle} label="On Hold" value={stats.onHold} color="yellow" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." />
          <select
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Employees</option>
            {activeEmployees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState
            title="No tasks found"
            description={search || statusFilter || priorityFilter || assigneeFilter ? 'Try different filters' : 'Create your first task'}
            action={!search && !statusFilter && !priorityFilter && !assigneeFilter && (
              <Button onClick={openAdd} size="sm"><Plus size={14} /> Create Task</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Task', 'Assigned To', 'Category', 'Priority', 'Due Date', 'Status', 'Actions'].map((h) => (
                    <th key={h} className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((task) => {
                  const StatusIcon = statusIcons[task.status || 'To Do'];
                  return (
                    <tr key={task.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 max-w-xs">
                        <p className="font-medium text-gray-800">{task.title}</p>
                        {task.description && <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-indigo-600">
                              {(task.assignedTo || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-700">{task.assignedTo || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{task.category || '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Badge color={priorityColor[task.priority] || 'gray'}>{task.priority || 'Medium'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                        {task.dueDate ? (
                          <span className={new Date(task.dueDate) < new Date() && task.status !== 'Completed' ? 'text-red-500 font-medium' : ''}>
                            {formatDate(task.dueDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <select
                          value={task.status || 'To Do'}
                          onChange={(e) => quickStatus(task, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400
                            ${(task.status || 'To Do') === 'Completed' ? 'bg-green-100 text-green-700' :
                              task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                              task.status === 'On Hold' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil size={15} /></button>
                          <button onClick={() => setDeleteTarget(task)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Task' : 'Create Task'} size="lg">
        <TaskForm defaultValues={editing} employees={employees} onSubmit={handleSubmit} onCancel={closeModal} loading={submitting} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Task" message={`Delete "${deleteTarget?.title}"? This cannot be undone.`} />
    </div>
  );
}
