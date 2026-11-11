
import { useRef } from 'react'

function playSoftClick(audioContextRef) {

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext

  if (!AudioContextClass) return

  // Reuse one audio context
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextClass()
  }

  const context = audioContextRef.current

  // Resume audio if browser suspended it
  if (context.state === 'suspended') {
    context.resume().catch(() => {})
  }

  const now = context.currentTime

  // Create sound oscillator
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  // Sound frequency
  oscillator.type = 'sine'

  oscillator.frequency.setValueAtTime(660, now)

  oscillator.frequency.exponentialRampToValueAtTime(
    440,
    now + 0.045
  )

  // Sound volume
  gain.gain.setValueAtTime(0.0001, now)

  gain.gain.exponentialRampToValueAtTime(
    0.055,
    now + 0.006
  )

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.065
  )

  // Connect sound nodes
  oscillator.connect(gain)
  gain.connect(context.destination)

  // Play sound
  oscillator.start(now)
  oscillator.stop(now + 0.07)
}

function ClickSoundProvider({ children }) {

  const audioContextRef = useRef(null)

  function handleClickCapture(event) {

    const clickedButton =
      event.target.closest?.('button, [role="button"]')

    if (
      !clickedButton ||
      clickedButton.disabled ||
      clickedButton.getAttribute('aria-disabled') === 'true'
    ) {
      return
    }

    playSoftClick(audioContextRef)
  }

  return (
    <div
      className="app-click-sound"
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  )
}

export default ClickSoundProvider
