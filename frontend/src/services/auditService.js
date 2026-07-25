import api from './api'

export const auditService = {
  async list({ entity = 'all', action = 'all', search = '', page = 1, pageSize = 10 } = {}) {
    const { data } = await api.get('/audit-logs/', {
      params: { entity, action, search, page, pageSize }
    })
    return data
  },
}
