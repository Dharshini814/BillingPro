import api from "./api";

const mapPayment = (payment) => ({
  id: payment.id,
  invoiceId: payment.invoiceId ?? payment.invoice_id ?? null,
  customer: payment.customer ?? payment.customerName ?? payment.customer_name ?? "",
  paymentReference: payment.paymentReference ?? payment.reference ?? payment.payment_reference ?? "",
  amount: payment.amount ?? 0,
  paymentMethod: payment.paymentMethod ?? payment.method ?? payment.payment_method ?? "",
  status: payment.status ?? "pending",
  paymentDate: payment.paymentDate ?? payment.processedAt ?? payment.payment_date ?? payment.createdAt ?? payment.created_at ?? null,
  createdAt: payment.createdAt ?? payment.created_at ?? null,
  updatedAt: payment.updatedAt ?? payment.updated_at ?? null,
});

export const paymentService = {
  async list({ status = "all", page = 1, pageSize = 8, customer_email = null } = {}) {
    const params = { page, pageSize };
    if (status !== "all") params.status = status;
    if (customer_email) params.customer_email = customer_email;
    const { data } = await api.get("/payments/", { params });
    const arr = Array.isArray(data) ? data : data.items || [];
    return {
      items: arr.map(mapPayment),
      total: data.total ?? arr.length,
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
    };
  },

  async get(id) {
    const { data } = await api.get(`/payments/${id}`);
    return mapPayment(data);
  },

  async create(payment) {
    const { data } = await api.post("/payments/", {
      invoice_id: payment.invoiceId,
      payment_reference: payment.paymentReference,
      amount: payment.amount,
      payment_method: payment.paymentMethod,
      status: payment.status,
    });
    return mapPayment(data);
  },

  async update(id, payment) {
    const { data } = await api.put(`/payments/${id}`, {
      payment_reference: payment.paymentReference,
      amount: payment.amount,
      payment_method: payment.paymentMethod,
      status: payment.status,
    });
    return mapPayment(data);
  },

  async remove(id) {
    const { data } = await api.delete(`/payments/${id}`);
    return data;
  },

  async refund(id) {
    const payment = await this.get(id);
    return this.update(id, { ...payment, status: "refunded" });
  },

  async process({ invoice_id, amount }) {
    const { data } = await api.post('/payments/process', { invoice_id, amount });
    return data;
  },
};
