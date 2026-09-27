import UserAvatar from '@/shared/components/UserAvatar'

// An inline image so the example needs no network; in a page, src is the user's avatar URL from the API
const PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="lightsteelblue"/><stop offset="1" stop-color="slategray"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="26" r="11" fill="white" fill-opacity=".9"/><path d="M12 58c3-11 11-17 20-17s17 6 20 17" fill="white" fill-opacity=".9"/></svg>',
  )

const TEAM = [
  { id: 1, name: 'Avery Chen', avatar: PHOTO },
  { id: 2, name: 'Blake Ito', avatar: null },
  { id: 3, name: 'Casey Park', avatar: null },
  { id: 4, name: 'Drew Silva', avatar: null },
]

export default function UserAvatars() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      {/* The image when src loads; otherwise the first letter of name */}
      <div className="flex items-center gap-3">
        <UserAvatar src={PHOTO} name="Avery Chen" />
        <UserAvatar name="Blake Ito" />
        <UserAvatar src={null} name={null} />
      </div>
      {/* Size comes from className; scale the letter with fallbackClassName */}
      <div className="flex items-end gap-3">
        <UserAvatar name="Casey Park" className="size-6" fallbackClassName="text-[10px]" />
        <UserAvatar name="Casey Park" />
        <UserAvatar name="Casey Park" className="size-12" fallbackClassName="text-base" />
        <UserAvatar src={PHOTO} name="Avery Chen" className="size-16" />
      </div>
      {/* A stacked group: overlap with negative space and a ring in the card color */}
      <div className="flex -space-x-2">
        {TEAM.map((u) => (
          <UserAvatar key={u.id} src={u.avatar} name={u.name} className="ring-card ring-2" />
        ))}
      </div>
    </div>
  )
}
