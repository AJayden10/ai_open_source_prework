// Game client script
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // WebSocket connection
        this.socket = null;
        this.serverUrl = 'wss://codepath-mmorg.onrender.com';
        
        // Game state
        this.playerId = null;
        this.players = {};
        this.avatars = {};
        this.username = 'Vanessa';
        
        // Viewport/camera
        this.cameraX = 0;
        this.cameraY = 0;
        
        // Cached avatar images for performance
        this.avatarImageCache = {};
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        try {
            this.socket = new WebSocket(this.serverUrl);
            
            this.socket.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.socket.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };
            
            this.socket.onclose = () => {
                console.log('Disconnected from game server');
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: this.username
        };
        
        this.socket.send(JSON.stringify(joinMessage));
        console.log('Sent join game message:', joinMessage);
    }
    
    handleServerMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message);
            
            switch (message.action) {
                case 'join_game':
                    this.handleJoinGameResponse(message);
                    break;
                case 'player_joined':
                    this.handlePlayerJoined(message);
                    break;
                case 'players_moved':
                    this.handlePlayersMoved(message);
                    break;
                case 'player_left':
                    this.handlePlayerLeft(message);
                    break;
                default:
                    console.log('Unknown message type:', message.action);
            }
        } catch (error) {
            console.error('Error parsing server message:', error);
        }
    }
    
    handleJoinGameResponse(message) {
        if (message.success) {
            this.playerId = message.playerId;
            this.players = message.players;
            this.avatars = message.avatars;
            
            console.log('Successfully joined game!');
            console.log('Player ID:', this.playerId);
            console.log('Current players:', this.players);
            console.log('Available avatars:', this.avatars);
            
            // Preload avatar images for performance
            this.preloadAvatarImages();
            
            // Center camera on our player
            this.centerCameraOnPlayer();
            
            // Redraw to show players
            this.draw();
        } else {
            console.error('Failed to join game:', message.error);
        }
    }
    
    handlePlayerJoined(message) {
        this.players[message.player.id] = message.player;
        this.avatars[message.avatar.name] = message.avatar;
        console.log('Player joined:', message.player.username);
        
        // Preload new avatar images
        this.preloadAvatarImages();
        
        this.draw();
    }
    
    handlePlayersMoved(message) {
        // Update player positions
        Object.keys(message.players).forEach(playerId => {
            if (this.players[playerId]) {
                Object.assign(this.players[playerId], message.players[playerId]);
            }
        });
        this.draw();
    }
    
    handlePlayerLeft(message) {
        delete this.players[message.playerId];
        console.log('Player left:', message.playerId);
        this.draw();
    }
    
    centerCameraOnPlayer() {
        if (this.playerId && this.players[this.playerId]) {
            const player = this.players[this.playerId];
            // Center camera on player, but don't go past map edges
            this.cameraX = Math.max(0, Math.min(
                player.x - this.canvas.width / 2,
                this.worldWidth - this.canvas.width
            ));
            this.cameraY = Math.max(0, Math.min(
                player.y - this.canvas.height / 2,
                this.worldHeight - this.canvas.height
            ));
        }
    }
    
    preloadAvatarImages() {
        Object.values(this.avatars).forEach(avatar => {
            Object.keys(avatar.frames).forEach(direction => {
                avatar.frames[direction].forEach((frameData, frameIndex) => {
                    const cacheKey = `${avatar.name}_${direction}_${frameIndex}`;
                    if (!this.avatarImageCache[cacheKey]) {
                        const img = new Image();
                        img.onload = () => {
                            this.avatarImageCache[cacheKey] = img;
                        };
                        img.src = frameData;
                    }
                });
            });
        });
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, this.canvas.width, this.canvas.height,
            0, 0, this.canvas.width, this.canvas.height
        );
        
        // Draw all players
        this.drawPlayers();
    }
    
    drawPlayers() {
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        // Convert world coordinates to screen coordinates
        const screenX = player.x - this.cameraX;
        const screenY = player.y - this.cameraY;
        
        // Only draw if player is visible on screen
        if (screenX < -50 || screenX > this.canvas.width + 50 || 
            screenY < -50 || screenY > this.canvas.height + 50) {
            return;
        }
        
        // Get avatar data
        const avatar = this.avatars[player.avatar];
        if (!avatar) {
            // Fallback: draw a simple circle
            this.ctx.fillStyle = player.id === this.playerId ? '#00ff00' : '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, 15, 0, 2 * Math.PI);
            this.ctx.fill();
        } else {
            // Draw avatar image
            this.drawAvatar(player, avatar, screenX, screenY);
        }
        
        // Draw username label
        this.drawUsernameLabel(player.username, screenX, screenY);
    }
    
    drawAvatar(player, avatar, screenX, screenY) {
        const direction = player.facing || 'south';
        const frameIndex = player.animationFrame || 0;
        
        // Get the appropriate frame for the direction
        let frames = avatar.frames[direction];
        if (!frames && direction === 'west') {
            // West direction uses flipped east frames
            frames = avatar.frames['east'];
        }
        
        if (frames && frames[frameIndex]) {
            const cacheKey = `${avatar.name}_${direction}_${frameIndex}`;
            const img = this.avatarImageCache[cacheKey];
            
            if (img) {
                // Calculate size maintaining aspect ratio
                const maxSize = 32;
                const aspectRatio = img.width / img.height;
                let width = maxSize;
                let height = maxSize;
                
                if (aspectRatio > 1) {
                    height = maxSize / aspectRatio;
                } else {
                    width = maxSize * aspectRatio;
                }
                
                // Draw the avatar image
                this.ctx.save();
                
                if (direction === 'west' && avatar.frames['east']) {
                    // Flip horizontally for west direction
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(img, -screenX - width/2, screenY - height/2, width, height);
                } else {
                    this.ctx.drawImage(img, screenX - width/2, screenY - height/2, width, height);
                }
                
                this.ctx.restore();
            }
        }
    }
    
    drawUsernameLabel(username, screenX, screenY) {
        // Draw username with background for readability
        this.ctx.save();
        
        // Measure text
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#000000';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        const textWidth = this.ctx.measureText(username).width;
        const textHeight = 14;
        
        // Draw background rectangle
        this.ctx.fillRect(
            screenX - textWidth/2 - 2, 
            screenY - 25, 
            textWidth + 4, 
            textHeight + 2
        );
        
        // Draw text outline
        this.ctx.strokeText(username, screenX, screenY - 15);
        
        // Draw text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(username, screenX, screenY - 15);
        
        this.ctx.restore();
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    new GameClient();
});
