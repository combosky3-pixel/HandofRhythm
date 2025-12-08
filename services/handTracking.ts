
// Access global MediaPipe variables loaded via script tags in index.html
declare const Hands: any;
declare const Camera: any;

export class HandTracker {
  private hands: any = null;
  private camera: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private isActive: boolean = false;

  constructor(
    onResults: (results: any) => void
  ) {
    this.hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults(onResults);
  }

  public async start(videoElement: HTMLVideoElement) {
    this.isActive = true;
    this.videoElement = videoElement;
    
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        // Prevent sending data if we are stopping or stopped
        if (this.isActive && this.hands && this.videoElement) {
            try {
                await this.hands.send({ image: this.videoElement });
            } catch (error) {
                // Suppress errors during shutdown phase
                if (this.isActive) console.warn("MediaPipe send error:", error);
            }
        }
      },
      width: 640, // Lower resolution for better compatibility/permissions
      height: 480
    });

    await this.camera.start();
  }

  public stop() {
    this.isActive = false;

    if (this.camera) {
       // Try to stop the tracks on the source stream directly
       const stream = this.videoElement?.srcObject as MediaStream;
       if (stream) {
         stream.getTracks().forEach(track => track.stop());
       }
       
       // Stop the camera utility if method exists
       if (this.camera && typeof this.camera.stop === 'function') {
           this.camera.stop();
       }
    }
    
    if (this.hands) {
      try {
        this.hands.close();
      } catch (e) {
        console.warn("Error closing MediaPipe Hands:", e);
      }
      this.hands = null;
    }
  }
}
