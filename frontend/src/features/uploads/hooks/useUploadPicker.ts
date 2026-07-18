import { useCallback } from 'react'
import { useUploads } from '../UploadProvider'
import type { FolderRef } from '@features/drive-explorer/types'

/**
 * Abre un selector de archivos (o de carpeta) y encola la subida al destino.
 */
export function useUploadPicker(folderId: FolderRef) {
  const { enqueue } = useUploads()

  const open = useCallback(
    (directory: boolean) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      if (directory) {
        input.setAttribute('webkitdirectory', '')
        input.setAttribute('directory', '')
      }
      input.style.display = 'none'
      input.addEventListener('change', () => {
        const files = input.files ? Array.from(input.files) : []
        if (files.length > 0) enqueue(files, folderId)
        input.remove()
      })
      document.body.appendChild(input)
      input.click()
    },
    [enqueue, folderId]
  )

  return {
    pickFiles: () => open(false),
    pickFolder: () => open(true),
  }
}
