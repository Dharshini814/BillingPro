import api from './api'

export const auditService = {
  async list({ entity = 'all', action = 'all', search = '', customer_id, date_from, date_to, page = 1, pageSize = 15 } = {}) {
    const params = { entity, action, search, page, pageSize }
    if (customer_id) params.customer_id = customer_id
    if (date_from)   params.date_from   = date_from
    if (date_to)     params.date_to     = date_to
    const { data } = await api.get('/audit-logs/', { params })
    return data
  },
}
