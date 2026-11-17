import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Eye, Loader2 } from 'lucide-react';
import { getPublicInvoice } from '../services/firebase/publicInvoices';
import { computeSaleTotals, downloadInvoicePDF, openInvoicePDF } from '../utils/saleInvoice';

// Customer-facing page opened from the WhatsApp link. No login; the PDF is rebuilt
// in the browser from the bill data, nothing is stored as a file.
export default function PublicInvoice() {
  const { publicId } = useParams();
  const [state, setState] = useState({ loading: true, invoice: null, error: '' });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPublicInvoice(publicId)
      .then((invoice) => {
        if (cancelled) return;
        setState({ loading: false, invoice, error: invoice ? '' : 'This invoice link is not valid or has been removed.' });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, invoice: null, error: 'Could not load the invoice. Please try again later.' });
      });
    return () => { cancelled = true; };
  }, [publicId]);

  useEffect(() => {
    document.title = state.invoice ? `${state.invoice.invoiceNumber} | People & Style` : 'Invoice | People & Style';
  }, [state.invoice]);

  const run = (key, fn) => async () => {
    setBusy(key);
    try { await fn(state.invoice); } catch { alert('Could not create the PDF. Please try again.'); } finally { setBusy(''); }
  };

  const inv = state.invoice;
  const total = inv ? computeSaleTotals(inv).grandTotal : 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#F5F7FF' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-lg overflow-hidden" style={{ background: '#FFFFFF', color: '#1A1A2E' }}>
        <div style={{ background: '#1A1A2E', height: 6 }} />
        <div className="p-6 space-y-5">
          <div>
            <div className="text-lg font-bold">People &amp; Style</div>
            <div className="text-xs" style={{ color: '#555555' }}>Fashion Rental Services</div>
          </div>

          {state.loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#555555' }}>
              <Loader2 size={16} className="animate-spin" /> Loading your invoice…
            </div>
          ) : state.error ? (
            <p className="text-sm" style={{ color: '#c0392b' }}>{state.error}</p>
          ) : (
            <>
              <div className="rounded-xl p-4 space-y-1" style={{ background: '#F5F7FF', border: '1px solid #DDDDDD' }}>
                <div className="text-xs font-semibold tracking-wide" style={{ color: '#888888' }}>SALE BILL</div>
                <div className="font-semibold">{inv.invoiceNumber}</div>
                <div className="text-sm" style={{ color: '#444444' }}>{inv.customerName} · {inv.date}</div>
                <div className="text-xl font-bold pt-1">
                  ₹ {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="space-y-2">
                <button onClick={run('dl', downloadInvoicePDF)} disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold disabled:opacity-60"
                  style={{ background: '#1A1A2E', color: '#FFFFFF' }}>
                  {busy === 'dl' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download Invoice (PDF)
                </button>
                <button onClick={run('view', openInvoicePDF)} disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium disabled:opacity-60"
                  style={{ background: '#FFFFFF', color: '#1A1A2E', border: '1px solid #CCCCCC' }}>
                  {busy === 'view' ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} View Invoice
                </button>
              </div>
              <p className="text-xs text-center" style={{ color: '#888888' }}>Thank you for shopping at People &amp; Style!</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
