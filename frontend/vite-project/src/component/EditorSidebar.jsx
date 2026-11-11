
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './EditorSidebar.css'

function EditorSidebar({ roomId, members = [] }) {

  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  async function copyRoomId() {
    if (!roomId) return

    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 1800)

    } catch (error) {
      console.error('Could not copy room ID:', error)
    }
  }

  function leaveRoom() {
    navigate('/')
  }

  return (
    <aside className="editor-sidebar">

      {/* BRAND */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <span className="logo-symbol">⌘</span>
        </div>

        <div className="sidebar-brand-divider"></div>

        <span className="brand-name">CODECAST</span>

        <span className="brand-star">✦</span>
      </div>

      {/* MEMBERS */}
      <section className="sidebar-members">

        <div className="sidebar-section-heading">
          <span>MEMBERS</span>
          <span className="member-count">
            {members.length}
          </span>
        </div>

        
<div className="member-list">

  {members.length === 0 ? (
    <p className="empty-members">
      Waiting for players...
    </p>
  ) : (

    members.map((member, index) => (

      <div
        className="member-item"
        key={member.id || index}
      >

        {/* PIXEL AVATAR */}

        <div className="member-avatar-frame">

          <img
            src={member.avatar}
            alt={`${member.username}'s avatar`}
            className="member-avatar"
          />

        </div>

        {/* ONLINE STATUS */}

        <span className="member-status"></span>

        {/* USERNAME */}

        <span className="member-name">
          {member.username || member.name || 'Anonymous'}
        </span>

        <span className="member-star">✦</span>

      </div>

    ))

  )}

</div>

      </section>

      {/* ROOM ACTIONS */}
      <div className="sidebar-actions">

        <button
          className="sidebar-button copy-room-button"
          onClick={copyRoomId}
          type="button"
        >
          <span>▣</span>
          {copied ? 'COPIED!' : 'COPY ROOM ID'}
        </button>

        <button
          className="sidebar-button leave-room-button"
          onClick={leaveRoom}
          type="button"
        >
          <span>↩</span>
          LEAVE ROOM
        </button>

      </div>

      <div className="sidebar-footer">
        <span className="footer-pixel">✦</span>
        CODE TOGETHER ♡
      </div>

    </aside>
  )
}

export default EditorSidebar
