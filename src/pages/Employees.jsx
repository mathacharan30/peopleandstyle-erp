import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { createEmployeeAccount } from '../services/firebase/auth';
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

function EmployeeForm({ defaultValues, onSubmit, onCancel, loading }) {
  const isEditing = !!defaultValues?.id;
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Name" placeholder="Full name" required
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />
        <Input
          label="Phone" placeholder="+91 98765 43210" required
          error={errors.phone?.message}
          {...register('phone', {
            required: 'Phone is required',
            pattern: { value: /^[0-9+\s()-]{7,15}$/, message: 'Invalid phone' },
          })}
        />
        <Input
          label="Role" placeholder="e.g. Coordinator, Makeup Artist"
          {...register('role')}
        />
        <Select label="Status" options={STATUS_OPTIONS} placeholder="Select status" {...register('status')} />
      </div>
      <Textarea label="Assigned Work" placeholder="Describe responsibilities..." {...register('assignedWork')} />

      {/* Login credentials — only shown when adding a new employee */}
      {!isEditing && (
        <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/40 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={14} className="text-indigo-500" />
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Login Credentials</p>
          </div>
          <p className="text-xs text-indigo-600">The employee will use these to log in and view their tasks.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email" type="email" placeholder="employee@example.com" required
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
              })}
            />
            <Input
              label="Password" type="password" placeholder="Min. 6 characters" required
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Minimum 6 characters' },
              })}
            />
          </div>
        </div>
      )}

      {isEditing && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <KeyRound size={12} />
          Login email: <span className="font-medium text-gray-600">{defaultValues.email || '—'}</span>
          &nbsp;· To change password, use Firebase Console.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {isEditing ? 'Update' : 'Add'} Employee
        </Button>
      </div>
    </form>
  );
}

export default function Employees() {
  const { data: employees, loading, add, update, remove } = useFirestore('employees');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = filterBySearch(employees, search, ['name', 'phone', 'role', 'assignedWork', 'email']);

  const quickToggleStatus = async (emp) => {
    const newStatus = (emp.status || 'Active') === 'Active' ? 'Inactive' : 'Active';
    try {
      await update(emp.id, { ...emp, status: newStatus });
      if (emp.uid) {
        await setDoc(doc(db, 'users', emp.uid), { status: newStatus }, { merge: true });
      }
      toast.success(`${emp.name} set to ${newStatus}`);
    } catch { toast.error('Update failed'); }
  };

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (e) => { setEditing(e); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        phone: data.phone,
        role: data.role || '',
        assignedWork: data.assignedWork || '',
        status: data.status || 'Active',
        email: data.email || editing?.email || '',
      };

      if (editing) {
        await update(editing.id, payload);
        // Also update the users doc if it exists
        if (editing.uid) {
          await setDoc(doc(db, 'users', editing.uid), {
            name: payload.name,
            email: payload.email,
            role: 'employee',
            employeeId: editing.id,
          }, { merge: true });
        }
        toast.success('Employee updated');
      } else {
        // Create Firebase Auth account first
        const uid = await createEmployeeAccount(data.email, data.password);

        // Save employee doc with uid
        const employeeId = await add({ ...payload, uid });

        // Save user role doc in users collection
        await setDoc(doc(db, 'users', uid), {
          name: data.name,
          email: data.email,
          role: 'employee',
          employeeId,
        });

        toast.success('Employee added & account created');
      }
      closeModal();
    } catch (e) {
      const msg =
        e.code === 'auth/email-already-in-use'
          ? 'This email is already registered'
          : e.code === 'auth/invalid-email'
          ? 'Invalid email address'
          : e.code === 'auth/weak-password'
          ? 'Password is too weak'
          : 'Something went wrong';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Remove users doc if uid is stored
      if (deleteTarget.uid) {
        await deleteDoc(doc(db, 'users', deleteTarget.uid));
      }
      await remove(deleteTarget.id);
      toast.success('Employee removed');
      setDeleteTarget(null);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">{employees.length} total employees</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Add Employee</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employees..." />
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState
            title="No employees found"
            description={search ? 'Try a different search' : 'Add your first employee'}
            action={!search && <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Employee</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Name', 'Phone', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                    <th key={h} className={`px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((emp, i) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{emp.name}</td>
                    <td className="px-5 py-3 text-gray-600">{emp.phone}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{emp.email || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{emp.role || '—'}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => quickToggleStatus(emp)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                          ${(emp.status || 'Active') === 'Active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                      >
                        {emp.status || 'Active'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteTarget(emp)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Employee' : 'Add Employee'} size="md">
        <EmployeeForm defaultValues={editing} onSubmit={handleSubmit} onCancel={closeModal} loading={submitting} />
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Remove Employee" message={`Remove "${deleteTarget?.name}"? Their login account will also be deactivated.`} />
    </div>
  );
}
