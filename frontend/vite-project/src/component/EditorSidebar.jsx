import { useNavigate } from 'react-router-dom'
import './EditorSidebar.css'

function EditorSidebar({ roomId, workspace, members = [], saveWorkspace, saveState, canEdit, onHistory, onCheckpoint, onInvite, connected }) {
  const navigate = useNavigate()
  async function copyRoomId() {
    try { await navigator.clipboard.writeText(roomId) } catch { return }
  }
  return <aside className="editor-sidebar">
    <div className="sidebar-brand"><div className="sidebar-logo"><span className="logo-symbol">⌘</span></div><div className="sidebar-brand-divider"/><span className="brand-name">CODECAST</span><span className="brand-star">✦</span></div>
    <div className="sidebar-workspace-title"><strong>{workspace?.name || 'Loading workspace…'}</strong><span>{workspace?.role || ' '}</span></div>
    <section className="sidebar-members"><div className="sidebar-section-heading"><span>MEMBERS</span><span className="member-count">{members.length}</span></div><div className="member-list">{members.length===0?<p className="empty-members">{connected?'Just you for now':'Connecting…'}</p>:members.map((member,index)=><div className="member-item" key={`${member.id}-${index}`}><div className="member-avatar-frame"><img src={member.avatar} alt="" className="member-avatar"/></div><span className="member-status"/><span className="member-name">{member.username}</span><span className="member-role-label">{member.role}</span></div>)}</div></section>
    <div className="sidebar-actions">
      {canEdit&&<button className="sidebar-button save-workspace-button" onClick={saveWorkspace} type="button">SAVE WORKSPACE</button>}
      {canEdit&&<span className="sidebar-save-state">{saveState}</span>}
      <button className="sidebar-button" onClick={onHistory} type="button">VIEW CODE HISTORY</button>
      {canEdit&&<button className="sidebar-button" onClick={onCheckpoint} type="button">SAVE CHECKPOINT</button>}
      {workspace?.role==='owner'&&<button className="sidebar-button" onClick={onInvite} type="button">MANAGE COLLABORATORS</button>}
      <button className="sidebar-button copy-room-button" onClick={copyRoomId} type="button">COPY WORKSPACE ID</button>
      <button className="sidebar-button leave-room-button" onClick={()=>navigate('/')} type="button">LEAVE WORKSPACE</button>
    </div>
    <div className="sidebar-footer"><span className="footer-pixel">✦</span>CODE TOGETHER ♡</div>
  </aside>
}
export default EditorSidebar
