const fs = require('fs');
const file = 'src/pages/CodingPage.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
  'import React, { useState, useEffect } from "react";',
  'import React, { useState, useEffect, useRef } from "react";'
);

code = code.replace(
  '  const [isFullScreen, setIsFullScreen] = useState(false);',
  '  const [isFullScreen, setIsFullScreen] = useState(false);\n  const isFullScreenRef = useRef(false);'
);

const handleFullScreenChangeStr = `    const handleFullScreenChange = () => {
      const isFull = !!getFullScreenElement();
      setIsFullScreen(isFull);
      if (!isFull) {
        logActivity("fullscreen_exit", 0, "Exited full-screen test mode");
      }
    };`;

const newHandleFullScreenChangeStr = `    const handleFullScreenChange = () => {
      const isFull = !!getFullScreenElement();
      setIsFullScreen(isFull);
      if (!isFull && isFullScreenRef.current) {
        logActivity("fullscreen_exit", 0, "Exited full-screen test mode");
      }
      isFullScreenRef.current = isFull;
    };`;

code = code.replace(handleFullScreenChangeStr, newHandleFullScreenChangeStr);

const requestFullScreenModeStr = `  const requestFullScreenMode = () => {
    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      setIsFullScreen(true);
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
      setIsFullScreen(true);
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      setIsFullScreen(true);
    }
  };`;

const newRequestFullScreenModeStr = `  const requestFullScreenMode = () => {
    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        setIsFullScreen(true);
        isFullScreenRef.current = true;
      }).catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      setIsFullScreen(true);
      isFullScreenRef.current = true;
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
      setIsFullScreen(true);
      isFullScreenRef.current = true;
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      setIsFullScreen(true);
      isFullScreenRef.current = true;
    }
  };`;

code = code.replace(requestFullScreenModeStr, newRequestFullScreenModeStr);

fs.writeFileSync(file, code);
