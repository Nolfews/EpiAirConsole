# EpiAirConsole

## Project Concept & Inspiration
EpiAirConsole is inspired by the AirConsole platform, which allows users to play web-based games where the PC acts as the main screen and mobile devices serve as controllers. The goal is to recreate this experience using a modern web stack, enabling seamless integration of 2D games (built with Phaser.js) and real-time communication between devices via Socket.IO. The project is fully developed in TypeScript for maintainability and scalability.

### Key Features
- PC web page displays the game (main screen)
- Mobile web page acts as a controller (gamepad)
- Real-time communication using Socket.IO
- Modular game integration with Phaser.js (2D games)
- Room system with PIN codes for multi-player sessions
- Player-controller pairing with unique device codes
- **Friends system with invitations** (see [FRIENDS.md](FRIENDS.md))
- All code written in TypeScript

See [ROOMS.md](ROOMS.md) for details on the room system and controller pairing.

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

## Mobile quick start — connect with your phone

The mobile interface now supports automatic URL detection. This allows you to connect from any device without having to modify the `.env` file each time:

1. **Auto-Detection Mode** (recommended)

   To enable automatic URL detection:

   ```bash
   cp backend/.env.example backend/.env
   # Then edit backend/.env and make sure SERVER_URL is commented out or empty
   ```

   With auto-detection enabled:
   - The mobile interface will automatically detect all available IP addresses
   - A dropdown menu will show all possible connection URLs
   - You can easily switch between local IPs and ngrok URLs without editing files
   - Connection settings are remembered during your session

2. **Manual Configuration** (alternative)

   If you prefer to force a specific URL:

   ```bash
   cp backend/.env.example backend/.env
   # Then edit backend/.env and set SERVER_URL
   ```

   - To force using a LAN IP (for phones on the same network):
     ```
     SERVER_URL=http://<YOUR_LAN_IP>:3000
     ```
   - Or to expose via ngrok (for cross-network / HTTPS access):
     ```
     SERVER_URL=https://<YOUR-NGROK-SUBDOMAIN>.ngrok-free.dev
     ```

## Using ngrok for External Access

ngrok allows you to expose your local server to the internet, making it accessible from any device, even those not on your local network.

### Installing ngrok

1. **Download the latest version of ngrok**:
   ```bash
   curl -O https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
   tar xvzf ngrok-v3-stable-linux-amd64.tgz
   ```

2. **Make ngrok executable and move it to a directory in your PATH (optional)**:
   ```bash
   chmod +x ngrok
   sudo mv ngrok /usr/local/bin/   # requires root/sudo access
   ```

   Alternatively, keep it in your project directory and run it with `./ngrok`

### Setting up ngrok

