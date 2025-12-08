
import React, { useEffect, useRef, useState } from 'react';
import p5 from 'p5';
import { HandTracker } from '../services/handTracking';
import { audioEngine } from '../services/audioEngine';
import { HandState, AppState, GameGenre } from '../types';

interface JazzCanvasProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  genre: GameGenre;
}

const JazzCanvas: React.FC<JazzCanvasProps> = ({ appState, setAppState, genre }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);
  const p5InstanceRef = useRef<p5 | null>(null);

  const handStateRef = useRef<HandState>({
    left: null, right: null, isLeftPinching: false, isRightPinching: false, leftSqueeze: 0, rightSqueeze: 0
  });

  // Global Beat/Note flash references for visual reactivity
  const beatFlashRef = useRef(0);
  const noteTriggersRef = useRef<{x: number, y: number, life: number}[]>([]);

  const [debugMsg, setDebugMsg] = useState("Initializing Generative Visuals...");

  // --- Hand Tracking Logic ---
  const getHandOpenness = (landmarks: any[]): number => {
    if (!landmarks || landmarks.length < 21) return 0;
    const wrist = landmarks[0];
    const tips = [8, 12, 16, 20]; 
    let totalDist = 0;
    tips.forEach(idx => {
        const tip = landmarks[idx];
        totalDist += Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
    });
    const avgDist = totalDist / 4;
    const openness = (avgDist - 0.15) / 0.25;
    return Math.max(0, Math.min(1, openness));
  };

  useEffect(() => {
    if (appState !== AppState.RUNNING || !containerRef.current || !videoRef.current) return;

    // Connect Audio Events to Visuals
    audioEngine.onBeat((type) => {
        beatFlashRef.current = 1.0; // Flash intensity
    });

    audioEngine.onNoteTriggered((type, x, y) => {
        // Add a burst/ripple at this location
        noteTriggersRef.current.push({ x, y, life: 1.0 });
    });

    // Start Hand Tracking
    const onHandResults = (results: any) => {
      let left = null, right = null, leftSqueeze = 0, rightSqueeze = 0;

      if (results.multiHandLandmarks) {
        for (const [index, landmarks] of results.multiHandLandmarks.entries()) {
          const isRight = results.multiHandedness[index].label === 'Right';
          const tip = landmarks[8]; 
          // Map to 0-1 range (Mirror horizontal)
          const coords = { x: 1 - tip.x, y: tip.y }; 
          
          const openness = getHandOpenness(landmarks);
          const squeeze = 1.0 - openness;

          if (isRight) { right = coords; rightSqueeze = squeeze; }
          else { left = coords; leftSqueeze = squeeze; }
        }
      }

      // Pass data to Audio Engine
      if (right) audioEngine.updateRightHand(right.y, right.x, true, rightSqueeze);
      if (left) audioEngine.updateLeftHand(left.y, left.x, true, leftSqueeze);

      handStateRef.current = { left, right, isLeftPinching: false, isRightPinching: false, leftSqueeze, rightSqueeze };
    };

    handTrackerRef.current = new HandTracker(onHandResults);
    handTrackerRef.current.start(videoRef.current)
      .then(() => setDebugMsg(""))
      .catch(err => setAppState(AppState.ERROR));

    // --- P5.JS SKETCH ---
    const sketch = (p: p5) => {
      let particles: any[] = [];
      
      // Hand Velocity Tracking
      let prevLeftHand: p5.Vector | null = null;
      let prevRightHand: p5.Vector | null = null;
      
      // Mode-specific globals
      let globalHue = 0;
      let vortexAngle = 0;

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        initParticles();
      };

      const initParticles = () => {
        particles = [];
        let count = 0;
        
        if (genre === GameGenre.JAZZ) count = 350; // Liquid
        else if (genre === GameGenre.FUNK) count = 300; // Vortex
        else if (genre === GameGenre.ELECTRONIC) count = 80; // Neural Grid (fewer for connections)

        for (let i = 0; i < count; i++) {
          if (genre === GameGenre.JAZZ) particles.push(new LiquidParticle(p));
          else if (genre === GameGenre.FUNK) particles.push(new VortexParticle(p));
          else if (genre === GameGenre.ELECTRONIC) particles.push(new NeuralNode(p));
        }
      };

      p.draw = () => {
        // 0. UPDATE HAND PHYSICS (Calculate Velocities)
        const currentHands = handStateRef.current;
        const leftVec = currentHands.left ? p.createVector(currentHands.left.x * p.width, currentHands.left.y * p.height) : null;
        const rightVec = currentHands.right ? p.createVector(currentHands.right.x * p.width, currentHands.right.y * p.height) : null;

        const leftVel = (leftVec && prevLeftHand) ? p5.Vector.sub(leftVec, prevLeftHand) : p.createVector(0,0);
        const rightVel = (rightVec && prevRightHand) ? p5.Vector.sub(rightVec, prevRightHand) : p.createVector(0,0);

        // Update prev for next frame
        prevLeftHand = leftVec ? leftVec.copy() : null;
        prevRightHand = rightVec ? rightVec.copy() : null;

        const handVels = { left: leftVel, right: rightVel };


        // 1. TRAIL EFFECT (Blend Mode Trick)
        p.blendMode(p.BLEND);
        
        let bgAlpha = 10;
        if (genre === GameGenre.JAZZ) bgAlpha = 12; // Slightly faster fade for dynamic jazz
        if (genre === GameGenre.FUNK) bgAlpha = 20; 
        if (genre === GameGenre.ELECTRONIC) bgAlpha = 25; 

        // Flash background on beat
        if (beatFlashRef.current > 0.01) {
            p.fill(0, 0, 20 * beatFlashRef.current, bgAlpha + 10);
            beatFlashRef.current *= 0.9;
        } else {
            p.fill(0, bgAlpha);
        }
        
        p.rect(0, 0, p.width, p.height);

        // 2. RENDER PARTICLES (Glowing Mode)
        p.blendMode(p.ADD);
        
        // Slowly shift global hue for atmosphere
        globalHue = (p.frameCount * 0.1) % 360;

        // Render Triggers (Bursts from notes)
        for(let i = noteTriggersRef.current.length - 1; i >= 0; i--) {
            const t = noteTriggersRef.current[i];
            p.noFill();
            p.strokeWeight(3);
            p.stroke(0, 0, 100, t.life * 100);
            p.circle(t.x * p.width, t.y * p.height, (1.0 - t.life) * 200);
            t.life -= 0.05;
            if(t.life <= 0) noteTriggersRef.current.splice(i, 1);
        }

        // Render Mode Specifics
        if (genre === GameGenre.JAZZ) {
            drawEtherealLiquid(p, particles, handVels);
        } else if (genre === GameGenre.FUNK) {
            drawVortex(p, particles, globalHue);
        } else if (genre === GameGenre.ELECTRONIC) {
            drawNeuralGrid(p, particles);
        }
      };

      // --- MODE 0: HIGH-ENERGY FLUID JAZZ (UPDATED) ---
      class LiquidParticle {
        pos: p5.Vector; 
        vel: p5.Vector; 
        acc: p5.Vector;
        prevPos: p5.Vector;
        maxSpeed: number; 
        
        constructor(p: p5) {
            this.pos = p.createVector(p.random(p.width), p.random(p.height));
            this.prevPos = this.pos.copy();
            this.vel = p.createVector(0,0);
            this.acc = p.createVector(0,0);
            this.maxSpeed = p.random(6, 15); // High speed capability
        }

        update(p: p5, hands: HandState, handVels: {left: p5.Vector, right: p5.Vector}) {
            this.prevPos = this.pos.copy();
            
            // 1. Base Flow (Perlin Noise) - keeps it alive naturally
            let nScale = 0.005;
            let angle = p.noise(this.pos.x * nScale, this.pos.y * nScale, p.frameCount * 0.005) * p.TWO_PI * 4;
            let flowForce = p5.Vector.fromAngle(angle);
            flowForce.mult(0.5); // Gentle base flow
            this.acc.add(flowForce);

            // 2. Interaction Logic
            const interact = (h: {x:number, y:number} | null, hVel: p5.Vector) => {
                if (!h) return;
                let handPos = p.createVector(h.x * p.width, h.y * p.height);
                let dir = p5.Vector.sub(handPos, this.pos);
                let d = dir.mag();
                
                // Interaction Radius
                if (d < 400) {
                    // Attraction / Gravity (The Conductor's Pull)
                    dir.normalize();
                    let attractionStr = p.map(d, 0, 400, 1.5, 0); 
                    dir.mult(attractionStr);
                    this.acc.add(dir);

                    // Hand Velocity Injection (Turbulence/Drag)
                    // If hand is moving fast, pull particles along with it (The Swirl)
                    let velMag = hVel.mag();
                    if (velMag > 5) { // Threshold for "Fast" movement
                        let dragForce = hVel.copy();
                        dragForce.normalize();
                        // Massive force if close and hand is fast
                        dragForce.mult(p.map(d, 0, 300, 4, 0) * (velMag * 0.05)); 
                        this.acc.add(dragForce);
                        
                        // Add some chaotic turbulence
                        let turb = p5.Vector.random2D();
                        turb.mult(1.5);
                        this.acc.add(turb);
                    }
                }
            };

            interact(hands.left, handVels.left);
            interact(hands.right, handVels.right);

            // 3. Physics
            this.vel.add(this.acc);
            this.vel.limit(this.maxSpeed);
            this.vel.mult(0.94); // Friction/Damping to simulate fluid
            this.pos.add(this.vel);
            this.acc.mult(0); // Reset acceleration

            // 4. Wrap around
            if (this.pos.x > p.width) { this.pos.x = 0; this.prevPos.x = this.pos.x; }
            if (this.pos.x < 0) { this.pos.x = p.width; this.prevPos.x = this.pos.x; }
            if (this.pos.y > p.height) { this.pos.y = 0; this.prevPos.y = this.pos.y; }
            if (this.pos.y < 0) { this.pos.y = p.height; this.prevPos.y = this.pos.y; }
        }

        show(p: p5) {
            let speed = this.vel.mag();
            let speedNorm = p.constrain(speed / (this.maxSpeed * 0.8), 0, 1);
            
            // Dynamic Color Logic
            // Slow: Cool Jazz (Deep Blue/Purple) -> Hue 230-280
            // Fast: Hot Energy (Gold/White) -> Hue 40-60, Low Saturation
            
            let h, s, b, alpha;
            
            if (speedNorm < 0.3) {
                // COOL STATE
                h = p.map(speedNorm, 0, 0.3, 230, 280);
                s = 80;
                b = p.map(speedNorm, 0, 0.3, 50, 80);
                alpha = p.map(speedNorm, 0, 0.3, 40, 70);
            } else {
                // HOT STATE
                // Map remainder of speed to wrap around purple -> red -> orange -> gold
                let hMap = p.map(speedNorm, 0.3, 1, 280, 400); 
                h = hMap % 360; 
                
                // Saturation drops as it gets hotter (whiter)
                s = p.map(speedNorm, 0.3, 1, 80, 10); 
                b = 100; // Max brightness
                alpha = p.map(speedNorm, 0.3, 1, 70, 100);
            }

            p.stroke(h, s, b, alpha);
            
            // Variable Stroke Weight & Length
            // Faster = Thicker stroke
            let sw = p.map(speedNorm, 0, 1, 1.5, 4);
            p.strokeWeight(sw);
            
            // Draw line from prevPos to pos (creates stretch effect)
            p.line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
        }
      }

      function drawEtherealLiquid(p: p5, particles: LiquidParticle[], handVels: {left: p5.Vector, right: p5.Vector}) {
          particles.forEach(pt => {
              pt.update(p, handStateRef.current, handVels);
              pt.show(p);
          });
      }


      // --- MODE 1: 3D VORTEX (FUNK) ---
      class VortexParticle {
        x: number; y: number; z: number;
        angle: number; radius: number; speed: number;
        oX: number; oY: number; // Original normalized coords -1 to 1

        constructor(p: p5) {
            this.respawn(p);
            this.z = p.random(100, 2000); // Start anywhere in tunnel
        }

        respawn(p: p5) {
            this.x = p.random(-p.width, p.width);
            this.y = p.random(-p.height, p.height);
            this.z = p.random(1000, 2000); // Start deep
            this.oX = p.random(-1, 1);
            this.oY = p.random(-1, 1);
            this.speed = p.random(10, 30);
        }

        update(p: p5, hands: HandState) {
            this.z -= (this.speed + (beatFlashRef.current * 50)); // Beat speed boost
            
            // Hands control twist/rotation speed
            let twist = 0.02;
            if (hands.right || hands.left) twist = 0.05;
            vortexAngle += twist * 0.01; // Global twist accumulator

            if (this.z < 1) {
                this.respawn(p);
            }
        }

        show(p: p5, gHue: number) {
            let cx = p.width / 2;
            let cy = p.height / 2;
            
            // 3D Projection
            // Rotate (x,y) around Z axis
            let ang = p.atan2(this.y, this.x) + vortexAngle + (this.z * 0.002);
            let rad = p.dist(0,0, this.x, this.y);
            
            let rx = p.cos(ang) * rad;
            let ry = p.sin(ang) * rad;

            let sx = p.map(rx / this.z, 0, 1, 0, p.width/2);
            let sy = p.map(ry / this.z, 0, 1, 0, p.height/2);
            
            // Size grows as it gets closer
            let r = p.map(this.z, 0, 2000, 20, 0); 
            
            // Funk Palette: Pink/Green/Orange
            // Color shifts based on Z depth
            let h = (gHue + (this.z * 0.1) + (this.x * 0.1)) % 360;
            
            p.fill(h, 90, 100, p.map(this.z, 0, 2000, 100, 0));
            p.noStroke();
            p.ellipse(cx + sx, cy + sy, r);
        }
      }

      function drawVortex(p: p5, particles: VortexParticle[], gHue: number) {
          p.push();
          particles.forEach(pt => {
              pt.update(p, handStateRef.current);
              pt.show(p, gHue);
          });
          p.pop();
      }


      // --- MODE 2: ACTIVE NEURAL GRID (ELECTRONIC) ---
      class NeuralNode {
        pos: p5.Vector; vel: p5.Vector;
        baseSize: number;
        id: number;

        constructor(p: p5) {
            this.pos = p.createVector(p.random(p.width), p.random(p.height));
            this.vel = p5.Vector.random2D().mult(p.random(0.5, 1.5));
            this.baseSize = p.random(4, 10);
            this.id = Math.random();
        }

        update(p: p5, hands: HandState) {
            this.pos.add(this.vel);
            
            // Bounce
            if (this.pos.x < 0 || this.pos.x > p.width) this.vel.x *= -1;
            if (this.pos.y < 0 || this.pos.y > p.height) this.vel.y *= -1;

            // Hand Interaction (Glitch/Shake)
            let isGlitching = false;
            const checkGlitch = (h: {x:number, y:number} | null) => {
                if(!h) return;
                let d = p.dist(this.pos.x, this.pos.y, h.x * p.width, h.y * p.height);
                if (d < 150) isGlitching = true;
            }
            checkGlitch(hands.left);
            checkGlitch(hands.right);

            if (isGlitching) {
                // Shake violently
                this.pos.x += p.random(-5, 5);
                this.pos.y += p.random(-5, 5);
            }
        }

        show(p: p5) {
            // Pulse size
            let s = this.baseSize + Math.sin(p.frameCount * 0.1 + this.id * 10) * 3;
            // Electronic Green/Pink
            p.fill(this.id > 0.5 ? 120 : 320, 90, 100, 80);
            p.noStroke();
            p.ellipse(this.pos.x, this.pos.y, s);
        }
      }

      function drawNeuralGrid(p: p5, nodes: NeuralNode[]) {
          // Update & Draw Nodes
          nodes.forEach(n => {
              n.update(p, handStateRef.current);
              n.show(p);
          });

          // Draw Connections & Data Packets
          p.strokeWeight(1);
          const maxDist = 150;
          
          for (let i = 0; i < nodes.length; i++) {
              for (let j = i + 1; j < nodes.length; j++) {
                  let n1 = nodes[i];
                  let n2 = nodes[j];
                  let d = p.dist(n1.pos.x, n1.pos.y, n2.pos.x, n2.pos.y);

                  if (d < maxDist) {
                      let alpha = p.map(d, 0, maxDist, 80, 0);
                      p.stroke(200, 50, 100, alpha); // Cyan lines
                      p.line(n1.pos.x, n1.pos.y, n2.pos.x, n2.pos.y);

                      // Data Packet (Simulated traveling dot)
                      // Use Noise/Math to move a dot along the line based on time
                      let packetPos = (p.frameCount * 0.05 + n1.id * 10 + n2.id * 10) % 1.0;
                      let px = p.lerp(n1.pos.x, n2.pos.x, packetPos);
                      let py = p.lerp(n1.pos.y, n2.pos.y, packetPos);
                      
                      p.noStroke();
                      p.fill(0, 0, 100); // White bright packet
                      p.ellipse(px, py, 4);
                  }
              }
          }
      }

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        initParticles();
      };
    };

    p5InstanceRef.current = new p5(sketch, containerRef.current);

    return () => {
      handTrackerRef.current?.stop();
      p5InstanceRef.current?.remove();
    };
  }, [appState, setAppState, genre]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <div ref={containerRef} className="w-full h-full" />
      {debugMsg && <div className="absolute top-4 left-4 text-xs text-gray-500 font-mono z-50 mix-blend-difference">{debugMsg}</div>}
    </div>
  );
};

export default JazzCanvas;
