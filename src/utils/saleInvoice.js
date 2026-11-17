import { auth } from '../services/firebase/config';

// pdfkit is large (~1.2 MB) — load it only when a bill is actually downloaded or viewed.
const createInvoicePDF = (invoice) => import('./invoicePdf').then((m) => m.createInvoicePDF(invoice));

export const SALE_STATUSES = ['Bill Sent', 'Payment Received', 'Shipped', 'Delivered', 'Cancelled'];
// Statuses that mean the money has come in — a sale in any of these has an income entry.
export const PAID_STATUSES = ['Payment Received', 'Shipped', 'Delivered'];
// Same options as the invoice generator form.
export const INVOICE_PAYMENT_MODES = ['Cash', 'PhonePe', 'GPay', 'NEFT', 'Card'];
export const SALE_EXPENSE_CATEGORIES = ['Shipping', 'Packaging', 'Courier', 'Other'];

// Invoice generator's last bill was INV-022, so the ERP series continues after it.
const INVOICE_SERIES_FLOOR = 22;

export const isPaidStatus = (status) => PAID_STATUSES.includes(status);

// Old sales (entered before invoices existed) have no status and already have income.
export const saleStatus = (sale) => sale.status || 'Payment Received';

// Mirrors the sale-bill math in invoicePdf.js so the ERP total always matches the PDF.
export function computeSaleTotals(invoice) {
  const items = invoice?.items || [];
  const discount = parseFloat(invoice?.discount) || 0;
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const discountAmt = subtotal * discount / 100;
  const delivery = invoice?.deliveryCharge || {};
  const deliveryAmount = delivery.depends ? 0 : parseFloat(delivery.amount) || 0;
  const grandTotal = subtotal - discountAmt + deliveryAmount;
  return { subtotal, discountAmt, deliveryAmount, grandTotal };
}

export function nextInvoiceNumber(sales) {
  const max = sales.reduce((m, s) => {
    const match = String(s.invoiceNumber || '').match(/INV-(\d+)/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, INVOICE_SERIES_FLOOR);
  return `INV-${String(max + 1).padStart(3, '0')}`;
}

// Same date format the invoice generator printed on bills.
export function formatInvoiceDate(d = new Date()) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Unguessable id for the customer's public link.
export function generatePublicId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(22));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function publicInvoiceUrl(publicId) {
  return `${window.location.origin}/invoice/${publicId}`;
}

export function invoiceFileName(invoice) {
  const safeName = (invoice.customerName || 'Customer').replace(/\s+/g, '_');
  return `${invoice.invoiceNumber}_${safeName}.pdf`;
}

export async function downloadInvoicePDF(invoice) {
  const blob = await createInvoicePDF(invoice);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = invoiceFileName(invoice);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openInvoicePDF(invoice) {
  const win = window.open('', '_blank');
  const blob = await createInvoicePDF(invoice);
  const url = URL.createObjectURL(blob);
  if (win) win.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

function formatRupees(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// 10-digit Indian numbers get the 91 country code; anything else is used as typed.
export function normalizeWhatsAppPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

export function whatsappShareUrl(sale) {
  const invoice = sale.invoice;
  const { grandTotal } = computeSaleTotals(invoice);
  const message =
    `Hi ${invoice.customerName}, thank you for shopping at People & Style! ` +
    `Here is your bill ${invoice.invoiceNumber} for ${formatRupees(grandTotal)}: ${publicInvoiceUrl(sale.publicId)}`;
  const phone = normalizeWhatsAppPhone(invoice.customerPhone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// Accepts a full listing link (https://peopleandstyle.in/product/<id>) or a bare id.
export function parseProductId(input) {
  const text = String(input || '').trim();
  const fromUrl = text.match(/\/product\/([a-f0-9]{24})(?:[/?#]|$)/i);
  if (fromUrl) return fromUrl[1];
  return /^[a-f0-9]{24}$/i.test(text) ? text : null;
}

export async function fetchProductFromLink(input) {
  const id = parseProductId(input);
  if (!id) throw new Error('Not a valid product link');
  const user = auth.currentUser;
  if (!user) throw new Error('Please log in again');
  const token = await user.getIdToken();
  const res = await fetch(`/api/product?id=${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not fetch product');
  return body; // { id, name, price, listingType }
}
