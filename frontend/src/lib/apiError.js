export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error?.response) {
    return error?.code === 'ECONNABORTED'
      ? 'The server took too long to respond.'
      : 'Cannot reach the server. Is the backend running?'
  }

  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item.msg?.replace(/^Value error, /, '')).filter(Boolean).join(' ')
  }
  return fallback
}
