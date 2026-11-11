
import './PixelButton.css'

function PixelButton({
  children,
  className = '',
  type = 'button',
  onClick,
  disabled = false
}) {
  return (
    <button
      type={type}
      className={`pixel-button ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export default PixelButton
