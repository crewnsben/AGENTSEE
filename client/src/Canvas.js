import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import BackgroundManager from './BackgroundManager';
import PrimitiveInputRectangle from './PrimitiveInputRectangle';
import PrimitiveImageRectangle from './PrimitiveImageRectangle';
import { calculateTextDimensions } from './textUtils';

const Canvas = ({ userId, rectangles = [], setRectangles, cursors, socket }) => {
  const safeRectangles = useMemo(() => Array.isArray(rectangles) ? rectangles : [], [rectangles]);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [editingRect, setEditingRect] = useState(null);
  const [primitiveRectangles, setPrimitiveRectangles] = useState([]);
  const [processedRectangles, setProcessedRectangles] = useState(new Set());

  const handleRectangleResize = useCallback((id, newWidth, newHeight) => {
    setRectangles(prevRects => prevRects.map(rect => 
      rect.id === id ? { ...rect, width: newWidth, height: newHeight } : rect
    ));
  }, [setRectangles]);

  const handleResize = useCallback(() => {
    setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  const getNextPosition = useCallback(() => {
    const gridSize = 50;
    const rectangleWidth = 300;
    const rectangleHeight = 200;
    
    if (primitiveRectangles.length === 0) {
      // First rectangle in the center
      const centerX = window.innerWidth / 2 - rectangleWidth / 2;
      const centerY = window.innerHeight / 2 - rectangleHeight / 2;
      return { x: centerX, y: centerY };
    } else {
      // Subsequent rectangles
      const lastRect = primitiveRectangles[primitiveRectangles.length - 1];
      let newX = lastRect.x + rectangleWidth * 2 + gridSize;
      let newY = lastRect.y;
  
      // If we reach the edge of the screen, move to the next row
      if (newX + rectangleWidth > window.innerWidth) {
        newX = gridSize;
        newY = lastRect.y + rectangleHeight + gridSize;
      }
  
      return { x: newX, y: newY };
    }
  }, [primitiveRectangles]);

  const handleRectangleMove = useCallback((id, newX, newY) => {
    setPrimitiveRectangles(prevRects =>
      prevRects.map(rect =>
        rect.id === id ? { ...rect, x: newX, y: newY } : rect
      )
    );
  }, []);


  const handleNewPrimitiveRectangle = useCallback(({ content }) => {
    const rectangleId = `primitive_${Date.now()}`;
    if (!processedRectangles.has(rectangleId)) {
      const { width, height } = calculateTextDimensions(content, 14, 300);
      const { x, y } = getNextPosition();
      const newRect = {
        id: rectangleId,
        x,
        y,
        width: Math.max(300, width + 20),
        height: Math.max(200, height + 60),
        text: content,
        type: 'primitiveText',
        indexNumber: primitiveRectangles.length + 1
      };
      setPrimitiveRectangles(prevRects => [...prevRects, newRect]);
      setProcessedRectangles(prev => new Set(prev).add(rectangleId));
    }
  }, [getNextPosition, primitiveRectangles.length, processedRectangles]);

  useEffect(() => {
    socket.on("newPrimitiveRectangle", handleNewPrimitiveRectangle);

    return () => {
      socket.off("newPrimitiveRectangle", handleNewPrimitiveRectangle);
    };
  }, [socket, handleNewPrimitiveRectangle]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawTriangle = useCallback((context, x, y, color) => {
    const height = 20;
    const width = (height * 34) / 50;
    
    context.beginPath();
    context.moveTo(x, y - height/2);
    context.lineTo(x - width/2, y + height/2);
    context.lineTo(x + width/2, y + height/2);
    context.closePath();
    
    context.fillStyle = color;
    context.fill();
    
    context.strokeStyle = 'black';
    context.lineWidth = 1;
    context.stroke();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    clearCanvas();

    if (cursors && typeof cursors === 'object') {
      Object.values(cursors).forEach(cursor => {
        drawTriangle(
          context, 
          cursor.x * zoom + panOffset.x, 
          cursor.y * zoom + panOffset.y, 
          cursor.color
        );
      });
    }
  }, [clearCanvas, zoom, panOffset, cursors, drawTriangle]);
  
  const handleNewComfyUIResponse = useCallback(({ filename, content, type, rectangle }) => {
    console.log('Received new ComfyUI response:', filename, type, content);
    setRectangles(prevRects => {
      const parentRect = [...prevRects].reverse().find(rect => !rect.isResponse);
      if (!parentRect) {
        console.error('Parent rectangle not found');
        return prevRects;
      }
  
      let newRect = { ...rectangle, parentIndex: parentRect.index };
  
      const typeHandlers = {
        image: () => ({
          ...newRect,
          id: `image_${Date.now()}`, // Ensure unique ID
          type: 'primitiveImage',
          imageSrc: `${process.env.REACT_APP_API_URL}/images/${filename}`,
          width: 350,
          height: 350,
          images: [filename],
          texts: [''],
          x: parentRect.x + parentRect.width + 50, // Position to the right of parent
          y: parentRect.y
        }),
        text: () => ({
          ...newRect,
          x: parentRect.x,
          y: parentRect.y + parentRect.height + 50,
          width: Math.max(300, newRect.width || 0),
          height: Math.max(200, newRect.height || 0),
          text: content,
          type: 'primitiveText'
        }),
        search: () => ({
          ...newRect,
          x: parentRect.x + parentRect.width + 50,
          y: parentRect.y,
          width: Math.max(300, newRect.width || 0),
          height: Math.max(200, newRect.height || 0),
          text: content,
          type: 'primitiveSearch'
        }),
        // Add more type handlers here as needed
      };
  
      const typeHandler = typeHandlers[type] || (() => newRect);
      newRect = typeHandler();
  
      newRect.isResponse = true;
      newRect.index = prevRects.length;
  
      console.log('Adding new rectangle:', newRect);
      return [...prevRects, newRect];
    });
  }, [setRectangles]);
  
  useEffect(() => {
    const handleNewRectangle = (newRect) => {
      console.log('New rectangle received:', newRect);
      setRectangles(prevRects => [...prevRects, newRect]);
      if (editingRect && !editingRect.index) {
        setEditingRect(newRect);
      }
    };
  
    const handleUpdateRectangleText = ({ index, text, height }) => {
      console.log('Updating rectangle text:', index, text, height);
      setRectangles(prevRects => 
        prevRects.map((rect, i) => i === index ? { ...rect, text, height: height || rect.height } : rect)
      );
    }; 
   
  
    socket.on("newRectangle", handleNewRectangle);
    socket.on("updateRectangleText", handleUpdateRectangleText);
    socket.on('newComfyUIResponse', handleNewComfyUIResponse);
    socket.on("newPrimitiveRectangle", handleNewPrimitiveRectangle);
  
    return () => {
      socket.off("newRectangle", handleNewRectangle);
      socket.off("updateRectangleText", handleUpdateRectangleText);
      socket.off('newComfyUIResponse', handleNewComfyUIResponse);
      socket.off("newPrimitiveRectangle", handleNewPrimitiveRectangle);
    };
  }, [socket, setRectangles, editingRect, handleNewComfyUIResponse, handleNewPrimitiveRectangle]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const handleMouseDown = (e) => {
    if (e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setStartPoint({ x: e.clientX, y: e.clientY });
    } else {
      const clickedRectIndex = getClickedRectangleIndex(e);
      if (clickedRectIndex !== -1) {
        setEditingRect(safeRectangles[clickedRectIndex]);
      }
    }
  };

    const handleMouseMove = (e) => {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - panOffset.x) / zoom;
      const y = (e.clientY - canvasRect.top - panOffset.y) / zoom;
      socket.emit("updateCursor", { x, y });
  
      if (isPanning) {
        const dx = e.clientX - startPoint.x;
        const dy = e.clientY - startPoint.y;
        setPanOffset(prevOffset => ({
          x: prevOffset.x + dx,
          y: prevOffset.y + dy
        }));
        setStartPoint({ x: e.clientX, y: e.clientY });
      }
      redrawCanvas();
    };
  
    const handleMouseUp = (e) => {
      if (isPanning) {
        setIsPanning(false);
      }
      redrawCanvas();
    };

  const handleWheel = (e) => {
    e.preventDefault();
    const scaleAmount = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = zoom * scaleAmount;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanOffset = {
      x: mouseX - (mouseX - panOffset.x) * scaleAmount,
      y: mouseY - (mouseY - panOffset.y) * scaleAmount
    };

    setZoom(newZoom);
    setPanOffset(newPanOffset);
    redrawCanvas();
  };

  const getClickedRectangleIndex = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    const x = (offsetX - panOffset.x) / zoom;
    const y = (offsetY - panOffset.y) / zoom;
    return safeRectangles.findIndex(rect =>
      x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y && y <= rect.y + rect.height
    );
  };
  
  const handlePrimitiveRectangleCreation = useCallback((content) => {
    const gridSize = 10; // This should match the grid size in BackgroundManager
    const newRect = {
      x: Math.floor(safeRectangles.length / 5) * gridSize, // Simple grid positioning
      y: (safeRectangles.length % 5) * gridSize,
      width: 300, // Default width
      height: 200, // Default height
      text: content,
      isResponse: false,
      type: 'primitive',
      index: safeRectangles.length
    };
    console.log('Creating new primitive rectangle:', newRect);
    socket.emit("newRectangle", newRect);
    setRectangles(prevRects => [...prevRects, newRect]);
  }, [safeRectangles, setRectangles, socket]);

  useEffect(() => {
    const handleNewPrimitiveRectangle = ({ content }) => {
      handlePrimitiveRectangleCreation(content);
    };

    socket.on("newPrimitiveRectangle", handleNewPrimitiveRectangle);

    return () => {
      socket.off("newPrimitiveRectangle", handleNewPrimitiveRectangle);
    };
  }, [socket, handlePrimitiveRectangleCreation]);

  const renderRectangles = useCallback(() => {
    const allRectangles = [...primitiveRectangles, ...rectangles];
    return allRectangles.map(rect => {
      const commonProps = {
        key: rect.id,
        rect: {
          ...rect,
          x: rect.x * zoom + panOffset.x,
          y: rect.y * zoom + panOffset.y,
          width: rect.width * zoom,
          height: rect.height * zoom,
        },
        onMove: handleRectangleMove,
        onResize: handleRectangleResize,
        zoom,
      };
  
      switch (rect.type) {
        case 'primitiveText':
        case 'primitive':
          return <PrimitiveInputRectangle {...commonProps} />;
        case 'primitiveImage':
          return <PrimitiveImageRectangle {...commonProps} images={rect.images} texts={rect.texts} />;
        default:
          console.warn(`Unknown rectangle type: ${rect.type}`);
          return null;
      }
    });
  }, [primitiveRectangles, rectangles, zoom, panOffset, handleRectangleMove, handleRectangleResize]);
// Add a comment explaining why we're keeping this function

  // This function is currently unused but will be needed in the future
  // when we implement additional rectangle types. It's kept here to maintain
  // the structure for future development.

  useEffect(() => {
    socket.on("newPrimitiveRectangle", handleNewPrimitiveRectangle);
    return () => {
      socket.off("newPrimitiveRectangle", handleNewPrimitiveRectangle);
    };
  }, [socket, handleNewPrimitiveRectangle]);

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      <BackgroundManager colors={['#f5f5f5','#B9B9B9']} />
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          cursor: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
      {renderRectangles()}
    </div>
  );
};

export default Canvas;