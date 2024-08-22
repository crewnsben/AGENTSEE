import React, { useState, useEffect } from 'react';

const MicrophoneIndicator = () => {
  const [isMicrophoneInUse, setIsMicrophoneInUse] = useState(false);

  useEffect(() => {
    let intervalId;

    const checkMicrophoneUse = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // If we get here, the microphone is available
        stream.getTracks().forEach(track => track.stop());
        setIsMicrophoneInUse(false);
      } catch (err) {
        // If we get an error, assume the microphone is in use
        setIsMicrophoneInUse(true);
      }
    };

    // Check immediately and then every 3 seconds
    checkMicrophoneUse();
    intervalId = setInterval(checkMicrophoneUse, 3000);

    const styles = `
      @keyframes fadeInOut {
        0%, 100% { opacity: 0; }
        50% { opacity: 1; }
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    return () => {
      clearInterval(intervalId);
      document.head.removeChild(styleSheet);
    };
  }, []);

  if (!isMicrophoneInUse) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#8B0000',
        animation: 'fadeInOut 3s ease-in-out infinite'
      }}
    />
  );
};

export default MicrophoneIndicator;