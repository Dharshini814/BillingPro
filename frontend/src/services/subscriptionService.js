import api from "./api";

const mapSubscription = (sub) => ({
  id: sub.id,
  customerId: sub.customerId,
  planId: sub.planId,
  customerName: sub.customerName,
  company: sub.company,
  plan: sub.plan,
  amount: sub.amount,
  billingCycle: sub.billingCycle,
  status: sub.status === "cancelled" ? "canceled" : sub.status,
  startDate: sub.startedAt,
  nextBilling: sub.nextBilling,
  cancelledAt: sub.cancelledAt,
  createdAt: sub.createdAt,
  planChanges: sub.planChanges || [],
});

export const subscriptionService = {
  async list({ status = "all", page = 1, pageSize = 8, customer_email = null } = {}) {
    const params = { status, page, pageSize };
    if (customer_email) params.customer_email = customer_email;
    const { data } = await api.get("/subscriptions/", { params });
    return {
      items: data.items.map(mapSubscription),
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    };
  },

  async get(id) {
    const { data } = await api.get(`/subscriptions/${id}`);
    return mapSubscription(data);
  },

  async create(subscription) {
    const { data } = await api.post("/subscriptions/", {
      customer_id: subscription.customerId,
      plan_id: subscription.planId,
      status: subscription.status,
      amount: subscription.amount,
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate,
    });
    return mapSubscription(data);
  },

  async update(id, subscription) {
    const { data } = await api.put(`/subscriptions/${id}`, {
      customer_id: subscription.customerId,
      plan_id: subscription.planId,
      status: subscription.status,
      amount: subscription.amount,
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate,
    });
    return mapSubscription(data);
  },

  async remove(id) {
    const { data } = await api.delete(`/subscriptions/${id}`);
    return data;
  },

  async updateStatus(id, status) {
    const normalized = status === "canceled" ? "cancelled" : status;
    const { data } = await api.patch(`/subscriptions/${id}`, { status: normalized });
    return mapSubscription(data);
  },

  async pause(id) { return this.updateStatus(id, "paused"); },
  async resume(id) { return this.updateStatus(id, "active"); },
  async cancel(id) { return this.updateStatus(id, "canceled"); },

  async previewPlanChange(subscriptionId, newPlanId) {
    const { data } = await api.post(`/subscriptions/${subscriptionId}/preview-plan-change`, { new_plan_id: newPlanId });
    return data;
  },

  async changePlan(subscriptionId, newPlanId) {
    const { data } = await api.post(`/subscriptions/${subscriptionId}/change-plan`, { new_plan_id: newPlanId });
    return data;
  },

  async upgrade(id, planId) { return this.changePlan(id, planId); },
};
