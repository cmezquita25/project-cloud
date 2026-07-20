import { api } from '@shared/api'

export const supportApi = {
  report: async (subject: string, message: string, files: File[]) => {
    const formData = new FormData()
    formData.append('subject', subject)
    formData.append('message', message)
    files.forEach((file) => {
      formData.append('attachments[]', file)
    })
    
    return api.post<{ ok: true }>('/support/report', formData)
  }
}
