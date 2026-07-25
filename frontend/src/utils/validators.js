export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function getPasswordStrength(password = '') {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 1) return { score, label: 'Weak', color: '#FF5A5A' }
  if (score <= 3) return { score, label: 'Fair', color: '#FFB547' }
  if (score === 4) return { score, label: 'Good', color: '#D4A800' }
  return { score, label: 'Strong', color: '#4CAF50' }
}

export function required(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0
}
