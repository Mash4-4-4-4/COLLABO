import React, { useEffect } from 'react'
import "./Toast.css"
function Toast({message,onClose}) {
useEffect(()=>
{
    if(!message)return;

    const timer=setTimeout(()=>
    {
        onClose();

    },3500);

    return ()=>clearTimeout(timer);
},[message,onClose]);


if(!message)return null;

    return (
    <div className="pixel-toast" role="alert">
      <div className="pixel-toast-header">
        <span className="pixel-toast-icon">!</span>

        <span className="pixel-toast-title">
          ROOM ALERT
        </span>

        <button
          className="pixel-toast-close"
          onClick={onClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>

      <p className="pixel-toast-message">
        {message}
      </p>
    </div>
  );
}

export default Toast