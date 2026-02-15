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
    private petals: { x: number; y: number; size: number; rotation: number; speed: number; drift: number; opacity: number }[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.calcLayout();
        this.initPetals();
    }

    private initPetals() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (let i = 0; i < 20; i++) {
            this.petals.push({
                x: Math.random() * w, y: Math.random() * h,
                size: 3 + Math.random() * 5, rotation: Math.random() * Math.PI * 2,
                speed: 15 + Math.random() * 25, drift: (Math.random() - 0.5) * 20,
                opacity: 0.15 + Math.random() * 0.25,
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

        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#0a0812');
        bgGrad.addColorStop(0.5, '#120e18');
        bgGrad.addColorStop(1, '#0a0812');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        this.updatePetals(dt, w, h);
        this.scrollOffset = (this.scrollOffset + speed * dt) % 80;

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
    }

    private updatePetals(dt: number, w: number, h: number) {
        const { ctx } = this;
        for (const p of this.petals) {
            p.y += p.speed * dt;
            p.x += p.drift * dt;
            p.rotation += dt * 1.5;
            if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = `rgba(220, 150, 160, ${p.opacity})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    private drawRoad(h: number) {
        const { ctx, roadLeft, roadWidth } = this;
        const laneCount = settings.laneCount;

        const roadGrad = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadWidth, 0);
        roadGrad.addColorStop(0, '#1e1a28');
        roadGrad.addColorStop(0.15, '#221e2e');
        roadGrad.addColorStop(0.5, '#252133');
        roadGrad.addColorStop(0.85, '#221e2e');
        roadGrad.addColorStop(1, '#1e1a28');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(roadLeft, 0, roadWidth, h);

        ctx.strokeStyle = 'rgba(196, 164, 106, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.roadRight, 0); ctx.lineTo(this.roadRight, h); ctx.stroke();

        ctx.shadowColor = 'rgba(196, 164, 106, 0.15)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(196, 164, 106, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(roadLeft - 2, 0); ctx.lineTo(roadLeft - 2, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.roadRight + 2, 0); ctx.lineTo(this.roadRight + 2, h); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.setLineDash([20, 30]);
        ctx.lineDashOffset = -this.scrollOffset;
        ctx.strokeStyle = 'rgba(196, 164, 106, 0.12)';
        ctx.lineWidth = 1;
        for (let i = 1; i < laneCount; i++) {
            const x = roadLeft + this.laneWidth * i;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        ctx.strokeStyle = 'rgba(196, 164, 106, 0.04)';
        ctx.lineWidth = 1;
        const tileSize = 80;
        const offset = this.scrollOffset % tileSize;
        for (let y = -tileSize + offset; y < h + tileSize; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(roadLeft + 10, y);
            ctx.lineTo(this.roadRight - 10, y);
            ctx.stroke();
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

        // 半透明の移動範囲ゾーン
        const r = isExecute ? '183, 65, 50' : '106, 159, 212';
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
            EXECUTE: { kanji: '発動', color: '#b74132' },
            AFTERIMAGE: { kanji: '残', color: 'rgba(183, 65, 50, 0.5)' },
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
            const alpha = 0.03 + intensity * 0.04;
            ctx.strokeStyle = `rgba(196, 164, 106, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y + len); ctx.stroke();
            const x2 = this.roadRight + 15 + Math.random() * 30;
            ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 + (Math.random() - 0.5) * 3, y + len); ctx.stroke();
        }
        ctx.restore();
    }
}
