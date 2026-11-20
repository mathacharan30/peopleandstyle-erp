import { useState, useMemo, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, TrendingDown, Download, Eye, FileText,
  MessageCircle, Link2, Loader2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirestore } from '../hooks/useFirestore';
import { filterBySearch, formatDate, formatCurrency } from '../utils/helpers';
import {
  SALE_STATUSES, INVOICE_PAYMENT_MODES, SALE_EXPENSE_CATEGORIES,
  isPaidStatus, saleStatus, computeSaleTotals, nextInvoiceNumber, formatInvoiceDate, todayISO,
  generatePublicId, publicInvoiceUrl, downloadInvoicePDF, openInvoicePDF, whatsappShareUrl,
  fetchProductFromLink,
} from '../utils/saleInvoice';
import { savePublicInvoice, deletePublicInvoice } from '../services/firebase/publicInvoices';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchInput from '../components/ui/SearchInput';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const STATUS_STYLES = {
  'Bill Sent': 'bg-yellow-100 text-yellow-800',
  'Payment Received': 'bg-green-100 text-green-800',
  Shipped: 'bg-blue-100 text-blue-800',
  Delivered: 'bg-purple-100 text-purple-800',
  Cancelled: 'bg-red-100 text-red-700',
};

const emptyItem = () => ({ name: '', hsn: '', qty: 1, rate: '' });

const linkedIncomeOf = (sale, incomeData) =>
  incomeData.filter((i) => i.saleId === sale.id || (!i.saleId && i.reference === sale.id));
const linkedExpensesOf = (sale, expenseData) => expenseData.filter((e) => e.saleId === sale.id);

const itemsSummary = (items) =>
  items.length <= 1 ? items[0]?.name || '' : `${items[0].name} +${items.length - 1} more`;

// Builds the form's starting values — from an invoice sale, an old manual sale, or blank.
function initialFormState(sale) {
  const inv = sale?.invoice;
  if (inv) {
    return {
      customerId: sale.customerId || '',
      customerName: inv.customerName || '',
      customerPhone: inv.customerPhone || '',
      customerEmail: inv.customerEmail || '',
      customerAddress: inv.customerAddress || '',
      paymentMode: inv.paymentMode || 'Cash',
      paymentReference: inv.paymentReference || '',
      discount: inv.discount ?? 0,
      deliveryAmount: inv.deliveryCharge?.depends ? '' : inv.deliveryCharge?.amount ?? 0,
      deliveryDepends: !!inv.deliveryCharge?.depends,
      items: inv.items.map((i) => ({ name: i.name, hsn: i.hsn || '', qty: i.qty, rate: i.rate })),
    };
  }
  return {
    customerId: sale?.customerId || '',
    customerName: sale?.customerName || '',
    customerPhone: sale?.customerPhone || '',
    customerEmail: '',
    customerAddress: sale?.customerAddress || '',
    paymentMode: sale?.paymentMethod && INVOICE_PAYMENT_MODES.includes(sale.paymentMethod) ? sale.paymentMethod : 'Cash',
    paymentReference: '',
    discount: 0,
    deliveryAmount: 0,
    deliveryDepends: false,
    items: sale
      ? [{ name: sale.itemName || '', hsn: '', qty: sale.quantity || 1, rate: sale.unitPrice || sale.totalAmount || '' }]
      : [emptyItem()],
  };
}

function toInvoicePayload(f) {
  return {
    type: 'sale',
    customerName: f.customerName.trim(),
    customerPhone: f.customerPhone.trim(),
    customerEmail: f.customerEmail.trim(),
    customerAddress: f.customerAddress.trim(),
    paymentMode: f.paymentMode,
    paymentReference: f.paymentReference.trim(),
    discount: f.discount === '' ? 0 : Number(f.discount) || 0,
    deliveryCharge: {
      depends: f.deliveryDepends,
      amount: f.deliveryDepends ? 0 : parseFloat(f.deliveryAmount) || 0,
    },
    items: f.items.map((i) => ({
      name: i.name.trim(),
      hsn: String(i.hsn || '').trim(),
      qty: parseFloat(i.qty) || 1,
      rate: parseFloat(i.rate) || 0,
    })),
  };
}

