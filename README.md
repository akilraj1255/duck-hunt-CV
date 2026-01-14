# 🎯 Duck Hunt CV: Neon Retro Edition

A high-performance, browser-based recreation of the classic **Duck Hunt**, powered by **MediaPipe Hand Tracking** for a controller-free "Minority Report" style gameplay experience.

![Game Aesthetic](https://img.shields.io/badge/Aesthetic-Neon_Retro-ff00ff)
![Tech](https://img.shields.io/badge/Tech-MediaPipe_|_JS_|_CSS3-blue)

## 🚀 Experience the Future of Classic Gaming
This isn't just a clone; it's a modern reimagining. Control the hunt using only your hands. Move your palm to aim and **pinch your thumb and index finger** to fire.

### ✨ Key Features
*   **Computer Vision Controls**: Real-time hand tracking with 1.3x sensitivity and motion smoothing for precise aiming.
*   **Pinch-to-Shoot Gesture**: Intuitive gesture detection instead of a mouse click.
*   **Level Progression**: Ducks get faster and spawn more frequently as you level up (Level up every 5 kills).
*   **Strike System**: 3 strikes and you're out! Don't let the ducks flee.
*   **Dynamic HUD**: Sleek glassmorphism UI with round timers, level indicators, and high scores.
*   **Premium Crosshair**: Custom sci-fi reticle with pulsing animations and firing feedback.
*   **Custom 16-bit Assets**: Bespoke pixel art ducks with a dynamic "Chroma Key" transparency engine for seamless flight.

## 🛠️ Technology Stack
- **Engine**: Vanilla JavaScript (ES6+) with a custom Canvas rendering loop.
- **AI/CV**: MediaPipe Tasks Vision (`HandLandmarker`) for sub-10ms gesture detection.
- **Styling**: Modern CSS3 featuring advanced gradients, glassmorphism, and neon glows.
- **Backend/Hosting**: Static deployment optimized for zero-latency execution.

## 🏃 Getting Started

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/CV_game.git
    cd CV_game
    ```

2.  **Run with Local Server**:
    To allow the AI models and textures to load correctly, use a local server:
    ```bash
    npx http-server -p 8080
    ```

3.  **Play**:
    Open `http://localhost:8080` in Chrome/Edge, allow camera access, and start the hunt!

## 🎮 How to Play
- **Aim**: Hold your hand up. The crosshair follows your palm.
- **Shoot**: Briefly pinch your **Thumb and Index finger** together.
- **Tip**: Keep your hand clearly visible to the camera for the smoothest tracking.

---
*Created with ❤️ for a modern arcade experience.*
