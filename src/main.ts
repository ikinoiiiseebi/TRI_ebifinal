// エントリーポイント
import './style.css';
import { Game } from './game';
import { InputManager } from './input';
import { setupUI } from './ui';

// Canvas初期化
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// InputManager
const inputManager = new InputManager();

// Game
let game: Game | null = null;

function startGame() {
    if (game) {
        game.stop();
    }
    game = new Game(canvas, inputManager);
    game.start();
}

function restartGame() {
    if (game) {
        game.restart();
    } else {
        startGame();
    }
}

async function handleCameraToggle(enabled: boolean) {
    if (enabled) {
        const success = await inputManager.enableCamera();
        if (!success) {
            console.warn('カメラが使用できません。キーボード操作に切替');
        }
    } else {
        inputManager.disableCamera();
    }
}

// UI接続
setupUI(startGame, restartGame, handleCameraToggle);
