import api from './api'


export const invoiceService = {

  async generate() {
    const { data } = await api.post('/invoices/generate')
    return data
  },

  async list({ status = 'all', search = '', dateFrom = '', dateTo = '', customer_email = null, page = 1, pageSize = 8 } = {}) {
    const params = { page, pageSize }
    if (status && status !== 'all') params.status = status
    if (search && search.trim()) params.search = search.trim()
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (customer_email) params.customer_email = customer_email

    const { data } = await api.get('/invoices/', { params })

    const invoiceArray = Array.isArray(data) ? data : data.items || []

    const invoices = invoiceArray.map((i) => ({
      id: i.id,
      number: i.number,
      customerId: i.customerId,
      subscriptionId: i.subscriptionId,
      planName: i.planName || '',
      issuedAt: i.issuedAt,
      dueAt: i.dueAt,
      subtotal: i.subtotal,
      taxAmount: i.taxAmount,
      amount: i.amount,
      status: i.status,
      customerName: i.customerName || '',
      company: i.company || '',
    }))

    return {
      items: invoices,
      total: data.total ?? invoices.length,
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
    }
  },

  async getById(id) {
    const { data } = await api.get(`/invoices/${id}`)
    return {
      id: data.id,
      number: data.number,
      customerId: data.customerId,
      subscriptionId: data.subscriptionId,
      planName: data.planName || '',
      issuedAt: data.issuedAt,
      dueAt: data.dueAt,
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      amount: data.amount,
      status: data.status,
      customerName: data.customerName || '',
      company: data.company || '',
    }
  },

  async create(invoice) {
    const payload = {
      invoice_number: invoice.number,
      subscription_id: invoice.subscriptionId,
      customer_id: invoice.customerId,
      invoice_date: invoice.issuedAt,
      due_date: invoice.dueAt,
      subtotal: invoice.subtotal,
      tax_amount: invoice.taxAmount,
      status: invoice.status,
    }
    const { data } = await api.post('/invoices/', payload)
    return data
  },

  async update(id, invoice) {
    const { data } = await api.put(`/invoices/${id}`, { status: invoice.status })
    return data
  },

  async remove(id) {
    const { data } = await api.delete(`/invoices/${id}`)
    return data
  },

  /**
   * Task 5: Download real PDF invoice from backend (reportlab)
   */
  async downloadPdf(id, invoiceNumber) {
    try {
      const response = await api.get(`/invoices/${id}/pdf`, {
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoiceNumber || 'invoice-' + id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { success: true }
    } catch (err) {
      // Fallback to HTML print if PDF endpoint fails
      console.error('PDF download failed, falling back to HTML print', err)
      const invoice = await this.getById(id)
      _generateAndDownloadPdfFallback(invoice)
      return { success: true, fallback: true }
    }
  },

  /**
   * Task 5: Get tax breakdown for an invoice
   */
  async getTax(id) {
    const { data } = await api.get(`/invoices/${id}/tax`)
    return data
  },

  /**
   * Task 5: Update tax type on an invoice
   */
  async updateTax(id, taxType) {
    const { data } = await api.post(`/invoices/${id}/tax`, { tax_type: taxType })
    return data
  }
}


function _generateAndDownloadPdfFallback(inv) {
  const issueDate = inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '—'
  const dueDate = inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'

  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0)

  const html = `
  <html><head><title>${inv.number}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 48px; color: #1a1a2e; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 28px; font-weight: 900; color: #D4A800; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 22px; color: #333; margin: 0 0 4px; }
    .invoice-meta p { margin: 2px 0; font-size: 13px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    thead tr { background: #f4f6ff; }
    thead th { padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; }
    tbody td { padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
    .totals { margin-left: auto; width: 260px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .totals .row.total { border-top: 2px solid #D4A800; font-weight: 800; font-size: 16px; color: #D4A800; }
    .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #aaa; }
  </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">Vaultly</div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <p><strong>${inv.number}</strong></p>
        <p>Issued: ${issueDate}</p>
        <p>Due: ${dueDate}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>${inv.planName || 'Subscription Plan'}</td><td style="text-align:right">${formatINR(inv.subtotal)}</td></tr>
        ${inv.taxAmount > 0 ? `<tr><td>CGST (9%)</td><td style="text-align:right">${formatINR(inv.taxAmount / 2)}</td></tr><tr><td>SGST (9%)</td><td style="text-align:right">${formatINR(inv.taxAmount / 2)}</td></tr>` : ''}
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatINR(inv.subtotal)}</span></div>
      ${inv.taxAmount > 0 ? `<div class="row"><span>Tax (GST 18%)</span><span>${formatINR(inv.taxAmount)}</span></div>` : ''}
      <div class="row total"><span>Total</span><span>${formatINR(inv.amount)}</span></div>
    </div>
    <div class="footer">Thank you for your business · Vaultly Billing System</div>
  </body></html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => win.print()
}
