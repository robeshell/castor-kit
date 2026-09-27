import { useState } from 'react'
import AvatarUpload from '@/shared/components/upload/AvatarUpload'

export default function AvatarPicker() {
  // The value is a URL: '/api/admin/files/<id>' after an upload, an address typed in by hand, or '' for none
  const [avatar, setAvatar] = useState('')

  return (
    <div className="space-y-3">
      {/* name feeds the fallback letter; the size limit defaults to the server's */}
      <AvatarUpload value={avatar} onChange={setAvatar} name="Mia Chen" />
      <p className="text-muted-foreground font-mono text-xs break-all">value: {JSON.stringify(avatar)}</p>
    </div>
  )
}
