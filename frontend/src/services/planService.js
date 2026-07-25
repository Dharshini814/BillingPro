import api from "./api";

const mapPlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  price: plan.price,
  interval: plan.interval ?? plan.billing_interval ?? plan.billingInterval ?? "month",
  billingInterval: plan.billing_interval ?? plan.billingInterval ?? plan.interval ?? "month",
  trialDays: plan.trial_days ?? plan.trialDays ?? 0,
  features: Array.isArray(plan.features) ? plan.features : [],
  subscribers: plan.subscribers ?? 0,
  color: plan.color ?? "#D4A800",
  archived: plan.archived ?? false,
});

export const planService = {
  async list({ includeArchived = false } = {}) {
    const { data } = await api.get("/plans/");
    let plans = data.map(mapPlan);
    if (!includeArchived) plans = plans.filter((p) => !p.archived);
    return plans;
  },

  async get(id) {
    const { data } = await api.get(`/plans/${id}`);
    return mapPlan(data);
  },

  async create(plan) {
    const { data } = await api.post("/plans/", {
      name: plan.name,
      price: Number(plan.price),
      billing_interval: plan.billingInterval,
      trial_days: plan.trialDays ? Number(plan.trialDays) : 0,
      features: plan.features,
    });
    return mapPlan(data);
  },

  async update(id, updates) {
    const { data } = await api.put(`/plans/${id}`, {
      name: updates.name,
      price: Number(updates.price),
      billing_interval: updates.billingInterval,
      trial_days: Number(updates.trialDays),
      features: updates.features,
    });
    return mapPlan(data);
  },

  async archive(id) {
    const { data } = await api.delete(`/plans/${id}`);
    return data;
  },

  async remove(id) {
    return this.archive(id);
  },
};