1. **Sign up for a free account** at [ngrok.com](https://ngrok.com) and get your authtoken

2. **Authenticate your ngrok client**:
   ```bash
   ./ngrok authtoken YOUR_AUTHTOKEN
   ```
   Replace `YOUR_AUTHTOKEN` with the token from your ngrok dashboard.

### Exposing Your Local Server

1. **Start your backend server**:
   ```bash
   npm run backend:dev
   ```

2. **Start ngrok** (in a new terminal):
   ```bash
   ./ngrok http 3000
   ```
   This creates a tunnel to your local server running on port 3000.

3. **Note the forwarding URL** in the ngrok output:
   ```
   Forwarding    https://<your-subdomain>.ngrok-free.dev -> http://localhost:3000
   ```

4. **Update your backend/.env file** with this URL:
   ```
   SERVER_URL=https://<your-subdomain>.ngrok-free.dev
   ```

5. **Restart your backend server** to apply the new SERVER_URL.

2. Restart the backend to apply the changes:

	```bash
	npm run backend:dev
	```

3. Check that the backend exposes the configuration (it should show a non-empty `serverUrl` if you set SERVER_URL):

	```bash
	curl -sS http://127.0.0.1:3000/config.json
	# -> {"serverUrl":"http://<YOUR_LAN_IP>:3000","defaultRoom":"test-room"}
	```

4. Open the mobile page on your phone (on the same network):

	- URL: `http://<YOUR_LAN_IP>:3000/mobile.html`
	- The "Server URL" field will be prefilled and disabled if `SERVER_URL` is set.
	- Click "Connect" then "Send Message" to send a message to the backend.

5. Verify reception on the backend

	- Look at the terminal where `npm run backend:dev` is running — you should see socket connection logs and received events (join, message, etc.).

### Accessing the Application

1. **From your computer**:
   - Open `http://localhost:3000` to access the main frontend
   - Open `http://localhost:3000/mobile.html` to test the mobile interface

2. **From other devices on the same network**:
   - Use your computer's LAN IP: `http://<YOUR_LAN_IP>:3000`
   - For the mobile interface: `http://<YOUR_LAN_IP>:3000/mobile.html`
   To display your computer's LAN IP address, use the following command in a terminal:

   - **Linux/macOS (show only the main LAN IP):**
      ```bash
      hostname -I | awk '{print $1}'
      ```
      or
      ```bash
      ip addr show | awk '/inet / && !/127.0.0.1/ {print $2}' | cut -d/ -f1 | head -n1
      ```

   - **Windows (show only IPv4 addresses):**
      ```powershell
      ipconfig | findstr /R /C:"IPv4"
      ```

3. **From any device on the internet** (using ngrok):
   - Use the ngrok URL: `https://<your-subdomain>.ngrok-free.dev`
   - For the mobile interface: `https://<your-subdomain>.ngrok-free.dev/mobile.html`

### Troubleshooting ngrok

- **"ngrok version too old" error**: Download the latest version as described above
- **Authentication failures**: Verify your authtoken on the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
- **Connection issues**: Check if your backend is actually running on port 3000
- **CORS errors**: Make sure your backend allows requests from the ngrok domain

Security notes

- Never commit `backend/.env` (the repo contains `backend/.env.example` only).
- Use ngrok or HTTPS for cross-network tests to avoid mixed-content issues in mobile browsers.
- The free version of ngrok assigns random subdomains each time you restart, so you'll need to update SERVER_URL in your .env file.


## Notes
- All commands should be run from the respective folders in development mode.
- Make sure to use Node.js v18+ and npm v9+ for best compatibility.
- For development, you can use `npm run dev` if available in each part.
- Docker instructions will be added soon for unified launch.

## Game Development with Phaser.js

EpiAirConsole now includes a complete game development system using Phaser.js. You can create 2D games that players control from their mobile devices.

### Quick Start - Creating Games

1. **Build the game system** (first time):
   ```bash
   cd frontend
   npm run build:game
   ```

2. **Watch mode for development**:
   ```bash
   cd frontend
   npm run watch:game
   ```

### Game Architecture

The game system is organized as follows:
- **`frontend/src/games/BaseGame.ts`**: Abstract base class for all games
- **`frontend/src/games/SimpleGameExample.ts`**: Example game with moving circles
- **`frontend/src/games/GameManager.ts`**: Handles game lifecycle and registration
- **`frontend/src/RoomGameController.ts`**: Integrates games into the room page

### Creating a New Game

1. Create a new file in `frontend/src/games/` extending `BaseGame`
2. Implement required methods:
   - `createPhaserConfig()`: Configure Phaser game settings
   - `handlePlayerInput()`: Process controller inputs
   - `onPlayerAdded()`: Handle player joins
   - `onPlayerRemoved()`: Handle player leaves

3. Register your game in `GameManager.ts`:
   ```typescript
   export const AVAILABLE_GAMES = {
     'simple-example': SimpleGameExample,
     'my-new-game': MyNewGame,  // Add here
   } as const;
   ```

4. Rebuild: `npm run build:game`

### Controller Actions

Mobile controllers send these actions:
- `up`, `down`, `left`, `right`: Directional movements
- `action`: Primary action button

### Example Game Flow

1. Players join a room using a PIN code
2. Each player connects their mobile device as a controller
3. Host clicks "Start Game" when all players are ready
4. Game initializes with Phaser canvas
5. Players control their characters using mobile buttons
6. Game handles inputs in real-time via Socket.IO

## Quick Postgres (Docker) — local development

If you prefer to run a local Postgres in Docker (recommended to avoid touching the system DB), here's a small set of commands and notes you can copy-paste.

1) Start a Postgres container (use host port 5433 if your system Postgres uses 5432):

```bash
# remove any previous container with the same name (optional)
docker rm -f epi-postgres || true

# start postgres mapped to host port 5433
docker run --name epi-postgres \
	-e POSTGRES_USER=epiuser \
	-e POSTGRES_PASSWORD=secret \
	-e POSTGRES_DB=epiairconsole \
	-p 5433:5432 -d postgres:15
```

2) Update `backend/.env` to point to the Docker instance (example):

```
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=epiuser
DB_PASSWORD=secret
DB_NAME=epiairconsole
JWT_SECRET=un-secret-long
```

3) Restart the backend (it will auto-create the `users` table on first run):

```bash
npm run backend:dev
```

4) Verify connectivity and tables (from host):

```bash
# list tables
PGPASSWORD=secret psql -h 127.0.0.1 -p 5433 -U epiuser -d epiairconsole -c "\dt"
```

Notes
- If port 5432 is free on your machine, you can map to `-p 5432:5432` instead.
- If you see `Ident authentication failed` when connecting to a system Postgres, prefer the Docker option or adjust your system `pg_hba.conf`.

