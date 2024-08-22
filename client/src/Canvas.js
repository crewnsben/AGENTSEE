import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import BackgroundManager from './BackgroundManager';
import PrimitiveInputRectangle from './PrimitiveInputRectangle';
import PrimitiveImageRectangle, {getPrimitiveImageConfig} from './PrimitiveImageRectangle';
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
  const [showOverlay, setShowOverlay] = useState(false);

  const [linkedPairs, setLinkedPairs] = useState([]);
  const [recentRectangles, setRecentRectangles] = useState([]);
  const [draggedRect, setDraggedRect] = useState(null);

  const [targetZoom, setTargetZoom] = useState(1);
  const [targetPanOffset, setTargetPanOffset] = useState({ x: 0, y: 0 });
  const [animationPhase, setAnimationPhase] = useState(null); // 'zoomIn', 'zoomOut', or null
  const animationRef = useRef(null);

  const handleRectangleResize = useCallback((id, newWidth, newHeight) => {
    setRectangles(prevRects => prevRects.map(rect =>
      rect.id === id ? { ...rect, width: newWidth, height: newHeight } : rect
    ));
  }, [setRectangles]);

  const handleResize = useCallback(() => {
    setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  const getNextPosition = useCallback(() => {
    const now = Date.now();
    const recentRect = recentRectangles[recentRectangles.length - 1];
    

    if (recentRect && now - recentRect.createdAt <= 100000) {
      // If there's a recent rectangle within 100 seconds, position near it
      const valueX =(Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random()*(300)) + 400);
      const offsetX = valueX; // Random offset between -50 and 50
      const offsetY =(Math.random() < 0.5 ? -1 : 1) * (Math.random() * 200);

      return {
        x: recentRect.x + offsetX,
        y: recentRect.y + offsetY
      };
    } else {
      // Original positioning logic
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
        let newX = lastRect.x + rectangleWidth * 5 + gridSize;
        let newY = lastRect.y;

        // If we reach the edge of the screen, move to the next row
        if (newX + rectangleWidth > window.innerWidth) {
          newX = gridSize;
          newY = lastRect.y + rectangleHeight + gridSize;
        }

        return { x: newX, y: newY };
      }
    }
  }, [primitiveRectangles, recentRectangles]);


  const checkAndLinkRectangles = useCallback((newRect) => {
    const now = Date.now();
    setRecentRectangles(prevRecent => {
      const updated = [...prevRecent, newRect];
      const filtered = updated.filter(rect => now - rect.createdAt <= 100000); // 100 seconds

      if (filtered.length >= 2) {
        const [rect1, rect2] = filtered.slice(-2);
        setLinkedPairs(prevPairs => [...prevPairs, { rect1: rect1.id, rect2: rect2.id }]);
      }

      return filtered;
    });
  }, []);
  
  const startZoomAnimation = useCallback((rect) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate zoom to fit the rectangle
    const zoomX = canvasWidth / (rect.width * 1.5);
    const zoomY = canvasHeight / (rect.height * 1.5);
    const newZoom = Math.min(zoomX, zoomY);

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    setTargetZoom(newZoom);
    setTargetPanOffset({
      x: canvasWidth / 2 - centerX * newZoom,
      y: canvasHeight / 2 - centerY * newZoom
    });
    
    //__________________________________________________________________________________________________________Here
    animationRef.current = {
      startTime: performance.now(),
      startZoom: zoom,
      startPanOffset: { ...panOffset }
    };
    //________________________________________________________________________________________________To here
    setAnimationPhase('zoomIn');
  }, [zoom,panOffset]);

  const zoomToAllRectangles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || primitiveRectangles.length === 0) return;

    const minX = Math.min(...primitiveRectangles.map(r => r.x));
    const minY = Math.min(...primitiveRectangles.map(r => r.y));
    const maxX = Math.max(...primitiveRectangles.map(r => r.x + r.width));
    const maxY = Math.max(...primitiveRectangles.map(r => r.y + r.height));

    const width = maxX - minX;
    const height = maxY - minY;

    const zoomX = canvas.width / (width * 1.1);
    const zoomY = canvas.height / (height * 1.1);
    const newZoom = Math.min(zoomX, zoomY, 1); // Limit zoom out to 1

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTargetZoom(newZoom);
    setTargetPanOffset({
      x: canvas.width / 2 - centerX * newZoom,
      y: canvas.height / 2 - centerY * newZoom
    });
    setAnimationPhase('zoomOut');
  }, [primitiveRectangles]);

  const handleNewPrimitiveRectangle = useCallback(({ content, filename }) => {
    console.log('handleNewPrimitiveRectangle called with:', { content, filename });
    const isResponse = filename ? filename.startsWith("res") : false;
    console.log('Is response:', isResponse);
    const rectangleId = isResponse ? filename : `primitive_${Date.now()}`;
    console.log('Assigned rectangleId:', rectangleId);

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
        indexNumber: primitiveRectangles.length + 1,
        createdAt: Date.now(),
        isResponse: isResponse,
      };

      setShowOverlay(true);
      setTimeout(() => setShowOverlay(false), 10000);   //____________________________________________________________________Time for the Rec Button to go Away.

      
      
      console.log('Creating new rectangle:', newRect);
      setPrimitiveRectangles(prevRects => {  //_______________________________________________Here
        const updatedRects = [...prevRects, newRect];
        // Trigger zoom animation after state update
        setTimeout(() => startZoomAnimation(newRect), 0);
        return updatedRects;
      });//_________________________________________________________________________________TOHERE
      setProcessedRectangles(prev => new Set(prev).add(rectangleId));
      checkAndLinkRectangles(newRect);

      // zoomToRectangle(newRect);

       // Trigger zoom out after a delay
       startZoomAnimation(newRect);
    }else{
      console.log('Rectangle already processed:', rectangleId);
    }
  }, [getNextPosition, primitiveRectangles.length, processedRectangles, checkAndLinkRectangles, zoomToAllRectangles,startZoomAnimation]);
  
  const preventBrowserZoom = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, []);


  // useEffect(() => {
  //   socket.on("newPrimitiveRectangle", handleNewPrimitiveRectangle);

  //   return () => {
  //     socket.off("newPrimitiveRectangle", handleNewPrimitiveRectangle);
  //   };
  // }, [socket, handleNewPrimitiveRectangle]);

  const drawLines = useCallback((context) => {
    linkedPairs.forEach(pair => {
      const rect1 = primitiveRectangles.find(r => r.id === pair.rect1);
      const rect2 = primitiveRectangles.find(r => r.id === pair.rect2);

      if (rect1 && rect2) {
        const startX = rect1.x * zoom + panOffset.x + rect1.width * zoom / 2;
        const startY = rect1.y * zoom + panOffset.y + rect1.height * zoom / 2;
        const endX = rect2.x * zoom + panOffset.x + rect2.width * zoom / 2;
        const endY = rect2.y * zoom + panOffset.y + rect2.height * zoom / 2;

        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.strokeStyle = 'rgba(10, 10, 10, 0.8)';
        context.lineWidth = 1;
        context.stroke();
      }
    });
  }, [linkedPairs, primitiveRectangles, zoom, panOffset]);

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
    context.moveTo(x, y - height / 2);
    context.lineTo(x - width / 2, y + height / 2);
    context.lineTo(x + width / 2, y + height / 2);
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

    drawLines(context);
  }, [clearCanvas, zoom, panOffset, cursors, drawTriangle, drawLines]);


  const handleNewComfyUIResponse = useCallback(({ filename, content, type, rectangle }) => {
    console.log('Received new ComfyUI response:', filename, type, content);
    setRectangles(prevRects => {
      const lastRect = prevRects[prevRects.length - 1];
      let newRect = { ...rectangle };
  
      const typeHandlers = {
        image: () => {
          const { imageLayout, canvasWidth, canvasHeight } = getPrimitiveImageConfig();
          return {
            ...newRect,
            id: `image_${Date.now()}`,
            type: 'primitiveImage',
            imageSrc: `${process.env.REACT_APP_API_URL}/images/${filename}`,
            width: canvasWidth,
            height: canvasHeight,
            images: Array(imageLayout.length).fill(filename),
            texts: Array(imageLayout.length).fill(''),
            imageLayout
          };
        },
        text: () => ({
          ...newRect,
          width: Math.max(300, newRect.width || 0),
          height: Math.max(200, newRect.height || 0),
          text: content,
          type: 'primitiveText'
        }),
        search: () => ({
          ...newRect,
          width: Math.max(300, newRect.width || 0),
          height: Math.max(200, newRect.height || 0),
          text: content,
          type: 'primitiveSearch'
        }),
      };
  
      const typeHandler = typeHandlers[type] || (() => newRect);
      newRect = typeHandler();
  
      // Position the new rectangle
      if (lastRect) {
        const availableWidth = window.innerWidth / zoom;
        if (lastRect.x + lastRect.width + 50 + newRect.width <= availableWidth) {
          newRect.x = lastRect.x + lastRect.width + 50;
          newRect.y = lastRect.y - panOffset.y
        } else {
          newRect.x = (50 - panOffset.x) / zoom;
          newRect.y = (lastRect.y + lastRect.height + 50 - panOffset.y) / zoom;
        }
      } else {
        newRect.x = (50 - panOffset.x) / zoom;
        newRect.y = (50 - panOffset.y) / zoom;
      }
  
      newRect.isResponse = true;
      newRect.index = prevRects.length;
  
      console.log('Adding new rectangle:', newRect);

      setTimeout(() => startZoomAnimation(newRect), 0);//__________________________________

      return [...prevRects, newRect];
    });
  }, [setRectangles,zoom,panOffset,startZoomAnimation]);

  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

  const getClickedRectangleIndex = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    const x = (offsetX - panOffset.x) / zoom;
    const y = (offsetY - panOffset.y) / zoom;
    return safeRectangles.findIndex(rect =>
      x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y && y <= rect.y + rect.height
    );
  };

  const handleRectangleMove = useCallback((id, newX, newY) => {
    const updateRectangles = (prevRects) =>
      prevRects.map(rect =>
        rect.id === id ? {
          ...rect,
          x: (newX - panOffset.x) / zoom,
          y: (newY - panOffset.y) / zoom
        } : rect
      );
  
    setPrimitiveRectangles(updateRectangles);
    setRectangles(updateRectangles);
  }, [zoom, panOffset]);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setStartPoint({ x: e.clientX, y: e.clientY });
    } else {
      const clickedRectIndex = getClickedRectangleIndex(e);
      if (clickedRectIndex !== -1) {
        const rect = primitiveRectangles[clickedRectIndex];
        setDraggedRect({
          id: rect.id,
          startX: e.clientX,
          startY: e.clientY,
          originalX: rect.x,
          originalY: rect.y
        });
      } else {
        socket.emit("createPrimitiveRectangle", { content: "New Rectangle" });
      }
    }
  }, [primitiveRectangles, getClickedRectangleIndex, socket]);

  const handleMouseMove = useCallback((e) => {
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
    } else if (draggedRect) {
      const dx = (e.clientX - draggedRect.startX) / zoom;
      const dy = (e.clientY - draggedRect.startY) / zoom;
      handleRectangleMove(
        draggedRect.id,
        draggedRect.originalX * zoom + dx * zoom + panOffset.x,
        draggedRect.originalY * zoom + dy * zoom + panOffset.y
      );
    }
    redrawCanvas();
  }, [isPanning, startPoint, draggedRect, zoom, panOffset, handleRectangleMove, socket, redrawCanvas]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedRect(null);
    redrawCanvas();
  }, [redrawCanvas]);

  const handleWheel = useCallback((e) => {
    if (animationPhase === null) {
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
    }
  }, [zoom, panOffset, animationPhase, redrawCanvas]);

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


  //OldHandle_Wheel_________________________________________________________
  // const handleWheel = useCallback((e) => {
  //   if(!isZooming){
  //     const scaleAmount = e.deltaY > 0 ? 0.9 : 1.1;
  //     const newZoom = zoom * scaleAmount;

  //     const rect = canvasRef.current.getBoundingClientRect();
  //     const mouseX = e.clientX - rect.left;
  //     const mouseY = e.clientY - rect.top;

  //     const newPanOffset = {
  //       x: mouseX - (mouseX - panOffset.x) * scaleAmount,
  //       y: mouseY - (mouseY - panOffset.y) * scaleAmount
  //     };

  //     setZoom(newZoom);
  //     setPanOffset(newPanOffset);
  //     redrawCanvas();
  //   }
  // }, [zoom, panOffset, redrawCanvas]);


  useEffect(() => {
    window.addEventListener('wheel', preventBrowserZoom, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventBrowserZoom);
    };
  }, [preventBrowserZoom]);

  useEffect(() => {
    const preventZoom = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousewheel', preventZoom, { passive: false });

    return () => {
      window.removeEventListener('mousewheel', preventZoom);
    };
  }, []);

  useEffect(() => {
    const handleFileWritten = () => {
      setShowOverlay(true);
      setTimeout(() => {
        setShowOverlay(false);
      }, 5000); // 5 seconds
    };
  
    socket.on("fileWritten", handleFileWritten);
  
    return () => {
      socket.off("fileWritten", handleFileWritten);
    };
  }, [socket]);

  useEffect(() => {
    const animate = (time) => {
      if (animationPhase === 'zoomIn' || animationPhase === 'zoomOut') {
        if (!animationRef.current) {
          // Initialize animation data if it doesn't exist
          animationRef.current = {
            startTime: time,
            startZoom: zoom,
            startPanOffset: { ...panOffset }
          };
        }
        
        const progress = Math.min((time - animationRef.current.startTime) / 1000, 1); // 1 second duration
        const easeProgress = easeInOutCubic(progress);

        const newZoom = animationRef.current.startZoom + (targetZoom - animationRef.current.startZoom) * easeProgress;
        const newPanOffset = {
          x: animationRef.current.startPanOffset.x + (targetPanOffset.x - animationRef.current.startPanOffset.x) * easeProgress,
          y: animationRef.current.startPanOffset.y + (targetPanOffset.y - animationRef.current.startPanOffset.y) * easeProgress
        };

        setZoom(newZoom);
        setPanOffset(newPanOffset);

        if (progress < 1) {
          animationRef.current.frameId = requestAnimationFrame(animate);
        } else {
          // Animation complete
          if (animationPhase === 'zoomIn') {
            setAnimationPhase('pause');
            setTimeout(() => setAnimationPhase('zoomOut'), 1000); // 1 second pause
          } else {
            setAnimationPhase(null);
          }
        }
      } else if (animationPhase === 'pause') {
        // Do nothing during pause
      } else if (animationPhase === null) {
        // Animation sequence complete, clean up
        animationRef.current = null;
      }

      redrawCanvas();
    };

    if (animationPhase === 'zoomIn' || animationPhase === 'zoomOut') {
      if (!animationRef.current) {
        animationRef.current = {
          startTime: performance.now(),
          startZoom: zoom,
          startPanOffset: { ...panOffset }
        };
      }
      animationRef.current.frameId = requestAnimationFrame(animate);
    } else if (animationPhase === 'pause') {
      // Start zoom out after pause
      setTimeout(() => {
        zoomToAllRectangles();
        animationRef.current = null; // Reset for next animation
      }, 1000);
    }

    return () => {
      if (animationRef.current && animationRef.current.frameId) {
        cancelAnimationFrame(animationRef.current.frameId);
      }
    };
  }, [animationPhase, zoom, panOffset, targetZoom, targetPanOffset, redrawCanvas, zoomToAllRectangles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: true });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  // const handlePrimitiveRectangleCreation = useCallback((content) => {
  //   const gridSize = 10; // This should match the grid size in BackgroundManager
  //   const newRect = {
  //     x: Math.floor(safeRectangles.length / 5) * gridSize, // Simple grid positioning
  //     y: (safeRectangles.length % 5) * gridSize,
  //     width: 300, // Default width
  //     height: 200, // Default height
  //     text: content,
  //     isResponse: false,
  //     type: 'primitive',
  //     index: safeRectangles.length
  //   };
  //   console.log('Creating new primitive rectangle:', newRect);
  //   socket.emit("newRectangle", newRect);
  //   setRectangles(prevRects => [...prevRects, newRect]);
  // }, [safeRectangles, setRectangles, socket]);

  const renderRectangles = useCallback(() => {
    const allRectangles = [...primitiveRectangles, ...rectangles];
    return allRectangles.map(rect => {
      const isLinked = linkedPairs.some(pair => pair.rect1 === rect.id || pair.rect2 === rect.id);
      const isResponse = rect.id.startsWith('res');
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
        isLinked,
        panOffset,
        isResponse,
      };

      console.log('Rendering rectangle:', rect.type, rect.id);

      switch (rect.type) {
        case 'primitiveText':
        case 'primitive':
          return <PrimitiveInputRectangle 
          {...commonProps} />;
        case 'primitiveImage':
          return <PrimitiveImageRectangle 
          {...commonProps} 
          images={rect.images} 
          texts={rect.texts} 
          imageSrc={rect.imageSrc}
          // zoom={zoom}
          // panX={panOffset.x}
          // panY={panOffset.y}
          />;    // Check THis___________________________________
        default:
          console.warn(`Unknown rectangle type: ${rect.type}`);
          return null;
      }
    });
  }, [primitiveRectangles, rectangles, zoom, panOffset, handleRectangleMove, handleRectangleResize, linkedPairs]);

  // useEffect(() => {
  //   socket.on("newPrimitiveRectangle", handleNewPrimitiveRectangle);
  //   return () => {
  //     socket.off("newPrimitiveRectangle", handleNewPrimitiveRectangle);
  //   };
  // }, [socket, handleNewPrimitiveRectangle]);


  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'visible', position: 'relative' }}>
      <BackgroundManager colors={['#f5f5f5', '#B9B9B9']} />
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
      <style>
        {`
          @keyframes fadeInOut {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
        `}
      </style>
      {showOverlay && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#8B0000',
            animation: 'fadeInOut 2s ease-in-out infinite'
          }}
        />
      )}
    </div>
  );
};

export default Canvas;