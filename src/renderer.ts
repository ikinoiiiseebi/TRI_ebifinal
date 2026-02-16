// Canvas描画 - 和風テーマ
import { settings } from './settings';
import { Player } from './player';
import { ObstacleManager } from './obstacle';
import { Phase } from './phase';
import { ReservationBuffer } from './reservation';

export class Renderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    roadLeft = 0;
    roadRight = 0;
    roadWidth = 0;
    laneWidth = 0;

    private scrollOffset = 0;
    private ripples: { x: number; y: number; radius: number; maxRadius: number; opacity: number; speed: number }[] = [];
    private rippleTimer = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.calcLayout();
        this.initRipples();
    }

    private initRipples() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (let i = 0; i < 8; i++) {
            this.ripples.push({
                x: Math.random() * w, y: Math.random() * h,
                radius: Math.random() * 30, maxRadius: 30 + Math.random() * 40,
                opacity: 0.08 + Math.random() * 0.12,
                speed: 8 + Math.random() * 12,
            });
        }
    }

    calcLayout() {
        const w = this.canvas.width;
        this.roadWidth = Math.min(w * 0.7, 400);
        this.roadLeft = (w - this.roadWidth) / 2;
        this.roadRight = this.roadLeft + this.roadWidth;
        this.laneWidth = this.roadWidth / settings.laneCount;
    }

    render(
        player: Player,
        obstacles: ObstacleManager,
        phase: Phase,
        phaseTimer: number,
        phaseDuration: number,
        score: number,
        speed: number,
        _reservation: ReservationBuffer,
        dt: number,
        execStartSpeed: number,
        execDuration: number,
    ) {
        const { ctx, canvas } = this;
        const w = canvas.width;
        const h = canvas.height;

        // 湖の水面背景
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#5a8a7a');
        bgGrad.addColorStop(0.15, '#4a7a6e');
        bgGrad.addColorStop(0.4, '#3a6a60');
        bgGrad.addColorStop(0.7, '#2d5a55');
        bgGrad.addColorStop(1, '#1e4a48');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        this.drawLakeBackground(w, h, dt);
        if (phase === 'EXECUTE') {
            this.scrollOffset = (this.scrollOffset + speed * dt) % 80;
        }

        this.drawRoad(h);
        this.drawObstacles(obstacles);

        // RESERVE中: 全距離ゾーン表示 + ゴースト表示
        if (phase === 'RESERVE') {
            this.drawTravelZone(player, speed * 2, execDuration, h, 1.0);
            this.drawGhostPlayer(player);
        }

        // EXECUTE中: 残り距離に応じて到達線がステージ速度と同期して下がる
        if (phase === 'EXECUTE') {
            const elapsedInExec = phaseDuration - phaseTimer;
            const remaining = Math.max(0, (execDuration - elapsedInExec) / execDuration);
            this.drawTravelZone(player, execStartSpeed, execDuration, h, remaining);
        }

        this.drawPlayer(player);
        this.drawPhaseHUD(phase, phaseTimer, phaseDuration, h, w);
        this.drawScore(score, w);
        this.drawActionIndicator(player, w);
        this.drawSpeedIndicator(speed, w, h);
        this.drawPreviewMap(player, obstacles, w, h);
    }

    /** 画面右側にステージ先読みプレビュー */
    private drawPreviewMap(player: Player, obstacles: ObstacleManager, w: number, h: number) {
        const { ctx, roadLeft, laneWidth } = this;
        const laneCount = settings.laneCount;

        // プレビューのサイズと位置
        const previewW = Math.min(80, (w - this.roadRight) * 0.7);
        const previewH = h * 0.82; // 画面下部付近まで伸ばす
        const previewX = this.roadRight + (w - this.roadRight - previewW) / 2;
        const previewY = h * 0.08;

        if (previewW < 30) return; // スペースがない場合は描画しない

        // 背景パネル
        ctx.save();
        ctx.globalAlpha = 0.85;
        const panelGrad = ctx.createLinearGradient(previewX, previewY, previewX, previewY + previewH);
        panelGrad.addColorStop(0, 'rgba(30, 50, 45, 0.9)');
        panelGrad.addColorStop(1, 'rgba(20, 35, 32, 0.9)');
        ctx.fillStyle = panelGrad;
        ctx.beginPath();
        ctx.roundRect(previewX - 2, previewY - 2, previewW + 4, previewH + 4, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 160, 140, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // タイトル
        ctx.fillStyle = 'rgba(196, 164, 106, 0.6)';
        ctx.font = `600 9px 'Shippori Mincho', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('先読', previewX + previewW / 2, previewY - 5);

        // クリップ領域
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(previewX, previewY, previewW, previewH, 4);
        ctx.clip();

        // ミニ道路背景
        const miniRoadGrad = ctx.createLinearGradient(previewX, previewY, previewX + previewW, previewY);
        miniRoadGrad.addColorStop(0, 'rgba(120, 80, 40, 0.5)');
        miniRoadGrad.addColorStop(0.1, 'rgba(160, 110, 60, 0.4)');
        miniRoadGrad.addColorStop(0.9, 'rgba(160, 110, 60, 0.4)');
        miniRoadGrad.addColorStop(1, 'rgba(120, 80, 40, 0.5)');
        ctx.fillStyle = miniRoadGrad;
        ctx.fillRect(previewX, previewY, previewW, previewH);

        // レーン境界線
        const miniLaneW = previewW / laneCount;
        ctx.strokeStyle = 'rgba(196, 164, 106, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        for (let i = 1; i < laneCount; i++) {
            const lx = previewX + miniLaneW * i;
            ctx.beginPath();
            ctx.moveTo(lx, previewY);
            ctx.lineTo(lx, previewY + previewH);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // 障害物を描画（画面上端より上のもの）
        // 表示範囲: 現在のプレイヤー位置から上3000px先まで
        // 生成は3000px先まで行われている
        const viewRange = 3000;
        const playerScreenY = player.y; // 画面上のプレイヤー位置（0.78h付近）

        // プレビューの上端に対応するゲーム内Y座標（未来）
        // playerScreenY がプレビューの下端
        const viewTop = playerScreenY - viewRange;

        for (const obs of obstacles.obstacles) {
            if (obs.y > playerScreenY) continue; // プレイヤーより後ろは表示しない

            // プレビュー内でのY座標: 
            // obs.y = viewTop のとき normalizedY = 0 (上端)
            // obs.y = playerScreenY のとき normalizedY = 1 (下端)
            const normalizedY = (obs.y - viewTop) / (playerScreenY - viewTop);
            if (normalizedY < 0 || normalizedY > 1) continue;

            const miniY = previewY + normalizedY * previewH;
            const miniX = previewX + miniLaneW * obs.lane + (miniLaneW - miniLaneW * 0.7) / 2;
            const miniW = miniLaneW * 0.7;
            const miniH = Math.max(4, obs.height * 0.15);

            // 障害物タイプごとの色
            let obsColor: string;
            switch (obs.type) {
                case 'ground':
                    obsColor = 'rgba(100, 200, 100, 0.7)';
                    break;
                case 'overhead':
                    obsColor = 'rgba(200, 100, 255, 0.7)';
                    break;
                case 'crawl':
                    obsColor = 'rgba(240, 160, 80, 0.7)';
                    break;
                default:
                    obsColor = 'rgba(150, 100, 200, 0.7)';
            }

            ctx.fillStyle = obsColor;
            ctx.fillRect(miniX, miniY, miniW, miniH);
        }

        // プレイヤー位置マーカー（下端）
        const playerMiniX = previewX + miniLaneW * player.lane + miniLaneW / 2;
        const playerMiniY = previewY + previewH - 6;
        ctx.fillStyle = 'rgba(183, 65, 50, 0.9)';
        ctx.beginPath();
        ctx.moveTo(playerMiniX, playerMiniY - 5);
        ctx.lineTo(playerMiniX - 4, playerMiniY + 3);
        ctx.lineTo(playerMiniX + 4, playerMiniY + 3);
        ctx.closePath();
        ctx.fill();

        ctx.restore(); // clip解除
        ctx.restore(); // save解除
    }

    private drawLakeBackground(w: number, h: number, dt: number) {
        const { ctx } = this;
        const t = performance.now() / 1000;

        // 大きなうねり波 (横方向、太く明るい)
        ctx.save();
        for (let waveI = 0; waveI < 12; waveI++) {
            const baseY = (h / 13) * (waveI + 0.5);
            const waveAlpha = 0.08 + Math.sin(t * 0.4 + waveI * 0.8) * 0.04;
            ctx.strokeStyle = `rgba(100, 210, 195, ${Math.max(0.02, waveAlpha)})`;
            ctx.lineWidth = 1.5 + Math.sin(t * 0.2 + waveI) * 0.5;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 3) {
                const y = baseY
                    + Math.sin(x * 0.012 + t * 0.8 + waveI * 1.0) * 12
                    + Math.sin(x * 0.006 + t * 0.5 + waveI * 0.5) * 8
                    + Math.cos(x * 0.02 + t * 1.2 + waveI * 1.5) * 4;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();

        // コースティクス (水底に映る光の網模様)
        ctx.save();
        ctx.globalAlpha = 0.06;
        for (let i = 0; i < 8; i++) {
            const cx = (w / 2) + Math.sin(t * 0.3 + i * 1.5) * w * 0.4;
            const cy = (h / 2) + Math.cos(t * 0.25 + i * 1.8) * h * 0.4;
            const size = 60 + Math.sin(t * 0.5 + i) * 30;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
            grad.addColorStop(0, 'rgba(150, 240, 220, 0.8)');
            grad.addColorStop(0.5, 'rgba(100, 200, 180, 0.3)');
            grad.addColorStop(1, 'rgba(80, 180, 160, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // 水面の波紋 (大きく、多く、速く)
        this.rippleTimer += dt;
        if (this.rippleTimer > 0.35) {
            this.rippleTimer = 0;
            if (this.ripples.length < 25) {
                this.ripples.push({
                    x: Math.random() * w, y: Math.random() * h,
                    radius: 0, maxRadius: 40 + Math.random() * 70,
                    opacity: 0.1 + Math.random() * 0.12,
                    speed: 15 + Math.random() * 25,
                });
            }
        }

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.speed * dt;
            const life = 1 - r.radius / r.maxRadius;
            if (life <= 0) {
                this.ripples[i] = {
                    x: Math.random() * w, y: Math.random() * h,
                    radius: 0, maxRadius: 40 + Math.random() * 70,
                    opacity: 0.1 + Math.random() * 0.12,
                    speed: 15 + Math.random() * 25,
                };
                continue;
            }
            // 外側の波紋
            ctx.strokeStyle = `rgba(140, 230, 210, ${r.opacity * life})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            // 内側の波紋
            if (r.radius > 10) {
                ctx.strokeStyle = `rgba(160, 240, 220, ${r.opacity * life * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(r.x, r.y, r.radius * 0.55, r.radius * 0.25, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // 水面の光の反射帯 (大きく、明るく)
        ctx.save();
        for (let i = 0; i < 30; i++) {
            const shimX = (Math.sin(t * 0.35 + i * 1.1) * 0.5 + 0.5) * w;
            const shimY = (Math.cos(t * 0.25 + i * 1.5) * 0.5 + 0.5) * h;
            const shimAlpha = 0.05 + Math.sin(t * 1.0 + i * 0.6) * 0.04;
            ctx.fillStyle = `rgba(200, 250, 240, ${Math.max(0, shimAlpha)})`;
            ctx.beginPath();
            ctx.ellipse(shimX, shimY, 25 + Math.sin(t * 0.6 + i) * 15, 5 + Math.sin(t * 0.8 + i) * 2, Math.sin(t * 0.15 + i) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // きらめき (大きな十字の光芒 + 小さな輝点)
        for (let i = 0; i < 30; i++) {
            const sparkX = (Math.sin(t * 0.6 + i * 1.7) * 0.5 + 0.5) * w;
            const sparkY = (Math.cos(t * 0.5 + i * 1.4) * 0.5 + 0.5) * h;
            const sparkAlpha = Math.max(0, Math.sin(t * 2.0 + i * 0.9) * 0.25);
            if (sparkAlpha > 0.03) {
                // 光芒 (十字)
                ctx.strokeStyle = `rgba(255, 255, 255, ${sparkAlpha * 0.5})`;
                ctx.lineWidth = 1;
                const armLen = 4 + sparkAlpha * 12;
                ctx.beginPath(); ctx.moveTo(sparkX - armLen, sparkY); ctx.lineTo(sparkX + armLen, sparkY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(sparkX, sparkY - armLen); ctx.lineTo(sparkX, sparkY + armLen); ctx.stroke();
                // 中心の輝点
                ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha})`;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, 2 + sparkAlpha * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

    }

    private drawDistantTrees(w: number, h: number) {
        const { ctx, roadLeft, roadRight } = this;
        const horizonY = 60;

        // 左岸
        ctx.save();
        const leftGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 40);
        leftGrad.addColorStop(0, 'rgba(80, 130, 70, 0.6)');
        leftGrad.addColorStop(0.5, 'rgba(60, 110, 55, 0.5)');
        leftGrad.addColorStop(1, 'rgba(50, 90, 50, 0.0)');
        ctx.fillStyle = leftGrad;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 40);
        for (let x = 0; x <= roadLeft - 10; x += 12) {
            const treeH = 25 + Math.sin(x * 0.05) * 15 + Math.cos(x * 0.08) * 10;
            ctx.lineTo(x, horizonY - treeH);
        }
        ctx.lineTo(roadLeft - 10, horizonY + 40);
        ctx.closePath();
        ctx.fill();

        // 右岸
        const rightGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 40);
        rightGrad.addColorStop(0, 'rgba(80, 130, 70, 0.6)');
        rightGrad.addColorStop(0.5, 'rgba(60, 110, 55, 0.5)');
        rightGrad.addColorStop(1, 'rgba(50, 90, 50, 0.0)');
        ctx.fillStyle = rightGrad;
        ctx.beginPath();
        ctx.moveTo(roadRight + 10, horizonY + 40);
        for (let x = roadRight + 10; x <= w; x += 12) {
            const treeH = 20 + Math.sin(x * 0.06) * 15 + Math.cos(x * 0.04) * 10;
            ctx.lineTo(x, horizonY - treeH);
        }
        ctx.lineTo(w, horizonY + 40);
        ctx.closePath();
        ctx.fill();

        // 岸辺のライン
        ctx.strokeStyle = 'rgba(100, 160, 90, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 35);
        ctx.lineTo(roadLeft - 15, horizonY + 35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(roadRight + 15, horizonY + 35);
        ctx.lineTo(w, horizonY + 35);
        ctx.stroke();

        ctx.restore();
    }

    private drawRoad(h: number) {
        const { ctx, roadLeft, roadWidth } = this;
        const laneCount = settings.laneCount;

        // 橋の影（水面に映る）
        ctx.fillStyle = 'rgba(20, 50, 45, 0.3)';
        ctx.fillRect(roadLeft - 4, 0, roadWidth + 8, h);

        // 木製の橋本体
        const bridgeGrad = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadWidth, 0);
        bridgeGrad.addColorStop(0, '#6b3a20');
        bridgeGrad.addColorStop(0.08, '#7a4528');
        bridgeGrad.addColorStop(0.15, '#8b5030');
        bridgeGrad.addColorStop(0.5, '#9a5a35');
        bridgeGrad.addColorStop(0.85, '#8b5030');
        bridgeGrad.addColorStop(0.92, '#7a4528');
        bridgeGrad.addColorStop(1, '#6b3a20');
        ctx.fillStyle = bridgeGrad;
        ctx.fillRect(roadLeft, 0, roadWidth, h);

        // 橋の板目（横線）
        const plankSize = 40;
        const plankOffset = this.scrollOffset % plankSize;
        ctx.strokeStyle = 'rgba(50, 25, 10, 0.25)';
        ctx.lineWidth = 1;
        for (let y = -plankSize + plankOffset; y < h + plankSize; y += plankSize) {
            ctx.beginPath();
            ctx.moveTo(roadLeft + 2, y);
            ctx.lineTo(roadLeft + roadWidth - 2, y);
            ctx.stroke();
        }

        // 板目の木目テクスチャ（縦線）
        ctx.strokeStyle = 'rgba(60, 30, 15, 0.08)';
        ctx.lineWidth = 1;
        for (let x = roadLeft + 8; x < roadLeft + roadWidth; x += 14) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // 橋の端（欄干）
        ctx.fillStyle = '#5a2e18';
        ctx.fillRect(roadLeft - 4, 0, 6, h);
        ctx.fillRect(roadLeft + roadWidth - 2, 0, 6, h);

        // 欄干のハイライト
        ctx.strokeStyle = 'rgba(180, 130, 80, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(roadLeft - 1, 0); ctx.lineTo(roadLeft - 1, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(roadLeft + roadWidth + 1, 0); ctx.lineTo(roadLeft + roadWidth + 1, h); ctx.stroke();

        // 欄干の柱（一定間隔の縦棒）
        const pillarSpacing = 120;
        const pillarOffset = this.scrollOffset % pillarSpacing;
        ctx.fillStyle = '#4a2515';
        for (let y = -pillarSpacing + pillarOffset; y < h + pillarSpacing; y += pillarSpacing) {
            ctx.fillRect(roadLeft - 6, y - 3, 10, 6);
            ctx.fillRect(roadLeft + roadWidth - 4, y - 3, 10, 6);
        }

        // レーン区切り（板の隙間風）
        ctx.setLineDash([20, 30]);
        ctx.lineDashOffset = -this.scrollOffset;
        ctx.strokeStyle = 'rgba(50, 25, 10, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 1; i < laneCount; i++) {
            const x = roadLeft + this.laneWidth * i;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // 橋の板のハイライト（光の反射）
        ctx.fillStyle = 'rgba(200, 160, 100, 0.04)';
        for (let y = -plankSize + plankOffset; y < h + plankSize; y += plankSize * 2) {
            ctx.fillRect(roadLeft + 2, y, roadWidth - 4, plankSize * 0.6);
        }
    }

    private drawPlayer(player: Player) {
        const { ctx } = this;
        const cx = player.x;
        const cy = player.displayY;
        const action = player.action;
        const size = player.width * 0.6;

        ctx.save();

        if (action === 'jump') {
            ctx.shadowColor = 'rgba(106, 159, 212, 0.5)';
            ctx.shadowBlur = 28;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(cx, player.y + 10, size * 0.7, size * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            const t = performance.now() / 1000;
            ctx.strokeStyle = 'rgba(106, 159, 212, 0.3)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const angle = t * 2 + i * (Math.PI * 2 / 3);
                const rx = cx + Math.cos(angle) * (size + 8);
                const ry = cy + Math.sin(angle) * (size * 0.5 + 4);
                ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(106, 159, 212, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, size + 12, 0, Math.PI * 2); ctx.stroke();
            const grad = ctx.createRadialGradient(cx, cy - 3, 2, cx, cy, size);
            grad.addColorStop(0, '#8ec5e8');
            grad.addColorStop(0.5, '#4a8ab5');
            grad.addColorStop(1, '#2a5070');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(220, 240, 255, 0.8)';
            ctx.font = `bold ${size * 0.75}px 'Shippori Mincho', serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('跳', cx, cy + 1);
        } else if (action === 'crouch') {
            ctx.shadowColor = 'rgba(180, 140, 60, 0.4)';
            ctx.shadowBlur = 16;
            ctx.strokeStyle = 'rgba(180, 140, 60, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 6, size + 10, (size + 10) * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            const grad = ctx.createRadialGradient(cx, cy + 4, 2, cx, cy + 4, size);
            grad.addColorStop(0, '#d4a86a');
            grad.addColorStop(0.5, '#a07830');
            grad.addColorStop(1, '#6b4f1f');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 6, size, size * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(240, 220, 180, 0.8)';
            ctx.font = `bold ${size * 0.55}px 'Shippori Mincho', serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('伏', cx, cy + 7);
        } else if (action === 'pushup') {
            // 腕立て伏せ状態
            ctx.shadowColor = 'rgba(220, 120, 50, 0.4)';
            ctx.shadowBlur = 16;
            ctx.strokeStyle = 'rgba(220, 120, 50, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 8, size + 14, (size + 14) * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
            const grad = ctx.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, size);
            grad.addColorStop(0, '#e89040');
            grad.addColorStop(0.5, '#c06020');
            grad.addColorStop(1, '#804010');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 8, size * 1.2, size * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 220, 180, 0.8)';
            ctx.font = `bold ${size * 0.45}px 'Shippori Mincho', serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('腕', cx, cy + 9);
        } else {
            ctx.shadowColor = 'rgba(183, 65, 50, 0.4)';
            ctx.shadowBlur = 24;
            ctx.strokeStyle = 'rgba(183, 65, 50, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, size + 12, 0, Math.PI * 2); ctx.stroke();
            const t = performance.now() / 1000;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * 0.5);
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.strokeStyle = 'rgba(196, 164, 106, 0.2)';
                ctx.beginPath(); ctx.moveTo(size + 4, 0); ctx.lineTo(size + 10, 0); ctx.stroke();
            }
            ctx.restore();
            const grad = ctx.createRadialGradient(cx, cy - 3, 2, cx, cy, size);
            grad.addColorStop(0, '#d4836a');
            grad.addColorStop(0.5, '#b74132');
            grad.addColorStop(1, '#6b2a1f');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(196, 164, 106, 0.7)';
            ctx.font = `bold ${size * 0.8}px 'Shippori Mincho', serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('呪', cx, cy + 1);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    private drawObstacles(obstacles: ObstacleManager) {
        const { ctx, roadLeft, laneWidth } = this;

        for (const obs of obstacles.obstacles) {
            const ox = roadLeft + laneWidth * obs.lane + (laneWidth - obs.width) / 2;
            let oy = obs.y;

            ctx.save();

            if (obs.type === 'ground') {
                ctx.shadowColor = 'rgba(60, 140, 60, 0.4)';
                ctx.shadowBlur = 8;
                const grad = ctx.createLinearGradient(ox, oy, ox, oy + obs.height);
                grad.addColorStop(0, '#1a3020');
                grad.addColorStop(0.5, '#2a4a30');
                grad.addColorStop(1, '#1a3020');
                ctx.fillStyle = grad;
                this.drawRoundRect(ctx, ox, oy + obs.height * 0.3, obs.width, obs.height * 0.7, 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(100, 200, 100, 0.35)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = 'rgba(100, 200, 100, 0.4)';
                const spikeCount = 5;
                for (let s = 0; s < spikeCount; s++) {
                    const sx = ox + (obs.width / (spikeCount + 1)) * (s + 1);
                    const sBaseY = oy + obs.height * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(sx - 3, sBaseY);
                    ctx.lineTo(sx, sBaseY - 8);
                    ctx.lineTo(sx + 3, sBaseY);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(140, 220, 140, 0.7)';
                ctx.font = `bold 14px 'Shippori Mincho', serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('茨', ox + obs.width / 2, oy + obs.height * 0.65);
            } else if (obs.type === 'overhead') {
                oy = obs.y - 20;
                ctx.shadowColor = 'rgba(180, 60, 180, 0.4)';
                ctx.shadowBlur = 10;
                const grad = ctx.createLinearGradient(ox, oy, ox, oy + obs.height);
                grad.addColorStop(0, '#3a1540');
                grad.addColorStop(0.5, '#4d2060');
                grad.addColorStop(1, '#3a1540');
                ctx.fillStyle = grad;
                this.drawRoundRect(ctx, ox, oy, obs.width, obs.height * 0.6, 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(200, 100, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(200, 100, 255, 0.2)';
                ctx.setLineDash([4, 4]);
                const hangCount = 4;
                for (let hh = 0; hh < hangCount; hh++) {
                    const hx = ox + (obs.width / (hangCount + 1)) * (hh + 1);
                    ctx.beginPath();
                    ctx.moveTo(hx, oy + obs.height * 0.6);
                    ctx.lineTo(hx, oy + obs.height + 5);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(220, 160, 255, 0.7)';
                ctx.font = `bold 14px 'Shippori Mincho', serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('天', ox + obs.width / 2, oy + obs.height * 0.3);
            } else if (obs.type === 'crawl') {
                this.drawCrawlObstacle(ctx, ox, oy, obs);
            } else {
                ctx.shadowColor = 'rgba(80, 40, 120, 0.4)';
                ctx.shadowBlur = 10;
                const grad = ctx.createLinearGradient(ox, oy, ox, oy + obs.height);
                grad.addColorStop(0, '#2a1540');
                grad.addColorStop(0.5, '#3d1f5c');
                grad.addColorStop(1, '#2a1540');
                ctx.fillStyle = grad;
                this.drawRoundRect(ctx, ox, oy, obs.width, obs.height, 3);
                ctx.fill();
                ctx.strokeStyle = 'rgba(150, 100, 200, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(200, 160, 255, 0.7)';
                ctx.font = `bold 18px 'Shippori Mincho', serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('封', ox + obs.width / 2, oy + obs.height / 2);
            }

            ctx.restore();
        }
    }

    // crawl障害物の描画を追加
    private drawCrawlObstacle(ctx: CanvasRenderingContext2D, ox: number, oy: number, obs: any) {
        ctx.shadowColor = 'rgba(220, 120, 50, 0.4)';
        ctx.shadowBlur = 8;
        const grad = ctx.createLinearGradient(ox, oy, ox, oy + obs.height);
        grad.addColorStop(0, '#804010');
        grad.addColorStop(0.5, '#a06020');
        grad.addColorStop(1, '#804010');
        ctx.fillStyle = grad;
        this.drawRoundRect(ctx, ox, oy + obs.height * 0.4, obs.width, obs.height * 0.6, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240, 160, 80, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // 波線装飾
        ctx.strokeStyle = 'rgba(240, 160, 80, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = ox + 4; x < ox + obs.width - 4; x += 6) {
            const sy = oy + obs.height * 0.5 + Math.sin(x * 0.3) * 3;
            if (x === ox + 4) ctx.moveTo(x, sy);
            else ctx.lineTo(x, sy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 200, 140, 0.7)';
        ctx.font = `bold 14px 'Shippori Mincho', serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('匍', ox + obs.width / 2, oy + obs.height * 0.7);
    }

    private drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /** RESERVE中に全レーンにゴースト表示。現在レーンは濃く表示 */
    private drawGhostPlayer(player: Player) {
        const { ctx, roadLeft, laneWidth } = this;
        const laneCount = settings.laneCount;
        const size = player.width * 0.6;
        const cy = player.y;

        ctx.save();

        for (let lane = 0; lane < laneCount; lane++) {
            const cx = player.getLaneX(lane, roadLeft, laneWidth);
            const isCurrentLane = lane === player.lane;
            const alpha = isCurrentLane ? 0.35 : 0.1;

            ctx.fillStyle = `rgba(183, 65, 50, ${alpha})`;
            ctx.beginPath();
            ctx.arc(cx, cy, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(183, 65, 50, ${alpha * 0.8})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, size + 8, 0, Math.PI * 2);
            ctx.stroke();

            if (isCurrentLane) {
                ctx.fillStyle = `rgba(196, 164, 106, ${alpha * 1.5})`;
                ctx.font = `bold ${size * 0.7}px 'Shippori Mincho', serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('呪', cx, cy + 1);

                if (player.action === 'jump') {
                    ctx.fillStyle = 'rgba(106, 159, 212, 0.5)';
                    ctx.font = `bold ${size * 0.5}px 'Shippori Mincho', serif`;
                    ctx.fillText('跳', cx, cy - size - 10);
                } else if (player.action === 'crouch') {
                    ctx.fillStyle = 'rgba(180, 140, 60, 0.5)';
                    ctx.font = `bold ${size * 0.5}px 'Shippori Mincho', serif`;
                    ctx.fillText('伏', cx, cy - size - 10);
                } else if (player.action === 'pushup') {
                    ctx.fillStyle = 'rgba(220, 120, 50, 0.5)';
                    ctx.font = `bold ${size * 0.5}px 'Shippori Mincho', serif`;
                    ctx.fillText('腕', cx, cy - size - 10);
                }
            }
        }

        ctx.restore();
    }

    /** RESERVE/EXECUTE中に予約時間分の移動距離をゾーン表示 */
    private drawTravelZone(player: Player, speed: number, phaseDuration: number, canvasH: number, progress: number) {
        const { ctx, roadLeft, roadWidth } = this;

        // 表示上の到達線位置（画面上部に制限）
        const minTop = 20;
        const maxZoneHeight = player.y - minTop;
        const travelPixels = speed * phaseDuration * progress;
        // 実際の距離が画面に収まらない場合はスケーリング
        const displayHeight = Math.min(travelPixels, maxZoneHeight);
        const zoneTop = player.y - displayHeight;
        const isExecute = progress < 1.0;

        ctx.save();

        // 半透明の移動範囲ゾーン（到達線〜プレイヤー間）
        const r = isExecute ? '60, 200, 120' : '106, 159, 212';
        const grad = ctx.createLinearGradient(0, zoneTop, 0, player.y);
        grad.addColorStop(0, `rgba(${r}, 0.15)`);
        grad.addColorStop(0.3, `rgba(${r}, 0.06)`);
        grad.addColorStop(1, `rgba(${r}, 0.0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(roadLeft + 2, zoneTop, roadWidth - 4, displayHeight);


        // 到達線（上端の破線）
        ctx.strokeStyle = `rgba(${r}, 0.7)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(roadLeft + 5, zoneTop);
        ctx.lineTo(roadLeft + roadWidth - 5, zoneTop);
        ctx.stroke();
        ctx.setLineDash([]);

        // 両端マーカー
        ctx.fillStyle = `rgba(${r}, 0.7)`;
        ctx.beginPath();
        ctx.arc(roadLeft + 8, zoneTop, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(roadLeft + roadWidth - 8, zoneTop, 3, 0, Math.PI * 2);
        ctx.fill();

        // ラベル
        ctx.font = `700 13px 'Shippori Mincho', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = `rgba(${r}, 0.8)`;
        ctx.fillText('到達線', roadLeft + roadWidth / 2, zoneTop - 6);

        ctx.restore();
    }

    private drawAfterimage(player: Player) {
        const { ctx } = this;
        const trail = player.trail;
        const len = trail.length;

        for (let i = Math.max(0, len - 15); i < len; i++) {
            const t = trail[i];
            const alpha = ((i - (len - 15)) / 15) * 0.25;

            if (t.action === 'jump') {
                ctx.fillStyle = `rgba(106, 159, 212, ${alpha})`;
            } else if (t.action === 'crouch') {
                ctx.fillStyle = `rgba(180, 140, 60, ${alpha})`;
            } else {
                ctx.fillStyle = `rgba(183, 65, 50, ${alpha})`;
            }

            ctx.beginPath();
            const rSize = t.action === 'crouch' ? player.width * 0.4 : player.width * 0.35;
            ctx.arc(t.x, player.y, rSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawPhaseHUD(phase: Phase, timer: number, duration: number, h: number, w: number) {
        const { ctx } = this;
        if (phase === 'IDLE') return;

        const phaseLabels: Record<string, { kanji: string; color: string }> = {
            READY: { kanji: '構', color: '#c4a46a' },
            RESERVE: { kanji: '予約', color: '#6a9fd4' },
            EXECUTE: { kanji: '発動', color: '#3cc878' },
            AFTERIMAGE: { kanji: '残', color: 'rgba(60, 200, 120, 0.5)' },
        };

        const info = phaseLabels[phase];
        if (!info) return;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.font = `800 36px 'Shippori Mincho', serif`;
        ctx.fillStyle = info.color;
        ctx.shadowColor = info.color;
        ctx.shadowBlur = 20;
        ctx.fillText(info.kanji, w / 2, 16);

        const remaining = Math.max(0, timer).toFixed(1);
        ctx.font = `700 16px 'Shippori Mincho', serif`;
        ctx.fillStyle = 'rgba(232, 220, 200, 0.6)';
        ctx.shadowBlur = 0;
        ctx.fillText(`${remaining}秒`, w / 2, 56);

        const barW = 160;
        const barH = 3;
        const barX = w / 2 - barW / 2;
        const barY = 78;
        const progress = duration > 0 ? Math.max(0, 1 - timer / duration) : 0;

        ctx.fillStyle = 'rgba(196, 164, 106, 0.1)';
        ctx.fillRect(barX, barY, barW, barH);

        const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
        barGrad.addColorStop(0, info.color);
        barGrad.addColorStop(1, info.color);
        ctx.fillStyle = barGrad;
        ctx.fillRect(barX, barY, barW * progress, barH);

        ctx.fillStyle = 'rgba(196, 164, 106, 0.3)';
        ctx.fillRect(barX - 1, barY - 2, 2, barH + 4);
        ctx.fillRect(barX + barW - 1, barY - 2, 2, barH + 4);

        ctx.restore();
    }

    private drawScore(score: number, w: number) {
        const { ctx } = this;
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.font = `600 11px 'Shippori Mincho', serif`;
        ctx.fillStyle = 'rgba(196, 164, 106, 0.4)';
        ctx.fillText('距離', w - 20, 16);
        ctx.font = `800 22px 'Shippori Mincho', serif`;
        ctx.fillStyle = '#c4a46a';
        ctx.shadowColor = 'rgba(196, 164, 106, 0.2)';
        ctx.shadowBlur = 10;
        ctx.fillText(`${Math.floor(score)} m`, w - 20, 30);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    private drawActionIndicator(player: Player, w: number) {
        const { ctx } = this;
        if (player.action === 'stand') return;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        if (player.action === 'jump') {
            ctx.font = `700 18px 'Shippori Mincho', serif`;
            ctx.fillStyle = 'rgba(106, 159, 212, 0.8)';
            ctx.shadowColor = 'rgba(106, 159, 212, 0.3)';
            ctx.shadowBlur = 10;
            ctx.fillText('跳躍', 20, 20);
        } else if (player.action === 'crouch') {
            ctx.font = `700 18px 'Shippori Mincho', serif`;
            ctx.fillStyle = 'rgba(180, 140, 60, 0.8)';
            ctx.shadowColor = 'rgba(180, 140, 60, 0.3)';
            ctx.shadowBlur = 10;
            ctx.fillText('伏身', 20, 20);
        } else if (player.action === 'pushup') {
            ctx.font = `700 18px 'Shippori Mincho', serif`;
            ctx.fillStyle = 'rgba(220, 120, 50, 0.8)';
            ctx.shadowColor = 'rgba(220, 120, 50, 0.3)';
            ctx.shadowBlur = 10;
            ctx.fillText('腕立', 20, 20);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    private drawSpeedIndicator(speed: number, _w: number, h: number) {
        const { ctx } = this;
        ctx.save();
        const intensity = Math.min(speed / 800, 1);
        const count = Math.floor(intensity * 8);

        for (let i = 0; i < count; i++) {
            const x = this.roadLeft - 15 - Math.random() * 30;
            const y = Math.random() * h;
            const len = 15 + intensity * 35;
            const alpha = 0.04 + intensity * 0.06;
            ctx.strokeStyle = `rgba(140, 200, 190, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y + len); ctx.stroke();
            const x2 = this.roadRight + 15 + Math.random() * 30;
            ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 + (Math.random() - 0.5) * 3, y + len); ctx.stroke();
        }
        ctx.restore();
    }
}
