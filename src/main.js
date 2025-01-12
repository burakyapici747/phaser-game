import Phaser from 'phaser';
import { io } from 'socket.io-client';
import GameScene from './scenes/GameScene';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    backgroundColor: '#FFFFFF',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: GameScene
};

let game = null;

window.connectToGame = async () => {
    const username = document.getElementById('username').value;
    const serverIp = document.getElementById('server-ip').value;
    const serverPort = document.getElementById('server-port').value;

    if (!username || !serverIp || !serverPort) {
       // alert('Please fill in all fields');
        //return;
    }

    const socket = io(`https://gamemagma.live:3001`, {
        transports: ['webtransport'],
        transportOptions: {
            webtransport: {
		hostname: 'gamemagma.live',
                port: '3001'
            }
        }
    });

    socket.on('connect', () => {
        document.getElementById('connection-form').classList.add('hidden');
        
        if (!game) {
            game = new Phaser.Game(config);
        }

        game.scene.start('GameScene', { socket });
        socket.emit('player:join', username);
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Failed to connect to server. Please check your connection details.');
    });
}; 
