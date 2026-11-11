
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PixelButton from './PixelButton'
import './HomePage.css'
import Toast from "./Toast"
import { useRef } from 'react'

function HomePage() {

  const usernameRef=useRef(null);
const [roomId, setRoomId] = useState('')
  const [username, setUsername] = useState('')
   const [error,setError]=useState("");

  const navigate = useNavigate()
  function joinRoom(event) 
  {
    event.preventDefault()
        const cleanUsername = username.trim()
        const cleanRoomId=roomId.trim();
    if(!cleanRoomId.trim())
    {
      setError("please enter your room id");
      return;
    }
   if(!cleanUsername)
   {
    setError("enter your name too!!");
    usernameRef.current?.focus();
    return;
   }
   setError("");

    navigate(
        `/editor/${encodeURIComponent(cleanRoomId)}?username=${encodeURIComponent(cleanUsername)}`
    )
  }

  function createRoom() {
    const newRoomId = crypto.randomUUID().toUpperCase();
    setRoomId(newRoomId);
    setError("");

    setTimeout(()=>
    {
      usernameRef.current?.focus();
    },0);

  }

  return (
    <main className="codecast-page">

      {/* Background decorations */}
      <div className="codecast-stars" aria-hidden="true">
        <span className="star star-one">✦</span>
        <span className="star star-two">✧</span>
        <span className="star star-three">✦</span>
        <span className="star star-four">·</span>
        <span className="pixel-heart">♥</span>
      </div>

      {/* Main card */}
      <section className="codecast-card">

        {/* Logo */}
        <div className="codecast-brand">
          <span className="brand-icon">⌘</span>
          <span className="brand-divider"></span>
          <span>CODECAST</span>
          <span className="brand-sparkle">✦</span>
        </div>

        {/* Heading */}
        <div className="codecast-heading">
          <h1>Enter the ROOM ID</h1>

          <p className="codecast-subtitle">
            your little corner of the coding universe ✨
          </p>
        </div>

        {/* Form */}
        <form
          className="codecast-form"
          onSubmit={joinRoom}
        >

          <label className="sr-only" htmlFor="room-id">
            Room ID
          </label>

          <input
            id="room-id"
            className="codecast-input"
            type="text"
            placeholder="ROOM ID"
            value={roomId}
            onChange={(e) =>
              setRoomId(e.target.value.toUpperCase())
            }
            autoComplete="off"
            
          />

          <label className="sr-only" htmlFor="username">
            Username
          </label>
          
          <input
          ref={usernameRef}
            id="username"
            className="codecast-input"
            type="text"
            placeholder="USERNAME"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
            autoComplete="nickname"
            maxLength={24}
          />
          <Toast
          message={error}
          onClose={()=>setError("")}
          />

          <PixelButton
            className="join-button"
            type="submit"
            
          >
            JOIN ROOM <span>➜</span>
          </PixelButton>

        </form>

        {/* Create room */}
        <div className="codecast-create">
          <span>Don't have a room ID?</span>

          <PixelButton
            className="new-room-button"
            onClick={createRoom}
          >
            Create New Room <span>♡</span>
          </PixelButton>
        </div>

        {/* Footer */}
        <div className="codecast-footer">
          <span className="status-dot"></span>
          READY WHEN YOU ARE
          <span className="footer-divider">•</span>
          CODE TOGETHER, ANYWHERE
        </div>

        <span className="corner-decoration corner-top-left">
          ✧
        </span>

        <span className="corner-decoration corner-bottom-right">
          ✦
        </span>

      </section>

      <p className="page-caption">
        made for late-night ideas & lovely little bugs <span>♡</span>
      </p>

    </main>
  )
}

export default HomePage
