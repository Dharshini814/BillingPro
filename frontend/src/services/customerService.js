import api from "./api";

export const customerService = {
  async list({ search = "", status = "all", page = 1, pageSize = 8 } = {}) {
    const { data } = await api.get("/customers/", {
      params: {
        search,
        status: status === "all" ? "all" : status.toLowerCase(),
        page,
        pageSize,
      },
    });
    return {
      items: data.items.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        phone: c.phone,
        address: c.address,
        status: c.status,
        country: c.country || "India",
        currency: c.currency || "INR",
        joined: c.joined,
        plan: c.plan,
        mrr: c.mrr,
      })),
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    };
  },

  async get(id) {
    const { data } = await api.get(`/customers/${id}`);
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      company: data.company,
      phone: data.phone,
      address: data.address,
      status: data.status,
      country: data.country || "India",
      currency: data.currency || "INR",
      joined: data.joined,
      plan: data.plan,
      mrr: data.mrr,
    };
  },

  async create(customer) {
    const { data } = await api.post("/customers/", {
      name: customer.name,
      email: customer.email,
      company_name: customer.company,
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      country: customer.country || "India",
      currency: customer.currency || "INR",
    });
    return data;
  },

  async update(id, customer) {
    const { data } = await api.put(`/customers/${id}`, {
      name: customer.name,
      email: customer.email,
      company_name: customer.company,
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      country: customer.country || "India",
      currency: customer.currency || "INR",
    });
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/customers/${id}`);
    return data;
  },
};
