import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Canvas from './Canvas';
import BackgroundManager from './BackgroundManager';
import Overlay from './Overlay';

const socket = io(process.env.REACT_APP_API_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  const [auth, setAuth] = useState({
    isLoggedIn: false,
    userId: null,
    username: ''
  });
  const [users, setUsers] = useState([]);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [canvasRectangles, setCanvasRectangles] = useState([]);
  const [cursors, setCursors] = useState({});

  useEffect(() => {
    const handleConnect = () => console.log('Socket connected');
    const handleDisconnect = () => console.log('Socket disconnected');
    const handleUpdateUsers = (updatedUsers) => {
      console.log('Users updated:', updatedUsers);
      setUsers(updatedUsers);
    };
    const handleInitializeCanvas = (rectangles) => {
      console.log('Canvas initialized:', rectangles);
      setCanvasRectangles(Array.isArray(rectangles) ? rectangles : []);
    };
    const handleUpdateCanvas = (updatedRectangles) => {
      console.log('Canvas updated:', updatedRectangles);
      setCanvasRectangles(prevRects => {
        const safeUpdatedRects = Array.isArray(updatedRectangles) ? updatedRectangles : [];
        return safeUpdatedRects;
      });
    };
    const handleUpdateCursors = (updatedCursors) => {
      console.log('Cursors updated:', updatedCursors);
      setCursors(updatedCursors);
    };

    socket.on('updateCursors', handleUpdateCursors);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('updateUsers', handleUpdateUsers);
    socket.on('initializeCanvas', handleInitializeCanvas);
    socket.on('updateCanvas', handleUpdateCanvas);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('updateUsers', handleUpdateUsers);
      socket.off('initializeCanvas', handleInitializeCanvas);
      socket.off('updateCanvas', handleUpdateCanvas);
      socket.off('updateCursors', handleUpdateCursors);
    };
  }, []);

  const handleLoginFormChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/login`, loginForm);
      localStorage.setItem('token', response.data.token);
      const newAuth = {
        isLoggedIn: true,
        userId: response.data.userId,
        username: loginForm.username
      };
      setAuth(newAuth);
      socket.emit('userJoined', { id: newAuth.userId, username: newAuth.username });
      setLoginForm({ username: '', password: '' }); // Clear form after successful login
    } catch (error) {
      console.error('Login failed', error);
    }
  }, [loginForm]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    socket.emit('userLeft', auth.userId);
    setAuth({
      isLoggedIn: false,
      userId: null,
      username: ''
    });
  };

  const handleClearCanvas = () => {
    socket.emit('clearCanvas');
    setCanvasRectangles([]); // Ensure local state is cleared as well
  };
  const loginFormJSX = (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        name="username"
        placeholder="Username"
        value={loginForm.username}
        onChange={handleLoginFormChange}
        style={{ marginRight: '10px' }}
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={loginForm.password}
        onChange={handleLoginFormChange}
        style={{ marginRight: '10px' }}
      />
      <button type="submit">Login</button>
    </form>
  );

  if (!auth.isLoggedIn) {
    return (
      <div style={{ backgroundColor: 'black', color: 'white', minHeight: '100vh' }}>
        <h2>Login</h2>
        {loginFormJSX}
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      <BackgroundManager type="gradient" colors={['#000000', '#F5F5F5']} />
      <Canvas 
        userId={auth.userId} 
        rectangles={canvasRectangles}
        setRectangles={setCanvasRectangles}
        cursors={cursors}  // Add this line
        socket={socket}    // Add this line
      />
      <Overlay
        isLoggedIn={auth.isLoggedIn}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
        handleClearCanvas={handleClearCanvas}
        users={users}
      >
        {loginFormJSX}
      </Overlay>
    </div>
  );
}

export default App;