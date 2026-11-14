import { useEffect, useState } from 'react'

import { fetchResolutionPhoto } from '../../services/authApi'

export function ResolutionPhoto({ complaintId, photoId, representative = false }) {
  const [source, setSource] = useState('')

  useEffect(() => {
    let active = true
    let objectUrl
    fetchResolutionPhoto(complaintId, photoId, representative).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setSource(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [complaintId, photoId, representative])

  return source ? <img src={source} alt="Solution provided by the organization" /> : null
}
