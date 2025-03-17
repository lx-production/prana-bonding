// This module starts the spinning favicon animation by updating the favicon via a canvas.

export function startSpinningFavicon() {
    // Get (or create) the favicon link element
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
  
    // Create a canvas to draw the rotated favicon.
    const canvas = document.createElement("canvas");
    const size = 96; // canvas size – following modern favicon standards (multiple of 48)
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
  
    // Create an image element for your favicon.
    const img = new Image();
    img.crossOrigin = "anonymous"; // Ensures cross-origin images can be used if needed.
    img.src = "/stake/src/assets/icons/prana.svg";
  
    img.onload = function () {
      let angle = 0;
      const step = 5; // degrees to rotate each frame
      const interval = 30; // time in ms between frames
  
      setInterval(() => {
        // Clear the canvas.
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        // Move to center, rotate, then draw the image centered.
        ctx.translate(size / 2, size / 2);
        ctx.rotate(angle * Math.PI / 180);
  
        // Optionally, scale the image to fit the canvas (here 80% of the canvas size)
        const imgSize = size * 0.8;
        ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        ctx.restore();
  
        // Increment the angle, wrapping at 360.
        angle = (angle + step) % 360;
  
        // Update the favicon with the new image.
        favicon.href = canvas.toDataURL("image/png");
      }, interval);
    };
  }