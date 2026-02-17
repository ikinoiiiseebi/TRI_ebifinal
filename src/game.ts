// ゲーム統合 (メインループ)
import { PhaseManager, Phase } from './phase';
import { Player } from './player';
import { ObstacleManager } from './obstacle';
import { ReservationBuffer } from './reservation';
import { InputManager } from './input';
import { Renderer } from './renderer';
import { showGameOver } from './ui';

export class Game {
    private renderer: Renderer;
    private player: Player;
    private obstacles: ObstacleManager;
    private phaseManager: PhaseManager;
    private reservation: ReservationBuffer;
    private inputManager: InputManager;

    private canvas: HTMLCanvasElement;
    private running = false;
    private gameOver = false;
    private lastTime = 0;
    private animationFrameId: number | null = null;

    // スコア・速度
    private score = 0;
    private baseSpeed = 300; // 初期速度 (少し遅く)
    private realtimeBaseSpeed = 200; // リアルタイムモード初期速度 (通常の半分)
    private speed = 300;
    private elapsedTotal = 0;
    private speedIncreaseInterval = 10;
    private speedIncreaseFactor = 0.15; // 加速度 (大きく)

    // EXECUTE開始時の速度（到達線計算用）
    private executeStartSpeed = 400;
    private executeDuration = 0.5;

    // 最高スコア
    private bestScore = 0;

    constructor(canvas: HTMLCanvasElement, inputManager: InputManager) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.player = new Player();
        this.obstacles = new ObstacleManager();
        this.reservation = new ReservationBuffer();
        this.inputManager = inputManager;

        this.phaseManager = new PhaseManager((phase) => this.onPhaseChange(phase));

        const saved = localStorage.getItem('projection_best_score');
        if (saved) this.bestScore = parseFloat(saved);
    }

    stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.running = false;
    }

    start() {
        this.stop(); // 既存ループ停止
        this.reset();
        this.running = true;
        this.gameOver = false;
        this.lastTime = performance.now();
        this.phaseManager.start();
        this.loop(this.lastTime);
    }

    private reset() {
        this.score = 0;
        this.elapsedTotal = 0;

        // リアルタイムモードかどうかで初期速度を変える
        // PhaseManagerの初期状態はREADYだが、その後の遷移先(startPhase)を確認する必要がある
        // しかしここでは単純に、updateSpeedで補正されることを期待するか、
        // PhaseManagerに問い合わせる。今の実装ではPhaseManager.start()でモードが決まる。
        // ここでは一旦baseSpeedにしておき、updateループ内で補正されるように設計するか、
        // もしくはPhaseManagerの状態を見る。
        // PhaseManagerはstart()で初期化されるため、reset時点では不明な場合がある。
        // よって、start()内で phaseManager.start() した後に speed を再設定するのが安全だが、
        // 簡易的に updateSpeed で毎回計算しているので、初期値は baseSpeed で問題ない。
        // ただし、リアルタイムモード開始直後の1フレーム目で速度が跳ねないように、
        // updateSpeed に任せる。

        this.speed = this.baseSpeed;

        this.player.reset();
        this.obstacles.reset();
        this.reservation.clear();
        this.phaseManager.reset();
        this.renderer.calcLayout();
        this.inputManager.resetKeyboardLane();
    }

    restart() {
        this.start();
    }

    private loop(time: number) {
        if (!this.running) return;

        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.draw(dt);

        if (this.running && !this.gameOver) {
            this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        }
        // console.log(this.lastTime); // デバッグログ削除
    }

    private update(dt: number) {
        this.phaseManager.update(dt);
        const phase = this.phaseManager.phase;

        this.inputManager.update(dt);

        switch (phase) {
            case 'READY':
                break;

            case 'RESERVE':
                // ユーザー入力でレーン選択＋アクション＋記録
                this.player.setLane(this.inputManager.currentLane);
                this.player.setAction(this.inputManager.currentAction);
                this.reservation.record(
                    this.phaseManager.elapsed,
                    this.player.lane,
                    this.player.action,
                );
                break;

            case 'EXECUTE':
                // 予約データで自動移動＋アクション再生
                {
                    const progress = this.phaseManager.progress;
                    const targetLane = this.reservation.getLaneAtProgress(progress);
                    const targetAction = this.reservation.getActionAtProgress(progress);
                    this.player.setLane(targetLane);
                    this.player.setAction(targetAction);
                }

                this.elapsedTotal += dt;
                this.updateSpeed();
                const execSpeed = this.speed * 2; // 発動中は2倍速
                this.score += execSpeed * dt / 10;
                this.obstacles.update(
                    dt, execSpeed,
                    this.renderer.roadLeft, this.renderer.laneWidth,
                    this.elapsedTotal,
                );

                this.player.updatePosition(
                    this.renderer.roadLeft, this.renderer.laneWidth,
                    this.canvas.height, this.elapsedTotal,
                );

                if (this.obstacles.checkCollision(
                    this.player.getRect(), this.player.action,
                    this.renderer.roadLeft, this.renderer.laneWidth,
                )) {
                    this.endGame();
                    return;
                }
                break;

            case 'REALTIME':
                // リアルタイム入力反映
                this.player.setLane(this.inputManager.currentLane);
                this.player.setAction(this.inputManager.currentAction);

                this.elapsedTotal += dt;
                this.updateSpeed(); // 速度更新 (加速)

                const realtimeSpeed = this.speed;
                this.score += realtimeSpeed * dt / 10;

                this.obstacles.update(
                    dt, realtimeSpeed,
                    this.renderer.roadLeft, this.renderer.laneWidth,
                    this.elapsedTotal
                );

                this.player.updatePosition(
                    this.renderer.roadLeft, this.renderer.laneWidth,
                    this.canvas.height, this.elapsedTotal
                );

                if (this.obstacles.checkCollision(
                    this.player.getRect(), this.player.action,
                    this.renderer.roadLeft, this.renderer.laneWidth
                )) {
                    this.endGame();
                    return;
                }
                break;
        }

        this.player.updatePosition(
            this.renderer.roadLeft, this.renderer.laneWidth,
            this.canvas.height, this.elapsedTotal,
        );
    }

    private updateSpeed() {
        const intervals = Math.floor(this.elapsedTotal / this.speedIncreaseInterval);
        this.speed = this.baseSpeed * Math.pow(1 + this.speedIncreaseFactor, intervals);
    }

    private draw(dt: number) {
        let renderSpeed = this.speed;
        if (this.phaseManager.phase === 'EXECUTE') {
            renderSpeed = this.speed * 2;
        } else if (this.phaseManager.phase === 'REALTIME') {
            renderSpeed = this.speed;
        }
        this.renderer.render(
            this.player,
            this.obstacles,
            this.phaseManager.phase,
            this.phaseManager.timer,
            this.phaseManager.duration,
            this.score,
            renderSpeed,
            this.reservation,
            dt,
            this.executeStartSpeed * 2,
            this.executeDuration,
        );
    }

    private onPhaseChange(phase: Phase) {
        switch (phase) {
            case 'RESERVE':
                this.reservation.clear();
                this.player.setAction('stand');
                break;
            case 'EXECUTE':
                this.executeStartSpeed = this.speed;
                this.executeDuration = this.phaseManager.duration;
                break;
        }
    }

    private endGame() {
        this.running = false;
        this.gameOver = true;

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('projection_best_score', this.bestScore.toString());
        }

        showGameOver(this.score, this.bestScore);
    }
}
