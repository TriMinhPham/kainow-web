import React, { useEffect, useRef, useState } from 'react';

const FluidCursor = () => {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Config parameters with defaults - Enhanced for better visibility
  const [config, setConfig] = useState({
    fluidDensity: 150, // Amount of dye added on mouse move (50-200)
    fluidViscosity: 0.0002, // Viscosity of the fluid (0.0001-0.01)
    fluidDiffusion: 0.0003, // How fast the fluid spreads (0.0001-0.01)
    colorIntensity: 2.2, // Multiplier for color brightness (0.5-3)
    decayRate: 0.992, // How slowly the fluid fades (0.95-0.999)
    showControls: false // Toggle for showing control panel
  });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const cursor = cursorRef.current;
    
    if (!canvas || !cursor) return;
    
    // Set up canvas
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    
    // Create fluid simulation using Navier-Stokes equations
    const fluidSimulation = createFluidSimulation(canvas.width, canvas.height);
    
    // Mouse state
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      lastX: window.innerWidth / 2,
      lastY: window.innerHeight / 2,
      down: false
    };
    
    // Animation loop
    const animate = () => {
      if (!ctx) return;
      
      // Update mouse velocities in fluid simulation
      const mouseVelX = (mouse.x - mouse.lastX) * 10;
      const mouseVelY = (mouse.y - mouse.lastY) * 10;
      
      // Always add some fluid, even with minimal movement
      const cx = Math.floor(mouse.x / fluidSimulation.cellSize);
      const cy = Math.floor(mouse.y / fluidSimulation.cellSize);
      
      // Add velocity based on mouse movement
      fluidSimulation.addVelocity(cx, cy, mouseVelX, mouseVelY);
      
      // Add dye even with minimal movement
      const baseDensity = Math.abs(mouseVelX) > 0.1 || Math.abs(mouseVelY) > 0.1 ? 
                         config.fluidDensity : 
                         config.fluidDensity * 0.4; // Add less fluid when not moving much
      
      // Add dye at cursor position
      fluidSimulation.addDensity(cx, cy, baseDensity);
      
      // Add dye to neighboring cells for a wider effect
      const spread = 2; // Increase spread radius
      for (let i = -spread; i <= spread; i++) {
        for (let j = -spread; j <= spread; j++) {
          if (i === 0 && j === 0) continue; // Skip center (already added)
          
          // Calculate distance-based falloff
          const dist = Math.sqrt(i*i + j*j);
          const falloff = 1 - (dist / (spread + 1));
          
          if (falloff > 0) {
            fluidSimulation.addDensity(
              cx + i, 
              cy + j, 
              baseDensity * falloff * 0.6
            );
          }
        }
      }
      
      // Step fluid simulation
      fluidSimulation.step();
      
      // Draw fluid simulation
      fluidSimulation.draw(ctx);
      
      // Save mouse position
      mouse.lastX = mouse.x;
      mouse.lastY = mouse.y;
      
      requestAnimationFrame(animate);
    };
    
    // Mouse move handler
    const handleMouseMove = (e) => {
      // Update mouse position
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      
      // Update cursor dot position
      setPosition({ x: e.clientX, y: e.clientY });
    };
    
    // Mouse down handler
    const handleMouseDown = () => {
      mouse.down = true;
    };
    
    // Mouse up handler
    const handleMouseUp = () => {
      mouse.down = false;
    };
    
    // Set initial cursor position and create initial fluid pattern
    setTimeout(() => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setPosition({ x: centerX, y: centerY });
      mouse.x = centerX;
      mouse.y = centerY;
      
      // Create a burst of fluid at the center
      const cx = Math.floor(centerX / fluidSimulation.cellSize);
      const cy = Math.floor(centerY / fluidSimulation.cellSize);
      
      // Add initial density in center
      fluidSimulation.addDensity(cx, cy, 300);
      
      // Add a pattern of fluid around the center
      const radius = 10;
      for (let i = 0; i < radius; i++) {
        const angle = (i / radius) * Math.PI * 2;
        const offsetX = Math.floor(Math.cos(angle) * (radius/2));
        const offsetY = Math.floor(Math.sin(angle) * (radius/2));
        
        // Add density with falloff based on distance
        const falloff = 1 - (i / radius);
        fluidSimulation.addDensity(cx + offsetX, cy + offsetY, 200 * falloff);
        
        // Add outward velocity
        fluidSimulation.addVelocity(
          cx + offsetX, 
          cy + offsetY, 
          Math.cos(angle) * 50, 
          Math.sin(angle) * 50
        );
      }
      
      // Add some random fluid spots around the page
      const gridSize = Math.floor(Math.min(canvas.width, canvas.height) / fluidSimulation.cellSize);
      for (let i = 0; i < 8; i++) {
        const randX = Math.floor(Math.random() * (gridSize-20)) + 10;
        const randY = Math.floor(Math.random() * (gridSize-20)) + 10;
        fluidSimulation.addDensity(randX, randY, 150);
      }
    }, 100);
    
    // Start animation
    animate();
    
    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', resizeCanvas);
    
    // Clean up
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  // Fluid simulation implementation
  function createFluidSimulation(width, height) {
    const CELL_SIZE = 10; // Size of each cell in the grid
    const N = Math.ceil(Math.max(width, height) / CELL_SIZE); // Grid size
    const ITER = 16; // Number of iterations for solving constraints
    
    // Create arrays for the simulation
    const density = new Array(N * N).fill(0);
    const densityPrev = new Array(N * N).fill(0);
    const vx = new Array(N * N).fill(0);
    const vy = new Array(N * N).fill(0);
    const vxPrev = new Array(N * N).fill(0);
    const vyPrev = new Array(N * N).fill(0);
    
    // Helper function to get array index from 2D coordinates
    function IX(x, y) {
      // Ensure x and y are within bounds
      x = Math.min(Math.max(1, x), N-2);
      y = Math.min(Math.max(1, y), N-2);
      return x + y * N;
    }
    
    // Diffuse scalar values (density or velocity component)
    function diffuse(b, x, x0, diff, dt) {
      const a = dt * diff * (N - 2) * (N - 2);
      
      for (let k = 0; k < ITER; k++) {
        for (let j = 1; j < N - 1; j++) {
          for (let i = 1; i < N - 1; i++) {
            x[IX(i, j)] = (x0[IX(i, j)] + a * (
              x[IX(i+1, j)] + x[IX(i-1, j)] +
              x[IX(i, j+1)] + x[IX(i, j-1)]
            )) / (1 + 4 * a);
          }
        }
        setBoundary(b, x);
      }
    }
    
    // Project velocities to ensure mass conservation
    function project(vx, vy, p, div) {
      for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
          div[IX(i, j)] = -0.5 * (
            vx[IX(i+1, j)] - vx[IX(i-1, j)] +
            vy[IX(i, j+1)] - vy[IX(i, j-1)]
          ) / N;
          p[IX(i, j)] = 0;
        }
      }
      setBoundary(0, div);
      setBoundary(0, p);
      
      for (let k = 0; k < ITER; k++) {
        for (let j = 1; j < N - 1; j++) {
          for (let i = 1; i < N - 1; i++) {
            p[IX(i, j)] = (div[IX(i, j)] + p[IX(i+1, j)] + p[IX(i-1, j)] + p[IX(i, j+1)] + p[IX(i, j-1)]) / 4;
          }
        }
        setBoundary(0, p);
      }
      
      for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
          vx[IX(i, j)] -= 0.5 * (p[IX(i+1, j)] - p[IX(i-1, j)]) * N;
          vy[IX(i, j)] -= 0.5 * (p[IX(i, j+1)] - p[IX(i, j-1)]) * N;
        }
      }
      setBoundary(1, vx);
      setBoundary(2, vy);
    }
    
    // Advect density or velocity through the velocity field
    function advect(b, d, d0, vx, vy, dt) {
      let i0, i1, j0, j1;
      let s0, s1, t0, t1;
      const dtx = dt * (N - 2);
      const dty = dt * (N - 2);
      
      for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
          const x = i - dtx * vx[IX(i, j)];
          const y = j - dty * vy[IX(i, j)];
          
          if (x < 0.5) i0 = 0; else i0 = Math.floor(x);
          if (y < 0.5) j0 = 0; else j0 = Math.floor(y);
          
          i1 = i0 + 1;
          j1 = j0 + 1;
          
          s1 = x - i0;
          s0 = 1 - s1;
          t1 = y - j0;
          t0 = 1 - t1;
          
          d[IX(i, j)] =
            s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
            s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
        }
      }
      setBoundary(b, d);
    }
    
    // Handle boundaries (walls or continuity)
    function setBoundary(b, x) {
      // Handle walls at edges
      for (let i = 1; i < N - 1; i++) {
        x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N-1)] = b === 2 ? -x[IX(i, N-2)] : x[IX(i, N-2)];
      }
      
      for (let j = 1; j < N - 1; j++) {
        x[IX(0, j)] = b === 1 ? -x[IX(1, j)] : x[IX(1, j)];
        x[IX(N-1, j)] = b === 1 ? -x[IX(N-2, j)] : x[IX(N-2, j)];
      }
      
      // Handle corners
      x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
      x[IX(0, N-1)] = 0.5 * (x[IX(1, N-1)] + x[IX(0, N-2)]);
      x[IX(N-1, 0)] = 0.5 * (x[IX(N-2, 0)] + x[IX(N-1, 1)]);
      x[IX(N-1, N-1)] = 0.5 * (x[IX(N-2, N-1)] + x[IX(N-1, N-2)]);
    }
    
    // Velocities step function
    function velocityStep(vx, vy, vxPrev, vyPrev, dt) {
      // Diffusion with configurable viscosity
      diffuse(1, vxPrev, vx, config.fluidViscosity, dt);
      diffuse(2, vyPrev, vy, config.fluidViscosity, dt);
      
      // Project to enforce mass conservation
      project(vxPrev, vyPrev, vx, vy);
      
      // Advection
      advect(1, vx, vxPrev, vxPrev, vyPrev, dt);
      advect(2, vy, vyPrev, vxPrev, vyPrev, dt);
      
      // Project again
      project(vx, vy, vxPrev, vyPrev);
    }
    
    // Density step function
    function densityStep(density, densityPrev, vx, vy, dt) {
      // Add source (already done in addDensity)
      
      // Diffusion with configurable diffusion rate
      diffuse(0, densityPrev, density, config.fluidDiffusion, dt);
      
      // Advection
      advect(0, density, densityPrev, vx, vy, dt);
      
      // Decay with configurable decay rate
      for (let i = 0; i < N * N; i++) {
        density[i] *= config.decayRate; // Configurable decay for longer/shorter trails
      }
    }
    
    // KAI fluid colors - Extra bright version with configurable intensity
    const getColorStops = () => [
      { pos: 0, color: [59, 130, 246, 0.1 * config.colorIntensity] },  // Blue with slight opacity
      { pos: 0.3, color: [59, 130, 246, 0.6 * config.colorIntensity] }, // Blue
      { pos: 0.6, color: [95, 244, 232, 0.9 * config.colorIntensity] }, // Teal
      { pos: 0.8, color: [147, 250, 255, 1.0 * config.colorIntensity] }, // Light Teal
      { pos: 1, color: [255, 255, 255, 1.2 * config.colorIntensity] }   // White (can go over 1.0 for extra brightness)
    ];
    
    // Return the fluid simulation object
    return {
      cellSize: CELL_SIZE,
      
      // Add density at a point
      addDensity(x, y, amount) {
        if (x < 1 || x > N-2 || y < 1 || y > N-2) return;
        density[IX(x, y)] += amount;
      },
      
      // Add velocity at a point
      addVelocity(x, y, amountX, amountY) {
        if (x < 1 || x > N-2 || y < 1 || y > N-2) return;
        vx[IX(x, y)] += amountX;
        vy[IX(x, y)] += amountY;
      },
      
      // Step the simulation
      step() {
        const dt = 0.16; // Time step
        velocityStep(vx, vy, vxPrev, vyPrev, dt);
        densityStep(density, densityPrev, vx, vy, dt);
      },
      
      // Draw the fluid
      draw(ctx) {
        // Clear canvas with transparent color so the background shows through
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(13, 17, 23, 0)'; // Transparent
        ctx.fillRect(0, 0, width, height);
        
        // Create color gradient between cells
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Draw density field
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < N; y++) {
            const d = density[IX(x, y)];
            
            if (d > 0.005) { // Lower threshold to draw more of the fluid
              // Normalize density value to 0-1 range for color mapping with boosted visibility
              const normalizedDensity = Math.min(d / 80, 1); // Reduce divisor to make colors appear at lower densities
              
              // Find color from gradient based on density
              let color = [0, 0, 0, 0];
              
              // Get current color stops with intensity applied
              const colorStops = getColorStops();
              
              // Interpolate between color stops
              for (let i = 0; i < colorStops.length - 1; i++) {
                const stop1 = colorStops[i];
                const stop2 = colorStops[i + 1];
                
                if (normalizedDensity >= stop1.pos && normalizedDensity <= stop2.pos) {
                  const t = (normalizedDensity - stop1.pos) / (stop2.pos - stop1.pos);
                  
                  // Apply color with brightness boost for better visibility
                  color[0] = Math.floor(stop1.color[0] * (1 - t) + stop2.color[0] * t); // R
                  color[1] = Math.floor(stop1.color[1] * (1 - t) + stop2.color[1] * t); // G
                  color[2] = Math.floor(stop1.color[2] * (1 - t) + stop2.color[2] * t); // B
                  color[3] = Math.min(1, stop1.color[3] * (1 - t) + stop2.color[3] * t); // A (capped at 1)
                  break;
                }
              }
              
              // Fill cell area with calculated color
              const startX = x * CELL_SIZE;
              const startY = y * CELL_SIZE;
              
              // Apply color to each pixel in the cell
              for (let i = 0; i < CELL_SIZE; i++) {
                for (let j = 0; j < CELL_SIZE; j++) {
                  const pixelX = startX + i;
                  const pixelY = startY + j;
                  
                  if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                    const idx = (pixelY * width + pixelX) * 4;
                    
                    // Blend colors using alpha compositing
                    const alpha = color[3];
                    const existingAlpha = data[idx + 3] / 255;
                    const outAlpha = alpha + existingAlpha * (1 - alpha);
                    
                    if (outAlpha > 0) {
                      data[idx] = (color[0] * alpha + data[idx] * existingAlpha * (1 - alpha)) / outAlpha;
                      data[idx + 1] = (color[1] * alpha + data[idx + 1] * existingAlpha * (1 - alpha)) / outAlpha;
                      data[idx + 2] = (color[2] * alpha + data[idx + 2] * existingAlpha * (1 - alpha)) / outAlpha;
                      data[idx + 3] = outAlpha * 255;
                    }
                  }
                }
              }
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
    };
  }
  
  // Toggle control panel visibility
  const toggleControls = () => {
    setConfig(prev => ({ ...prev, showControls: !prev.showControls }));
  };
  
  // Update config with a new value
  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1, // Lower z-index to place behind content
          pointerEvents: 'none',
          backgroundColor: '#0d1117', // Match the original background color
        }}
      />
      
      <div
        ref={cursorRef}
        style={{
          position: 'fixed',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: 'white',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.8), 0 0 20px rgba(95, 244, 232, 0.5)',
          pointerEvents: 'none',
          zIndex: 100, // High z-index to stay above content but not above controls
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
          mixBlendMode: 'difference',
        }}
      />
      
      {/* Toggle button for controls */}
      <button
        onClick={toggleControls}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 900,
          padding: '8px 12px',
          background: 'rgba(13, 17, 23, 0.7)',
          color: '#fff',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {config.showControls ? 'Hide Controls' : 'Show Controls'}
      </button>
      
      {/* Control panel */}
      {config.showControls && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 900,
            padding: '15px',
            background: 'rgba(13, 17, 23, 0.8)',
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            color: 'white',
            width: '300px',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#5FF4E8' }}>Fluid Effect Settings</h3>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Fluid Density: {config.fluidDensity}
            </label>
            <input
              type="range"
              min="50"
              max="200"
              value={config.fluidDensity}
              onChange={(e) => updateConfig('fluidDensity', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Color Intensity: {config.colorIntensity.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={config.colorIntensity}
              onChange={(e) => updateConfig('colorIntensity', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Decay Rate: {config.decayRate.toFixed(3)}
            </label>
            <input
              type="range"
              min="0.95"
              max="0.999"
              step="0.001"
              value={config.decayRate}
              onChange={(e) => updateConfig('decayRate', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Fluid Viscosity: {config.fluidViscosity.toFixed(4)}
            </label>
            <input
              type="range"
              min="0.0001"
              max="0.01"
              step="0.0001"
              value={config.fluidViscosity}
              onChange={(e) => updateConfig('fluidViscosity', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Fluid Diffusion: {config.fluidDiffusion.toFixed(4)}
            </label>
            <input
              type="range"
              min="0.0001"
              max="0.01"
              step="0.0001"
              value={config.fluidDiffusion}
              onChange={(e) => updateConfig('fluidDiffusion', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
      
      <style>{`
        html, body, a, button, input, select, textarea {
          cursor: none !important;
        }
        
        /* Make slider thumbs visible with custom styling */
        input[type="range"] {
          -webkit-appearance: none;
          height: 6px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 3px;
          cursor: pointer !important;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: #5FF4E8;
          border-radius: 50%;
          cursor: pointer !important;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #5FF4E8;
          border-radius: 50%;
          border: none;
          cursor: pointer !important;
        }
        
        button {
          cursor: pointer !important;
        }
      `}</style>
    </>
  );
};

export default FluidCursor;