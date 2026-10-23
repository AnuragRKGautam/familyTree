import { supabase } from '../lib/supabaseClient'
import { DataAccessError, toDataAccessError } from './errors'
import { setPersonPhotoPath } from './people'

export const PERSON_PHOTOS_BUCKET = 'person-photos'

export async function getSignedPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(PERSON_PHOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) throw toDataAccessError(error, 'Failed to create photo URL')
  return data.signedUrl
}

export async function uploadPersonPhoto(personId: string, file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'jpg'
  const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
  const path = `${personId}/${crypto.randomUUID()}.${safeExt}`

  const { error } = await supabase.storage.from(PERSON_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    if (error.message.toLowerCase().includes('policy') || error.message.toLowerCase().includes('denied')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to upload photo')
  }

  await setPersonPhotoPath(personId, path)
  return path
}
