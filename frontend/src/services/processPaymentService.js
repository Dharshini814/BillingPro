import api from './api'

export const processPaymentService = {

  /**
   * Task 3 – Process a payment (80/20 mock gateway)
   */
  async process({ invoice_id, amount }) {
    const { data } = await api.post('/payments/process', { invoice_id, amount })
    return data
  },

  /**
   * Task 3 – Send webhook event manually
   */
  async sendWebhook({ event, invoice_id, payment_id }) {
    const { data } = await api.post('/webhooks/payment', { event, invoice_id, payment_id })
    return data
  },

  /**
   * Task 4 – List failed payment retry queue
   */
  async listRetries({ status = 'pending', page = 1, pageSize = 20 } = {}) {
    const { data } = await api.get('/payment-retries/', { params: { status, page, pageSize } })
    return data
  },

  /**
   * Task 4 – Run due retries
   */
  async runRetries() {
    const { data } = await api.post('/payment-retries/run')
    return data
  },

  /**
   * Task 4 – Issue a refund
   */
  async createRefund({ invoice_id, refund_amount, reason }) {
    const payload = { invoice_id }
    if (refund_amount !== undefined) payload.refund_amount = refund_amount
    if (reason) payload.reason = reason
    const { data } = await api.post('/refunds', payload)
    return data
  },

  /**
   * Task 4 – List refund history
   */
  async listRefunds({ page = 1, pageSize = 20 } = {}) {
    const { data } = await api.get('/refunds', { params: { page, pageSize } })
    return data
  },

  /**
   * Task 5 – Get tax breakdown
   */
  async getInvoiceTax(invoiceId) {
    const { data } = await api.get(`/invoices/${invoiceId}/tax`)
    return data
  },

  /**
   * Task 5 – Recalculate & save tax
   */
  async updateInvoiceTax(invoiceId, taxType) {
    const { data } = await api.post(`/invoices/${invoiceId}/tax`, { tax_type: taxType })
    return data
  },

  /**
   * Task 5 – Download PDF invoice (triggers browser download)
   */
  async downloadInvoicePdf(invoiceId, invoiceNumber) {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, {
      responseType: 'blob'
    })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber || 'invoice-' + invoiceId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return { success: true }
  }
}
