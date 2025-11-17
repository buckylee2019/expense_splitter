import React, { useState, useRef, useEffect } from 'react';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, aspectRatio = 16 / 9 }) => {
  const canvasRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // Initialize crop to center
      const imgAspect = img.width / img.height;
      let width, height, x, y;
      
      if (imgAspect > aspectRatio) {
        height = img.height;
        width = height * aspectRatio;
        x = (img.width - width) / 2;
        y = 0;
      } else {
        width = img.width;
        height = width / aspectRatio;
        x = 0;
        y = (img.height - height) / 2;
      }
      
      setCrop({ x, y, width, height });
    };
    img.src = imageSrc;
  }, [imageSrc, aspectRatio]);

  useEffect(() => {
    if (image && canvasRef.current) {
      drawCanvas();
    }
  }, [image, crop]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Use original image dimensions (or scale down if too large for screen)
    const maxWidth = window.innerWidth * 0.8;
    const maxHeight = window.innerHeight * 0.7;
    
    let displayWidth = image.width;
    let displayHeight = image.height;
    
    // Scale down if image is larger than screen
    if (displayWidth > maxWidth || displayHeight > maxHeight) {
      const scale = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
      displayWidth = displayWidth * scale;
      displayHeight = displayHeight * scale;
    }
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    const scaleX = displayWidth / image.width;
    const scaleY = displayHeight / image.height;
    
    // Draw image
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);
    
    // Draw overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Clear crop area
    ctx.clearRect(
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY
    );
    ctx.drawImage(
      image,
      crop.x, crop.y, crop.width, crop.height,
      crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY
    );
    
    // Draw crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY
    );
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = image.width / canvas.width;
    const scaleY = image.height / canvas.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Check if click is inside crop area
    if (x >= crop.x && x <= crop.x + crop.width &&
        y >= crop.y && y <= crop.y + crop.height) {
      setIsDragging(true);
      setDragStart({ x: x - crop.x, y: y - crop.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = image.width / canvas.width;
    const scaleY = image.height / canvas.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    let newX = x - dragStart.x;
    let newY = y - dragStart.y;
    
    // Constrain to image bounds
    newX = Math.max(0, Math.min(newX, image.width - crop.width));
    newY = Math.max(0, Math.min(newY, image.height - crop.height));
    
    setCrop({ ...crop, x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
      image,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, crop.width, crop.height
    );
    
    canvas.toBlob((blob) => {
      onCropComplete(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-modal">
        <h3>調整照片</h3>
        <p>拖動來調整裁切區域</p>
        
        <canvas
          ref={canvasRef}
          className="crop-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        
        <div className="cropper-actions">
          <button onClick={onCancel} className="button secondary">
            取消
          </button>
          <button onClick={handleCrop} className="button primary">
            確認裁切
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
