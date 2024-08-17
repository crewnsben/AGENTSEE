import React from 'react';

const Overlay = ({ isLoggedIn, handleLogout, handleClearCanvas }) => {
  const buttonStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    margin: '0 5px',
    cursor: 'pointer'
  };
// RECORDER CIRCLE _________________________________________________________________________________________
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      pointerEvents: 'auto'
    }}>
      {isLoggedIn && (
        <>
          <button onClick={handleLogout} style={buttonStyle}>Logout</button>
          <button onClick={handleClearCanvas} style={buttonStyle}>Clear Canvas</button>
        </>
      )}
    </div>
  );
};

export default Overlay;