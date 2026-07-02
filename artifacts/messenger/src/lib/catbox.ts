export async function uploadToCatbox(file: File): Promise<string> {
  // Try Catbox
  try {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', file)
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form })
    const text = await res.text()
    if (text.startsWith('http')) return text.trim()
  } catch {}
  
  // Fallback to Litterbox
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('time', '72h')
  form.append('fileToUpload', file)
  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form })
  const text = await res.text()
  if (!text.startsWith('http')) throw new Error('Upload failed: ' + text)
  return text.trim()
}