function Section({ title, children, right }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

const customerLabel = (c) => (c.phone ? `${c.name} · ${c.phone}` : c.name);

// Search existing customers by name or phone. Leaving it empty means a new customer.
function CustomerPicker({ customers, selectedId, onSelect }) {
  const selected = customers.find((c) => c.id === selectedId);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return [...customers]
      .filter((c) => !q
        || (c.name || '').toLowerCase().includes(q)
        || (qDigits && String(c.phone || '').replace(/\D/g, '').includes(qDigits)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .slice(0, 8);
  }, [customers, query]);

  const choose = (c) => {
    onSelect(c.id);
    setQuery('');
    setOpen(false);
    setSearching(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && matches[active]) choose(matches[active]); }
    else if (e.key === 'Escape') { setOpen(false); if (selected) setSearching(false); }
  };

  if (selected && !searching) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Existing customer</span>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-sm">
          <span className="flex-1 text-indigo-800 truncate">
            Selected: <span className="font-medium">{customerLabel(selected)}</span>
          </span>
          <button type="button" onClick={() => { setSearching(true); setOpen(true); setActive(0); }}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Change</button>
          <button type="button" title="Use a new customer instead" onClick={() => onSelect('')}
            className="p-1 rounded text-indigo-400 hover:text-red-600 hover:bg-red-50"><X size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input label="Existing customer" placeholder="Search by name or phone — leave empty for a new customer"
        value={query} autoFocus={searching} autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); if (selected) setSearching(false); }}
        onKeyDown={onKeyDown} />
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {matches.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-gray-400">No match — fill the details below to add a new customer</p>
          ) : matches.map((c, i) => (
            <button key={c.id} type="button"
              onMouseDown={(e) => { e.preventDefault(); choose(c); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-3 ${i === active ? 'bg-indigo-50' : ''}`}>
              <span className="font-medium text-gray-800 truncate">{c.name}</span>
              <span className="text-gray-400 whitespace-nowrap">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SaleBillForm({ sale, customers, onSubmit, onCancel, loading }) {
  const [f, setF] = useState(() => initialFormState(sale));
  const [productLink, setProductLink] = useState('');
  const [fetching, setFetching] = useState(false);

  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));
  const setItem = (idx, key, value) =>
    setF((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));
  const addItem = (item = emptyItem()) =>
    setF((p) => {
      // Fill the blank starter row instead of leaving it empty above the new item.
      const blank = p.items.length === 1 && !p.items[0].name.trim() && !p.items[0].rate;
      return { ...p, items: blank ? [item] : [...p.items, item] };
    });
  const removeItem = (idx) => setF((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  // Picking (or switching to) a customer replaces all customer fields on the bill;
  // email is cleared because the Customers table doesn't store one.
  const onSelectCustomer = (id) => {
    const c = customers.find((x) => x.id === id);
    setF((p) => (c
      ? { ...p, customerId: id, customerName: c.name || '', customerPhone: c.phone || '', customerEmail: '', customerAddress: c.address || '' }
      : { ...p, customerId: '', customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' }));
  };

  const onDeliveryDepends = (e) => {
    const depends = e.target.checked;
    setF((p) => ({ ...p, deliveryDepends: depends, deliveryAmount: depends ? '' : p.deliveryAmount || 0 }));
  };

  const handleFetchProduct = async () => {
    if (!productLink.trim()) return;
    setFetching(true);
    try {
      const product = await fetchProductFromLink(productLink);
      addItem({ name: product.name, hsn: '', qty: 1, rate: product.price || '' });
      setProductLink('');
      if (product.price) toast.success(`Added ${product.name}`);
      else toast(`Added ${product.name} — no price on the listing, enter the rate`, { icon: '⚠️' });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setFetching(false);
    }
  };

  const invoicePreview = toInvoicePayload(f);
  const totals = computeSaleTotals(invoicePreview);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!f.customerName.trim()) return toast.error('Please enter customer name.');
    if (!f.items.length) return toast.error('Add at least one item.');
    if (f.items.some((i) => !i.name.trim())) return toast.error('Please fill item name for all rows.');
    onSubmit(invoicePreview, { customerId: f.customerId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Customer Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <CustomerPicker customers={customers} selectedId={f.customerId} onSelect={onSelectCustomer} />
          </div>
          <Input label="Customer Name" required placeholder="Full name"
            value={f.customerName} onChange={set('customerName')} />
          <Input label="Phone (WhatsApp)" placeholder="+91 XXXXX XXXXX" value={f.customerPhone} onChange={set('customerPhone')} />
          <Input label="Email" placeholder="email@example.com" value={f.customerEmail} onChange={set('customerEmail')} />
          <Input label="Address" placeholder="City, State" value={f.customerAddress} onChange={set('customerAddress')} />
        </div>
      </Section>

      <Section title="Payment Details">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label="Payment Mode" options={INVOICE_PAYMENT_MODES} value={f.paymentMode} onChange={set('paymentMode')} />
          <Input label="Transaction Reference" placeholder="Txn ID / N/A" value={f.paymentReference} onChange={set('paymentReference')} />
          <Input label="Discount %" type="number" min="0" max="100" placeholder="0" value={f.discount} onChange={set('discount')} />
          <Input label="Delivery Charges (₹)" type="number" min="0" step="0.01" placeholder="0.00"
            value={f.deliveryAmount} onChange={set('deliveryAmount')} disabled={f.deliveryDepends} />
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 sm:pt-6">
            <input type="checkbox" checked={f.deliveryDepends} onChange={onDeliveryDepends} className="rounded border-gray-300" />
            Depends (charge actuals later)
          </label>
        </div>
      </Section>

      <Section title="Items">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="Add from website listing" placeholder="Paste link, e.g. https://peopleandstyle.in/product/…"
              value={productLink} onChange={(e) => setProductLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchProduct(); } }} />
          </div>
          <Button type="button" variant="secondary" onClick={handleFetchProduct} loading={fetching} disabled={!productLink.trim()}>
            <Link2 size={14} /> Add
          </Button>
        </div>

        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
          <span className="col-span-4">Description</span>
          <span className="col-span-2">HSN Code</span>
          <span className="col-span-1 text-right">Qty</span>
          <span className="col-span-2 text-right">Rate (₹)</span>
          <span className="col-span-2 text-right">Amount (₹)</span>
        </div>
        <div className="space-y-3 sm:space-y-2">
          {f.items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-12 sm:col-span-4 form-cell" placeholder="Item name"
                value={it.name} onChange={(e) => setItem(idx, 'name', e.target.value)} />
              <input className="col-span-4 sm:col-span-2 form-cell" placeholder="e.g. 7117"
                value={it.hsn} onChange={(e) => setItem(idx, 'hsn', e.target.value)} />
              <input className="col-span-2 sm:col-span-1 form-cell text-right" type="number" min="1" placeholder="1"
                value={it.qty} onChange={(e) => setItem(idx, 'qty', e.target.value)} />
              <input className="col-span-3 sm:col-span-2 form-cell text-right" type="number" min="0" step="0.01" placeholder="0.00"
                value={it.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} />
              <div className="col-span-2 sm:col-span-2 text-right text-sm text-gray-600 tabular-nums">
                {((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)).toFixed(2)}
              </div>
              <button type="button" onClick={() => removeItem(idx)} title="Remove item"
                className="col-span-1 justify-self-end p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => addItem()} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          + Add Item
        </button>

        <div className="ml-auto max-w-xs text-sm space-y-1 pt-2 border-t border-gray-100">
          <div className="flex justify-between text-gray-600"><span>Sub Total</span><span>₹ {totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-red-600"><span>Discount ({invoicePreview.discount}%)</span><span>- ₹ {totals.discountAmt.toFixed(2)}</span></div>
          {(f.deliveryDepends || totals.deliveryAmount > 0) && (
            <div className="flex justify-between text-gray-600">
              <span>Delivery Charges</span>
              <span>{f.deliveryDepends ? 'Depends' : `₹ ${totals.deliveryAmount.toFixed(2)}`}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 pt-1"><span>Total Amount</span><span>₹ {totals.grandTotal.toFixed(2)}</span></div>
        </div>
      </Section>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>
          {sale?.invoice ? 'Update Bill' : 'Generate Sale Bill'}
        </Button>
      </div>
    </form>
  );
}

const QUICK_PAYMENT_METHODS = ['Cash', 'UPI', 'PhonePe', 'GPay', 'NEFT', 'Bank Transfer', 'Card'];

// Simple sale record without a bill (the original Sales form). Saved as already paid.
function QuickSaleForm({ sale, customers, onSubmit, onCancel, loading }) {
  const [f, setF] = useState(() => ({
    date: sale?.date || todayISO(),
    customerId: sale?.customerId || '',
    customerName: sale?.customerName || '',
    customerPhone: sale?.customerPhone || '',
    customerAddress: sale?.customerAddress || '',
    itemName: sale?.itemName || '',
    quantity: sale?.quantity ?? 1,
    unitPrice: sale?.unitPrice ?? '',
    totalAmount: sale?.totalAmount ?? '',
    paymentMethod: sale?.paymentMethod || 'Cash',
    description: sale?.description || '',
  }));
  // Total follows qty × price until the user types their own total.
  const [totalTouched, setTotalTouched] = useState(
    () => !!sale && Number(sale.totalAmount) !== (Number(sale.quantity) || 1) * (Number(sale.unitPrice) || 0)
  );

  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));
  const setQtyOrPrice = (key) => (e) => setF((p) => {
    const next = { ...p, [key]: e.target.value };
    if (!totalTouched) {
      const total = (parseFloat(next.quantity) || 0) * (parseFloat(next.unitPrice) || 0);
      next.totalAmount = total ? String(total) : '';
    }
    return next;
  });

  const onSelectCustomer = (id) => {
    const c = customers.find((x) => x.id === id);
    setF((p) => (c
      ? { ...p, customerId: id, customerName: c.name || '', customerPhone: c.phone || '', customerAddress: c.address || '' }
      : { ...p, customerId: '', customerName: '', customerPhone: '', customerAddress: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!f.date) return toast.error('Date is required');
    if (!f.itemName.trim()) return toast.error('Item name is required');
    if (!(Number(f.totalAmount) > 0)) return toast.error('Total amount must be more than 0');
    onSubmit(f, { customerId: f.customerId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Records a sale without generating a bill. It is saved as <b>Payment Received</b> and added to Income.
      </p>
      <CustomerPicker customers={customers} selectedId={f.customerId} onSelect={onSelectCustomer} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Customer Name" placeholder="Full name" value={f.customerName} onChange={set('customerName')} />
        <Input label="Phone" placeholder="+91 XXXXX XXXXX" value={f.customerPhone} onChange={set('customerPhone')} />
        <div className="sm:col-span-2">
          <Input label="Address" placeholder="City, State" value={f.customerAddress} onChange={set('customerAddress')} />
        </div>
        <Input label="Date" type="date" required value={f.date} onChange={set('date')} />
        <Select label="Payment Method" options={QUICK_PAYMENT_METHODS} value={f.paymentMethod} onChange={set('paymentMethod')} />
        <div className="sm:col-span-2">
          <Input label="Item / Product Name" placeholder="Product sold" required value={f.itemName} onChange={set('itemName')} />
        </div>
        <Input label="Quantity" type="number" min="1" placeholder="1" value={f.quantity} onChange={setQtyOrPrice('quantity')} />
        <Input label="Unit Price (₹)" type="number" min="0" placeholder="0" value={f.unitPrice} onChange={setQtyOrPrice('unitPrice')} />
        <Input label="Total Amount (₹)" type="number" min="0" placeholder="0" required value={f.totalAmount}
          onChange={(e) => { setTotalTouched(true); set('totalAmount')(e); }} />
      </div>
      <Textarea label="Description / Notes" placeholder="Notes..." value={f.description} onChange={set('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>{sale ? 'Update' : 'Add'} Sale</Button>
      </div>
    </form>
  );
}

function PaymentForm({ sale, newStatus, onSubmit, onCancel, loading }) {
  const total = sale.invoice ? computeSaleTotals(sale.invoice).grandTotal : Number(sale.totalAmount) || 0;
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      amount: total,
      date: todayISO(),
      paymentMethod: sale.invoice?.paymentMode || 'Cash',
      paymentReference: sale.invoice?.paymentReference || '',
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-green-50 rounded-lg p-3 text-sm">
        <span className="font-semibold text-green-800">{sale.customerName}</span>
        <span className="text-green-500 ml-2 text-xs font-mono">{sale.invoiceNumber}</span>
        <div className="text-xs text-green-600 mt-1">
          Moving to “{newStatus}” records this payment under Income. Bill total: {formatCurrency(total)}
        </div>
      </div>
      <Input label="Amount Received (₹)" type="number" required error={errors.amount?.message}
        {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" required {...register('date', { required: true })} />
        <Select label="Payment Mode" options={INVOICE_PAYMENT_MODES} {...register('paymentMethod')} />
      </div>
      <Input label="Transaction Reference" placeholder="Txn ID / N/A" {...register('paymentReference')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" type="submit" loading={loading}>Record Payment</Button>
      </div>
    </form>
  );
}

function SaleExpenseForm({ sale, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      date: todayISO(),
      category: 'Shipping',
      amount: '',
      paidTo: '',
      paymentMethod: 'Cash',
      description: `${sale.customerName} — ${sale.invoiceNumber || 'Sale'}`,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-lg p-3 text-sm bg-red-50">
        <span className="font-semibold text-red-800">{sale.customerName}</span>
        <span className="ml-2 text-xs font-mono text-red-400">{sale.invoiceNumber}</span>
      </div>
      <Input label="Amount (₹)" type="number" placeholder="0" required error={errors.amount?.message}
        {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be > 0' } })} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" required {...register('date', { required: true })} />
        <Select label="Category" options={SALE_EXPENSE_CATEGORIES} {...register('category')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Paid To" placeholder="Courier / Person" {...register('paidTo')} />
        <Select label="Payment Method" options={['Cash', 'UPI', 'Bank Transfer', 'Card']} {...register('paymentMethod')} />
      </div>
      <Textarea label="Description" rows={2} {...register('description')} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" className="flex-1" type="submit" loading={loading}>Add Expense</Button>
      </div>
    </form>
  );
}

function ShareActions({ sale, compact = false }) {
  const [busy, setBusy] = useState('');
  if (!sale.invoice || !sale.publicId) return null;

  const run = (key, fn) => async (e) => {
    e?.stopPropagation();
    setBusy(key);
    try { await fn(); } catch { toast.error('Could not create the PDF'); } finally { setBusy(''); }
  };
  const copyLink = async (e) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(publicInvoiceUrl(sale.publicId));
      toast.success('Customer link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };
  const sendWhatsApp = (e) => {
    e?.stopPropagation();
    window.open(whatsappShareUrl(sale), '_blank', 'noopener');
  };

  if (compact) {
    const iconBtn = 'p-1.5 rounded-lg text-gray-400 transition-colors';
    return (
      <>
        <button title="Download PDF" onClick={run('dl', () => downloadInvoicePDF(sale.invoice))}
          className={`${iconBtn} hover:text-indigo-600 hover:bg-indigo-50`}>
          {busy === 'dl' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        </button>
        <button title="Send on WhatsApp" onClick={sendWhatsApp} className={`${iconBtn} hover:text-green-600 hover:bg-green-50`}>
          <MessageCircle size={15} />
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={run('dl', () => downloadInvoicePDF(sale.invoice))} loading={busy === 'dl'}>
        <Download size={14} /> Download PDF
      </Button>
      <Button size="sm" variant="secondary" onClick={run('view', () => openInvoicePDF(sale.invoice))} loading={busy === 'view'}>
        <Eye size={14} /> View
      </Button>
      <Button size="sm" className="!bg-green-600 hover:!bg-green-700 text-white" onClick={sendWhatsApp}>
        <MessageCircle size={14} /> Send on WhatsApp
      </Button>
      <Button size="sm" variant="secondary" onClick={copyLink}>
        <Link2 size={14} /> Copy Link
      </Button>
    </div>
  );
}

function SaleExpandedRow({ sale, linkedIncome, linkedExpenses, colSpan, onAddExpense }) {
  const totalIncome = linkedIncome.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalExpenses = linkedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const net = totalIncome - totalExpenses;
  const inv = sale.invoice;

  return (
    <tr className="bg-gray-50/60">
      <td colSpan={colSpan} className="px-4 py-4 border-b border-gray-100 space-y-4">
        <div className="flex items-center gap-6 flex-wrap">
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
            <span className={`font-semibold ${net >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatCurrency(net)}</span>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap items-center">
            <ShareActions sale={sale} />
            <button onClick={onAddExpense}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors flex items-center gap-1">
              <TrendingDown size={12} /> Expense
            </button>
          </div>
        </div>

        {inv && (
          <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600 space-y-1">
            {inv.items.map((i, idx) => (
              <div key={idx} className="flex justify-between gap-4">
                <span>{i.name}{i.hsn ? <span className="text-gray-400"> · HSN {i.hsn}</span> : null} × {i.qty}</span>
                <span className="tabular-nums">₹ {(i.qty * i.rate).toFixed(2)}</span>
              </div>
            ))}
            {inv.customerPhone && <div className="text-gray-400 pt-1">Phone: {inv.customerPhone}</div>}
          </div>
        )}
        {!inv && (
          <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between gap-4">
              <span>{sale.itemName} × {sale.quantity || 1}{sale.unitPrice ? ` @ ${formatCurrency(sale.unitPrice)}` : ''}</span>
              <span className="text-gray-400">{sale.paymentMethod || ''} · no bill</span>
            </div>
            {sale.customerPhone && <div className="text-gray-400">Phone: {sale.customerPhone}</div>}
            {sale.description && <div className="text-gray-500">{sale.description}</div>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-green-50 border-b border-green-100">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Payments Received ({linkedIncome.length})</span>
            </div>
            {linkedIncome.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 italic">Recorded automatically when status moves to Payment Received</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {linkedIncome.map((item) => (
                  <div key={item.id} className="px-3 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-medium text-gray-700">{item.source}</div>
                      <div className="text-xs text-gray-400">{formatDate(item.date)}{item.paymentMethod ? ` · ${item.paymentMethod}` : ''}</div>
                    </div>
                    <span className="text-sm font-semibold text-green-600 whitespace-nowrap ml-4">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-red-50 border-b border-red-100">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Expenses ({linkedExpenses.length})</span>
            </div>
            {linkedExpenses.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 italic">No expenses recorded yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {linkedExpenses.map((item) => (
                  <div key={item.id} className="px-3 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-medium text-gray-700">{item.category}</div>
                      <div className="text-xs text-gray-400">{formatDate(item.date)}{item.paidTo ? ` · ${item.paidTo}` : ''}</div>
                      {item.description && <div className="text-xs text-gray-400 truncate max-w-xs">{item.description}</div>}
                    </div>
                    <span className="text-sm font-semibold text-red-500 whitespace-nowrap ml-4">{formatCurrency(item.amount)}</span>
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

export default function Sales() {
  const { data, loading, add, update, remove } = useFirestore('sales');
  const { data: customers, add: addCustomer, update: updateCustomer } = useFirestore('customers');
  const { data: incomeData, add: addIncome, update: updateIncome, remove: removeIncome } = useFirestore('income');
  const { data: expenseData, add: addExpense, remove: removeExpense } = useFirestore('expenses');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editingQuick, setEditingQuick] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [shareSale, setShareSale] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null); // { sale, newStatus }
  const [unpayTarget, setUnpayTarget] = useState(null); // { sale, newStatus, linked }
  const [expenseSale, setExpenseSale] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  let filtered = filterBySearch(data, search, ['invoiceNumber', 'customerName', 'customerPhone', 'itemName', 'status', 'description']);
  if (statusFilter) filtered = filtered.filter((s) => saleStatus(s) === statusFilter);

  const { receivedTotal, pendingTotal } = useMemo(() => {
    let receivedTotal = 0, pendingTotal = 0;
    data.forEach((s) => {
      const st = saleStatus(s);
      if (isPaidStatus(st)) receivedTotal += Number(s.totalAmount) || 0;
      else if (st === 'Bill Sent') pendingTotal += Number(s.totalAmount) || 0;
    });
    return { receivedTotal, pendingTotal };
  }, [data]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  // Bills open the bill form; sales recorded without a bill open the quick form.
  const openEdit = (s) => {
    if (s.invoice) { setEditing(s); setFormOpen(true); }
    else { setEditingQuick(s); setQuickOpen(true); }
  };
  const openMakeBill = (s) => { setEditing(s); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const openQuick = () => { setEditingQuick(null); setQuickOpen(true); };
  const closeQuick = () => { setQuickOpen(false); setEditingQuick(null); };

  const incomePayload = (sale, { amount, date, paymentMethod }) => ({
    source: 'Sale',
    amount: Number(amount) || 0,
    date,
    paymentMethod: paymentMethod || '',
    reference: sale.invoiceNumber || sale.id,
    saleId: sale.id,
    description: `Sale${sale.invoiceNumber ? ' ' + sale.invoiceNumber : ''}: ${sale.itemName || ''}${sale.customerName ? ' — ' + sale.customerName : ''}`,
  });

  // Finds the bill's customer (picked from the dropdown, else same phone, else same name when
  // there's no phone) or adds a new one. Existing details are never overwritten — only blanks filled.
  const syncCustomer = async (invoice, selectedId) => {
    const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
    const phone = digits(invoice.customerPhone);
    const name = invoice.customerName.trim().toLowerCase();
    const sameName = (c) => (c.name || '').trim().toLowerCase() === name;

    const existing =
      customers.find((c) => c.id === selectedId) ||
      (phone && customers.find((c) => digits(c.phone) === phone)) ||
      customers.find((c) => sameName(c) && (!phone || !digits(c.phone)));

    if (existing) {
      const fill = {};
      if (!existing.phone && invoice.customerPhone) fill.phone = invoice.customerPhone;
      if (!existing.address && invoice.customerAddress) fill.address = invoice.customerAddress;
      if (Object.keys(fill).length) await updateCustomer(existing.id, fill);
      return { id: existing.id, created: false };
    }
    const id = await addCustomer({
      name: invoice.customerName,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
    });
    return { id, created: true };
  };

  const handleSaveBill = async (form, { customerId: selectedCustomerId } = {}) => {
    setSubmitting(true);
    try {
      let customerId = selectedCustomerId || editing?.customerId || '';
      try {
        const result = await syncCustomer(form, selectedCustomerId);
        customerId = result.id;
        if (result.created) toast.success(`${form.customerName} added to Customers`);
      } catch {
        toast.error('Bill will be saved, but the customer could not be added to Customers');
      }

      const invoiceNumber = editing?.invoiceNumber || nextInvoiceNumber(data);
      const saleDate = editing?.date || todayISO();
      const parsedDate = new Date(`${saleDate}T00:00:00`);
      const invoice = {
        ...form,
        invoiceNumber,
        date: editing?.invoice?.date || formatInvoiceDate(isNaN(parsedDate) ? new Date() : parsedDate),
      };
      const publicId = editing?.publicId || generatePublicId();
      const { grandTotal } = computeSaleTotals(invoice);
      const payload = {
        invoiceNumber,
        publicId,
        invoice,
        date: saleDate,
        customerId,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        itemName: itemsSummary(invoice.items),
        quantity: invoice.items.reduce((s, i) => s + i.qty, 0),
        totalAmount: grandTotal,
        paymentMethod: invoice.paymentMode,
        status: editing ? saleStatus(editing) : 'Bill Sent',
      };

      await savePublicInvoice(publicId, invoice);

      if (editing) {
        await update(editing.id, payload);
        // Keep the auto-recorded income in step with an edited bill total.
        const linked = linkedIncomeOf(editing, incomeData);
        if (linked.length === 1 && Number(linked[0].amount) === Number(editing.totalAmount)) {
          await updateIncome(linked[0].id, {
            amount: grandTotal,
            reference: invoiceNumber,
            saleId: editing.id,
            description: incomePayload({ ...editing, ...payload }, {}).description,
          });
        }
        const isNewBill = !editing.invoice; // a sale recorded without a bill just got one
        toast.success(isNewBill ? `${invoiceNumber} generated` : `${invoiceNumber} updated`);
        closeForm();
        if (isNewBill) setShareSale({ ...editing, ...payload });
      } else {
        const id = await add(payload);
        toast.success(`${invoiceNumber} generated`);
        closeForm();
        setShareSale({ id, ...payload });
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not save the bill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveQuick = async (form, { customerId: selectedCustomerId } = {}) => {
    setSubmitting(true);
    try {
      const customer = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerAddress: form.customerAddress.trim(),
      };
      let customerId = selectedCustomerId || editingQuick?.customerId || '';
      if (customer.customerName) {
        try {
          const result = await syncCustomer(customer, selectedCustomerId);
          customerId = result.id;
          if (result.created) toast.success(`${customer.customerName} added to Customers`);
        } catch {
          toast.error('Sale will be saved, but the customer could not be added to Customers');
        }
      }

      const payload = {
        date: form.date,
        customerId,
        ...customer,
        itemName: form.itemName.trim(),
        quantity: Number(form.quantity) || 1,
        unitPrice: Number(form.unitPrice) || 0,
        totalAmount: Number(form.totalAmount) || 0,
        paymentMethod: form.paymentMethod || '',
        description: form.description.trim(),
      };
      const income = { amount: payload.totalAmount, date: payload.date, paymentMethod: payload.paymentMethod };

      if (editingQuick) {
        await update(editingQuick.id, payload);
        const linked = linkedIncomeOf(editingQuick, incomeData);
        if (linked.length === 1) await updateIncome(linked[0].id, incomePayload({ ...editingQuick, ...payload }, income));
        toast.success('Sale updated');
      } else {
        const id = await add({ ...payload, status: 'Payment Received' });
        await addIncome(incomePayload({ id, ...payload }, income));
        toast.success('Sale recorded and added to Income');
      }
      closeQuick();
    } catch (e) {
      console.error(e);
      toast.error('Could not save the sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (sale, newStatus) => {
    const current = saleStatus(sale);
    if (newStatus === current) return;
    const linked = linkedIncomeOf(sale, incomeData);

    if (isPaidStatus(newStatus) && linked.length === 0) {
      setPaymentTarget({ sale, newStatus });
      return;
    }
    if (!isPaidStatus(newStatus) && linked.length > 0) {
      setUnpayTarget({ sale, newStatus, linked });
      return;
    }
    try {
      await update(sale.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleRecordPayment = async (form) => {
    const { sale, newStatus } = paymentTarget;
    setBusy(true);
    try {
      await addIncome(incomePayload(sale, form));
      const changes = { status: newStatus, paymentMethod: form.paymentMethod };
      if (sale.invoice) {
        // Show the actual payment mode / reference on the customer's bill.
        const invoice = { ...sale.invoice, paymentMode: form.paymentMethod, paymentReference: form.paymentReference.trim() };
        changes.invoice = invoice;
        if (sale.publicId) await savePublicInvoice(sale.publicId, invoice);
      }
      await update(sale.id, changes);
      toast.success('Payment recorded in Income');
      setPaymentTarget(null);
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setBusy(false);
    }
  };

  const handleUnpay = async () => {
    const { sale, newStatus, linked } = unpayTarget;
    setBusy(true);
    try {
      for (const i of linked) await removeIncome(i.id);
      await update(sale.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}, income entry removed`);
      setUnpayTarget(null);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  const handleAddExpense = async (form) => {
    const sale = expenseSale;
    setBusy(true);
    try {
      await addExpense({
        ...form,
        amount: Number(form.amount) || 0,
        source: 'Sale',
        saleId: sale.id,
        reference: sale.invoiceNumber || sale.id,
      });
      toast.success('Expense recorded');
      setExpenseSale(null);
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const sale = deleteTarget;
    setBusy(true);
    try {
      for (const i of linkedIncomeOf(sale, incomeData)) await removeIncome(i.id);
      for (const e of linkedExpensesOf(sale, expenseData)) await removeExpense(e.id);
      if (sale.publicId) await deletePublicInvoice(sale.publicId);
      await remove(sale.id);
      toast.success('Sale deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const TABLE_COLS = 8;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.length} sales · Received: {formatCurrency(receivedTotal)} · Awaiting payment: {formatCurrency(pendingTotal)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={openQuick}><Plus size={16} /> Quick Sale (no bill)</Button>
          <Button onClick={openAdd}><FileText size={16} /> New Sale Bill</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search bills..." />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Status</option>
            {SALE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No sales"
            description={search || statusFilter ? 'Try different filters' : 'Generate a sale bill or record a quick sale'}
            action={!search && !statusFilter && <Button onClick={openAdd} size="sm"><FileText size={14} /> New Sale Bill</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['', 'Bill No', 'Date', 'Customer', 'Items', 'Total', 'Status', 'Actions'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap
                      ${h === 'Actions' ? 'text-right' : ''} ${h === '' ? 'w-8' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const status = saleStatus(s);
                  const isExpanded = expandedId === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr onClick={() => setExpandedId((p) => (p === s.id ? null : s.id))}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer border-b border-gray-50 ${isExpanded ? 'bg-gray-50/40' : ''}`}>
                        <td className="px-3 py-3">
                          <span className="p-0.5 rounded text-gray-400 inline-flex">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                          {s.invoiceNumber || <span className="font-sans text-gray-400 italic">No bill</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(s.date)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{s.customerName || '—'}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{s.itemName}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-600 whitespace-nowrap">{formatCurrency(s.totalAmount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select value={status} onChange={(e) => handleStatusChange(s, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUS_STYLES[status]}`}>
                            {SALE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ShareActions sale={s} compact />
                            {!s.invoice && (
                              <button title="Generate bill for this sale" onClick={(e) => { e.stopPropagation(); openMakeBill(s); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                <FileText size={15} />
                              </button>
                            )}
                            <button title={s.invoice ? 'Edit bill' : 'Edit sale'} onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Pencil size={15} />
                            </button>
                            <button title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <SaleExpandedRow
                          sale={s}
                          linkedIncome={linkedIncomeOf(s, incomeData)}
                          linkedExpenses={linkedExpensesOf(s, expenseData)}
                          colSpan={TABLE_COLS}
                          onAddExpense={() => setExpenseSale(s)}
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

      <Modal open={formOpen} onClose={closeForm} size="xl"
        title={!editing ? 'New Sale Bill' : editing.invoice ? `Edit Sale Bill — ${editing.invoiceNumber}` : 'Generate Bill for Sale'}>
        {formOpen && (
          <SaleBillForm sale={editing} customers={customers} onSubmit={handleSaveBill} onCancel={closeForm} loading={submitting} />
        )}
      </Modal>

      <Modal open={quickOpen} onClose={closeQuick} size="md" title={editingQuick ? 'Edit Sale' : 'Quick Sale (no bill)'}>
        {quickOpen && (
          <QuickSaleForm sale={editingQuick} customers={customers} onSubmit={handleSaveQuick} onCancel={closeQuick} loading={submitting} />
        )}
      </Modal>

      <Modal open={!!shareSale} onClose={() => setShareSale(null)} title={`${shareSale?.invoiceNumber || ''} is ready`} size="md">
        {shareSale && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Sale bill for <span className="font-medium text-gray-900">{shareSale.customerName}</span> ·{' '}
              <span className="font-medium text-gray-900">{formatCurrency(shareSale.totalAmount)}</span>. Status set to “Bill Sent”.
            </p>
            {!shareSale.customerPhone && (
              <p className="text-xs text-amber-600">No phone number on this bill — WhatsApp will ask you to pick the contact.</p>
            )}
            <ShareActions sale={shareSale} />
          </div>
        )}
      </Modal>

      <Modal open={!!paymentTarget} onClose={() => setPaymentTarget(null)} title="Record Payment" size="md">
        {paymentTarget && (
          <PaymentForm sale={paymentTarget.sale} newStatus={paymentTarget.newStatus}
            onSubmit={handleRecordPayment} onCancel={() => setPaymentTarget(null)} loading={busy} />
        )}
      </Modal>

      <Modal open={!!expenseSale} onClose={() => setExpenseSale(null)} title={`Add Expense — ${expenseSale?.invoiceNumber || ''}`} size="md">
        {expenseSale && (
          <SaleExpenseForm sale={expenseSale} onSubmit={handleAddExpense} onCancel={() => setExpenseSale(null)} loading={busy} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!unpayTarget}
        onClose={() => setUnpayTarget(null)}
        onConfirm={handleUnpay}
        loading={busy}
        title={`Move to ${unpayTarget?.newStatus || ''}?`}
        confirmLabel="Remove income & move"
        message={`This sale has ${formatCurrency(unpayTarget?.linked.reduce((t, i) => t + (Number(i.amount) || 0), 0))} recorded as income. Moving it to “${unpayTarget?.newStatus}” will remove that income entry.`}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={busy}
        title="Delete Sale"
        message={`Delete ${deleteTarget?.invoiceNumber || 'this sale'}? Its income and expense entries will be removed and the customer's link will stop working. This cannot be undone.`}
      />
    </div>
  );
}

