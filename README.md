# EpiAirConsole

## Project Concept & Inspiration
EpiAirConsole is inspired by the AirConsole platform, which allows users to play web-based games where the PC acts as the main screen and mobile devices serve as controllers. The goal is to recreate this experience using a modern web stack, enabling seamless integration of 2D games (built with Phaser.js) and real-time communication between devices via Socket.IO. The project is fully developed in TypeScript for maintainability and scalability.

### Key Features
- PC web page displays the game (main screen)
- Mobile web page acts as a controller (gamepad)
- Real-time communication using Socket.IO
- Modular game integration with Phaser.js (2D games)
- All code written in TypeScript

## Stack Overview
- **Frontend:** TypeScript, HTML5, SCSS, Socket.IO-client
- **Backend:** Node.js, TypeScript, Socket.IO-server
- **Games:** Phaser.js, TypeScript
- **Mobile:** TypeScript, HTML5, SCSS, Socket.IO-client
- **Monorepo:** Shared node_modules at the root, each part (frontend, backend, games, mobile) has its own package.json and tsconfig.json

## Installation

1. **Clone the repository:**
	```bash
	git clone <repo-url>
	cd EpiAirConsole
	```
2. **Install all dependencies (from the root):**
	```bash
	npm install
	```
	This will install all required packages for every part of the project (frontend, backend, games, mobile) using the shared node_modules.

## How to Run the Project

### Recommended (run from repository root)

This repo uses a single shared `node_modules` at the root. For quick development and testing you can run the backend and the test socket clients from the repo root:

- Start backend in dev (auto-reload):
```bash
npm run backend:dev
```

- Start a test frontend socket client (local test runner):
```bash
npm run socket:frontend
```

- Start a test mobile socket client (local test runner):
```bash
npm run socket:mobile
```

Open the frontend test page at http://localhost:3000/ (served by the backend) to exercise socket flows.

### Alternative: run each part from its folder

If you prefer to run parts independently (build/start from each subfolder) you can still do so:

1. **Start the backend server:**
```bash
cd backend
npm run build   # or npm run dev if available
npm start
```

2. **Start the frontend:**
```bash
cd ../frontend
npm run build   # or npm run dev if available
npm start
```

3. **Start the mobile client:**
```bash
cd ../mobile
npm run build   # or npm run dev if available
npm start
```

4. **Add and run games:**
- Each game should be placed in a subfolder of `games/` and built with Phaser.js and TypeScript.
- Build and run games as needed (see each game's README for details).

## Backend server

Run the backend from the repository root (this project uses a single node_modules at the root):

- Dev (auto-reload):
```bash
npm run backend:dev
```
- Build:
```bash
npm run backend:build
```
- Start built version:
```bash
npm run backend:start
```
The backend listens on PORT (default 3000) and exposes a /health route.

## Notes
- All commands should be run from the respective folders in development mode.
- Make sure to use Node.js v18+ and npm v9+ for best compatibility.
- For development, you can use `npm run dev` if available in each part.
- Docker instructions will be added soon for unified launch.
