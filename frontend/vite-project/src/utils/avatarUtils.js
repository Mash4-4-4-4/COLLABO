
const AVATARS = [
  '/avatars/avatar-1.png',
  '/avatars/avatar-2.png',
  '/avatars/avatar-3.png',
  '/avatars/avatar-4.png',
  '/avatars/avatar-5.png',
  '/avatars/avatar-6.png'
]

// Shuffle the avatar collection
export function shuffleAvatars() {
  return [...AVATARS].sort(() => Math.random() - 0.5)
}

// Assign an unused avatar to a new member
export function getRandomAvatar(members = []) {

  const usedAvatars = members.map(member => member.avatar)

  const availableAvatars = AVATARS.filter(
    avatar => !usedAvatars.includes(avatar)
  )

  // If all avatars are being used, start allowing duplicates
  const pool = availableAvatars.length > 0
    ? availableAvatars
    : AVATARS

  return pool[Math.floor(Math.random() * pool.length)]
}
