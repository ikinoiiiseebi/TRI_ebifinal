// 設定UIの接続
import { settings, updateSetting } from './settings';

export function setupUI(
    onStart: () => void,
    onRestart: () => void,
    onCameraToggle: (enabled: boolean) => void,
) {
    const settingsPanel = document.getElementById('settingsPanel')!;
    const gameOverPanel = document.getElementById('gameOverPanel')!;
    const startBtn = document.getElementById('startBtn')!;
    const restartBtn = document.getElementById('restartBtn')!;

    // ボタングループ切替
    document.querySelectorAll('.btn-option').forEach((btn) => {
        btn.addEventListener('click', () => {
            const el = btn as HTMLButtonElement;
            const settingKey = el.dataset.setting!;
            const value = el.dataset.value!;

            // 同じグループの他ボタンのactiveを外す
            el.parentElement!.querySelectorAll('.btn-option').forEach((b) =>
                b.classList.remove('active'),
            );
            el.classList.add('active');

            if (settingKey === 'lanes') {
                updateSetting('laneCount', parseInt(value) as 2 | 3);
            } else if (settingKey === 'reserveTime') {
                updateSetting('reserveTime', parseInt(value) as 3 | 5);
            } else if (settingKey === 'camera') {
                const enabled = value === 'on';
                updateSetting('cameraEnabled', enabled);
                onCameraToggle(enabled);
            }
        });
    });

    // 操作方法モーダル
    const controlsBtn = document.getElementById('controlsBtn')!;
    const controlsModal = document.getElementById('controlsModal')!;
    const closeControlsBtn = document.getElementById('closeControlsBtn')!;

    controlsBtn.addEventListener('click', () => {
        controlsModal.style.display = '';
    });

    closeControlsBtn.addEventListener('click', () => {
        controlsModal.style.display = 'none';
    });

    controlsModal.addEventListener('click', (e) => {
        if (e.target === controlsModal) {
            controlsModal.style.display = 'none';
        }
    });

    startBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
        onStart();
    });

    restartBtn.addEventListener('click', () => {
        gameOverPanel.style.display = 'none';
        onRestart();
    });

    const menuBtn = document.getElementById('menuBtn')!;
    menuBtn.addEventListener('click', () => {
        gameOverPanel.style.display = 'none';
        settingsPanel.style.display = '';
    });
}

export function showGameOver(score: number, bestScore: number) {
    const panel = document.getElementById('gameOverPanel')!;
    const finalScoreEl = document.getElementById('finalScore')!;
    const bestScoreEl = document.getElementById('bestScore')!;

    finalScoreEl.textContent = Math.floor(score).toString();
    bestScoreEl.textContent = Math.floor(bestScore).toString();
    panel.style.display = '';
}

export function hideSettings() {
    document.getElementById('settingsPanel')!.style.display = 'none';
}

export function showSettings() {
    document.getElementById('settingsPanel')!.style.display = '';
}
