// Ported verbatim from "invoice generator/generateInvoice.js" — layout untouched.
// Changes: runs in the browser (pdfkit standalone), returns a Blob instead of a Buffer,
// and embeds Arimo (Helvetica-metric, has ₹) as the default font and under the Helvetica names,
// so the ₹ symbol renders (built-in Helvetica has no ₹ glyph).
import PDFDocument from 'pdfkit/js/pdfkit.standalone';

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function numToWords(n) {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numToWords(n%100) : '');
  if (n < 100000) return numToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numToWords(n%1000) : '');
  return numToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numToWords(n%100000) : '');
}

function drawInvoice(invoice, fonts) {
  return new Promise((resolve, reject) => {
    try {
      const isRent = invoice.type === 'rent';
      const doc = new PDFDocument({ margin: 0, size: 'A4', font: fonts.regular });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(new Blob(buffers, { type: 'application/pdf' })));

      // ₹ fix: map the Helvetica names to Arimo (Helvetica-metric font that has the ₹ glyph)
      doc.registerFont('Helvetica', fonts.regular);
      doc.registerFont('Helvetica-Bold', fonts.bold);

      const PW = 595.28, PH = 841.89, M = 30, CW = PW - M * 2;

      const hline = (y, x1 = M, x2 = PW - M, w = 0.5, color = '#CCCCCC') => {
        doc.save().strokeColor(color).lineWidth(w).moveTo(x1, y).lineTo(x2, y).stroke().restore();
      };
      const rect = (x, y, w, h, fill = null, stroke = '#CCCCCC', sw = 0.5) => {
        doc.save();
        if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, stroke);
        else doc.rect(x, y, w, h).lineWidth(sw).stroke(stroke);
        doc.restore();
      };

      // ─── HEADER ──────────────────────────────────────────────────────────
      rect(0, 0, PW, 6, '#1A1A2E', '#1A1A2E');
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1A1A2E').text('People & Style', M, 18, { width: 200 });
      doc.font('Helvetica').fontSize(8).fillColor('#555555').text('Fashion Rental Services', M, 37, { width: 200 });

      const title = isRent ? 'TAX INVOICE' : 'SALE BILL';
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#1A1A2E').text(title, 0, 20, { width: PW, align: 'center' });

      const metaX = PW - M - 170;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1A1A2E').text('INVOICE NO:', metaX, 18, { width: 80 });
      doc.font('Helvetica').fontSize(8).fillColor('#333').text(invoice.invoiceNumber, metaX + 75, 18, { width: 95 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1A1A2E').text('DATE:', metaX, 32, { width: 80 });
      doc.font('Helvetica').fontSize(8).fillColor('#333').text(invoice.date, metaX + 75, 32, { width: 95 });

      let Y = 60;
      hline(Y, M, PW - M, 1, '#1A1A2E');
      Y += 8;

      // ─── SELLER + BUYER ───────────────────────────────────────────────────
      const colW = CW * 0.5 - 5;
      const rightX = M + colW + 10;

      rect(M, Y, colW, 100, '#F5F7FF', '#DDDDDD');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#888').text('SUPPLIER (SELLER)', M + 8, Y + 7, { width: colW - 16 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1A2E').text('People & Style', M + 8, Y + 19, { width: colW - 16 });
      doc.font('Helvetica').fontSize(8).fillColor('#444')
        .text('Mysuru, Karnataka - 570026', M + 8, Y + 33, { width: colW - 16 })
        .text('GSTIN: 29XXXXX0000X1Z5', M + 8, Y + 53, { width: colW - 16 })
        .text('Phone: 9187668280', M + 8, Y + 65, { width: colW - 16 })
        .text('Email: hello@peopleandstyle.in', M + 8, Y + 77, { width: colW - 16 });

      rect(rightX, Y, colW, 100, '#F5F7FF', '#DDDDDD');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#888').text('BILL TO (CUSTOMER)', rightX + 8, Y + 7, { width: colW - 16 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1A2E').text(invoice.customerName || 'Customer', rightX + 8, Y + 19, { width: colW - 16 });
      doc.font('Helvetica').fontSize(8).fillColor('#444');
      if (invoice.customerPhone) doc.text(`Phone: ${invoice.customerPhone}`, rightX + 8, Y + 33, { width: colW - 16 });
      if (invoice.customerEmail) doc.text(`Email: ${invoice.customerEmail}`, rightX + 8, Y + 45, { width: colW - 16 });
      if (invoice.customerAddress) doc.text(`Address: ${invoice.customerAddress}`, rightX + 8, Y + 57, { width: colW - 16 });

      Y += 110;

      // ─── META ROW ─────────────────────────────────────────────────────────
      rect(M, Y, CW, 30, '#1A1A2E', '#1A1A2E');
      const metaCols = isRent
        ? [
            { label: 'PLACE OF SUPPLY', value: 'Karnataka - 29' },
            { label: 'PAYMENT MODE',    value: invoice.paymentMode || 'Cash' },
            { label: 'TXN REFERENCE',   value: (invoice.paymentReference || 'N/A').toString().slice(0, 22) },
          ]
        : [
            { label: 'TYPE',         value: 'Sale' },
            { label: 'PAYMENT MODE', value: invoice.paymentMode || 'Cash' },
            { label: 'DISCOUNT',     value: `${invoice.discount || 0}%` },
            { label: 'TXN REFERENCE', value: (invoice.paymentReference || 'N/A').toString().slice(0, 22) },
          ];

      const mcW = CW / metaCols.length;
      metaCols.forEach((col, i) => {
        const cx = M + i * mcW;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#AAAAAA').text(col.label, cx + 6, Y + 5, { width: mcW - 12 });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(col.value, cx + 6, Y + 16, { width: mcW - 12 });
        if (i < metaCols.length - 1)
          doc.save().strokeColor('#444466').lineWidth(0.5).moveTo(cx + mcW, Y + 4).lineTo(cx + mcW, Y + 26).stroke().restore();
      });
      Y += 38;

      // ─── ITEMS TABLE ──────────────────────────────────────────────────────
      const tHeaders = isRent
        ? ['Sr.', 'Description of Goods / Services', 'HSN/SAC', 'Qty', 'Rent (₹)', 'Advance (₹)']
        : ['Sr.', 'Description', 'HSN/SAC', 'Qty', 'Rate (₹)', 'Amount (₹)'];
      const tColW = [25, 185, 55, 30, 70, 70];
      const tRowH = 26;

      rect(M, Y, CW, tRowH - 4, '#1A1A2E', '#1A1A2E');
      let colX = M;
      tHeaders.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
        doc.text(h, colX + 5, Y + 7, { width: tColW[i] - 10, align: i >= 3 ? 'right' : 'left' });
        colX += tColW[i];
      });
      Y += tRowH - 4;

      invoice.items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#FAFAFA' : '#F5F5F5';
        const amount = item.qty * item.rate;
        const hsn = isRent ? '9973' : (item.hsn || '');
        const col5 = item.rate.toFixed(2);
        const col6 = isRent ? item.advance.toFixed(2) : amount.toFixed(2);

        rect(M, Y, CW, tRowH, bg, '#DDDDDD');
        const rowData = [String(idx + 1), item.name, hsn, String(item.qty), col5, col6];
        colX = M;
        rowData.forEach((d, i) => {
          doc.font('Helvetica').fontSize(8).fillColor('#222');
          doc.text(d, colX + 5, Y + 9, { width: tColW[i] - 10, align: i >= 3 ? 'right' : 'left' });
          if (i < tColW.length - 1)
            doc.save().strokeColor('#DDDDDD').lineWidth(0.5).moveTo(colX + tColW[i], Y).lineTo(colX + tColW[i], Y + tRowH).stroke().restore();
          colX += tColW[i];
        });
        Y += tRowH;
      });

      hline(Y, M, PW - M, 1, '#CCCCCC');
      Y += 14;

      // ─── SUMMARY ─────────────────────────────────────────────────────────
      const sumX = PW - M - 230, labW = 150, valW = 75;
      const summaryStartY = Y;

      const deliveryCharge  = invoice.deliveryCharge || {};
      const deliveryDepends = !!deliveryCharge.depends;
      const deliveryAmount  = parseFloat(deliveryCharge.amount) || 0;
      const showDelivery    = deliveryDepends || deliveryAmount > 0;
      const deliveryValue   = deliveryDepends ? 'Depends' : `₹ ${deliveryAmount.toFixed(2)}`;

      if (isRent) {
        const rentSubtotal  = invoice.items.reduce((s, i) => s + i.qty * i.rate, 0);
        const advanceTotal  = invoice.items.reduce((s, i) => s + i.advance, 0);
        const grandTotal    = rentSubtotal + advanceTotal + (deliveryDepends ? 0 : deliveryAmount);

        const summaryRows = [
          { label: 'Total Rent', value: `₹ ${rentSubtotal.toFixed(2)}` },
        ];
        if (showDelivery) summaryRows.push({ label: 'Delivery Charges', value: deliveryValue });
        summaryRows.push({ label: 'Advance – Refundable Deposit', value: `₹ ${advanceTotal.toFixed(2)}`, note: true });
        summaryRows.forEach(row => {
          doc.font('Helvetica').fontSize(8.5).fillColor(row.note ? '#666' : '#222');
          doc.text(row.label, sumX + 4, Y, { width: labW });
          doc.text(row.value, sumX + labW, Y, { width: valW, align: 'right' });
          Y += 18;
        });
        doc.font('Helvetica').fontSize(7).fillColor('#999')
          .text('The refundable deposit will be returned upon safe return of the products, unless adjusted against damages or dues.', sumX + 4, Y, { width: labW + valW + 6 });
        Y += 14;

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#333').text('Place of Supply:', M, summaryStartY, { width: sumX - M - 10 });
        doc.font('Helvetica').fontSize(7.5).fillColor('#555')
          .text('Karnataka (29)', M, summaryStartY + 11, { width: sumX - M - 10 });

        Y += 6;
        hline(Y, sumX, PW - M, 1.5, '#1A1A2E');
        Y += 8;

        rect(sumX, Y - 2, labW + valW + 10, 24, '#1A1A2E', '#1A1A2E');
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFF')
          .text('TOTAL AMOUNT PAID', sumX + 4, Y + 5, { width: labW })
          .text(`₹ ${grandTotal.toFixed(2)}`, sumX + labW, Y + 5, { width: valW, align: 'right' });
        Y += 34;

        doc.font('Helvetica').fontSize(8).fillColor('#555')
          .text(`Amount in Words: ${numToWords(Math.round(grandTotal))} Rupees Only`, M, Y, { width: CW * 0.65 });
        Y += 20;

        const notes = [
          `1. The refundable advance of ₹ ${advanceTotal.toFixed(2)} will be returned in full upon safe return of the products.`,
          '2. Late return charges may apply as per the rental agreement. Any damage to the products will be charged separately.',
        ];
        if (deliveryDepends) notes.push('3. Delivery charges depend on the actual distance/service used and will be billed separately based on actuals.');

        hline(Y, M, PW - M, 0.5); Y += 8;
        const notesH = 14 + notes.length * 12;
        rect(M, Y, CW, notesH, '#FFFDF0', '#FDECC8');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#555500').text('Notes & Terms:', M + 8, Y + 7, { width: CW - 16 });
        notes.forEach((line, i) => {
          doc.font('Helvetica').fontSize(7.5).fillColor('#444400').text(line, M + 8, Y + 19 + i * 12, { width: CW - 16 });
        });

      } else {
        const discount    = parseFloat(invoice.discount) || 0;
        const subtotal    = invoice.items.reduce((s, i) => s + i.qty * i.rate, 0);
        const discountAmt = subtotal * discount / 100;
        const grandTotal  = subtotal - discountAmt + (deliveryDepends ? 0 : deliveryAmount);

        const summaryRows = [
          { label: 'Sub Total',        value: `₹ ${subtotal.toFixed(2)}` },
          { label: `Discount (${discount}%)`, value: `- ₹ ${discountAmt.toFixed(2)}`, color: '#c0392b' },
        ];
        if (showDelivery) summaryRows.push({ label: 'Delivery Charges', value: deliveryValue });
        summaryRows.forEach(row => {
          doc.font('Helvetica').fontSize(8.5).fillColor(row.color || '#222');
          doc.text(row.label, sumX + 4, Y, { width: labW });
          doc.text(row.value, sumX + labW, Y, { width: valW, align: 'right' });
          Y += 18;
        });

        Y += 4;
        hline(Y, sumX, PW - M, 1.5, '#1A1A2E');
        Y += 8;

        rect(sumX, Y - 2, labW + valW + 10, 24, '#1A1A2E', '#1A1A2E');
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFF')
          .text('TOTAL AMOUNT', sumX + 4, Y + 5, { width: labW })
          .text(`₹ ${grandTotal.toFixed(2)}`, sumX + labW, Y + 5, { width: valW, align: 'right' });
        Y += 34;

        doc.font('Helvetica').fontSize(8).fillColor('#555')
          .text(`Amount in Words: ${numToWords(Math.round(grandTotal))} Rupees Only`, M, Y, { width: CW * 0.65 });
        Y += 20;

        const notes = [
          '1. Goods once sold will not be taken back or exchanged.',
          '2. Thank you for shopping at People & Style!',
        ];
        if (deliveryDepends) notes.push('3. Delivery charges depend on the actual distance/service used and will be billed separately based on actuals.');

        hline(Y, M, PW - M, 0.5); Y += 8;
        const notesH = 14 + notes.length * 12;
        rect(M, Y, CW, notesH, '#FFFDF0', '#FDECC8');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#555500').text('Notes & Terms:', M + 8, Y + 7, { width: CW - 16 });
        notes.forEach((line, i) => {
          doc.font('Helvetica').fontSize(7.5).fillColor('#444400').text(line, M + 8, Y + 19 + i * 12, { width: CW - 16 });
        });
      }

      // ─── FOOTER ───────────────────────────────────────────────────────────
      rect(0, PH - 30, PW, 6, '#1A1A2E', '#1A1A2E');
      doc.font('Helvetica').fontSize(7.5).fillColor('#888')
        .text('This is a system-generated invoice. No signature required.', M, PH - 18, { width: CW, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

let fontsPromise = null;
function loadFonts() {
  if (!fontsPromise) {
    const get = (url) => fetch(url).then((r) => {
      if (!r.ok) throw new Error('Failed to load invoice font');
      return r.arrayBuffer();
    });
    fontsPromise = Promise.all([get('/fonts/Arimo-Regular.ttf'), get('/fonts/Arimo-Bold.ttf')])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((e) => { fontsPromise = null; throw e; });
  }
  return fontsPromise;
}

export async function createInvoicePDF(invoice) {
  const fonts = await loadFonts();
  return drawInvoice(invoice, fonts);
}

export { numToWords };
