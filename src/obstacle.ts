// 障害物管理
import { settings } from './settings';
import { PlayerAction } from './player';

export type ObstacleType = 'normal' | 'ground' | 'overhead';

export interface Obstacle {
    lane: number;
    y: number;
    width: number;
    height: number;
    passed: boolean;
    type: ObstacleType;
}

export class ObstacleManager {
    obstacles: Obstacle[] = [];
    private spawnTimer = 0;
    private baseInterval = 0.37;   // 密度1.5倍
    private minInterval = 0.13;

    update(dt: number, speed: number, roadLeft: number, laneWidth: number, elapsedTotal: number) {
        this.spawnTimer -= dt;

        if (this.spawnTimer <= 0) {
            this.spawn(laneWidth, elapsedTotal);
            const interval = Math.max(this.minInterval, this.baseInterval - elapsedTotal * 0.008);
            this.spawnTimer = interval;
        }

        for (const obs of this.obstacles) {
            obs.y += speed * dt;
        }

        this.obstacles = this.obstacles.filter(o => o.y < 2000);
    }

    private spawn(laneWidth: number, elapsedTotal: number) {
        const laneCount = settings.laneCount;

        // 障害物タイプを選択（ゲーム開始5秒後からground/overhead出現）
        let type: ObstacleType = 'normal';
        if (elapsedTotal > 5) {
            const roll = Math.random();
            if (roll < 0.30) {
                type = 'ground';
            } else if (roll < 0.60) {
                type = 'overhead';
            }
        }

        if (type === 'ground' || type === 'overhead') {
            // ジャンプ/しゃがみ障害物: 全レーンに配置可能
            // 70%の確率で全レーン、30%で一部レーン
            const allLanes = Math.random() < 0.7;
            if (allLanes) {
                for (let i = 0; i < laneCount; i++) {
                    this.obstacles.push({
                        lane: i,
                        y: -80,
                        width: laneWidth * 0.7,
                        height: type === 'ground' ? 30 : 35,
                        passed: false,
                        type,
                    });
                }
            } else {
                const count = Math.random() < 0.4 ? Math.min(2, laneCount - 1) : 1;
                const available = Array.from({ length: laneCount }, (_, i) => i);
                for (let i = 0; i < count; i++) {
                    const idx = Math.floor(Math.random() * available.length);
                    this.obstacles.push({
                        lane: available[idx],
                        y: -80,
                        width: laneWidth * 0.7,
                        height: type === 'ground' ? 30 : 35,
                        passed: false,
                        type,
                    });
                    available.splice(idx, 1);
                }
            }
        } else {
            // 通常障害物: 最低1レーンは空ける
            const maxObstacles = laneCount - 1;
            const count = Math.random() < 0.35 ? Math.min(2, maxObstacles) : 1;

            const lanes: number[] = [];
            const available = Array.from({ length: laneCount }, (_, i) => i);

            for (let i = 0; i < count; i++) {
                const idx = Math.floor(Math.random() * available.length);
                lanes.push(available[idx]);
                available.splice(idx, 1);
            }

            for (const lane of lanes) {
                this.obstacles.push({
                    lane,
                    y: -80,
                    width: laneWidth * 0.6,
                    height: 50,
                    passed: false,
                    type: 'normal',
                });
            }
        }
    }

    checkCollision(
        playerRect: { x: number; y: number; w: number; h: number },
        playerAction: PlayerAction,
        roadLeft: number,
        laneWidth: number
    ): boolean {
        for (const obs of this.obstacles) {
            const ox = roadLeft + laneWidth * obs.lane + (laneWidth - obs.width) / 2;
            let oy = obs.y;

            if (obs.type === 'overhead') {
                oy = obs.y - 20;
            }

            if (obs.type === 'ground' && playerAction === 'jump') {
                continue;
            }
            if (obs.type === 'overhead' && playerAction === 'crouch') {
                continue;
            }

            if (
                playerRect.x < ox + obs.width &&
                playerRect.x + playerRect.w > ox &&
                playerRect.y < oy + obs.height &&
                playerRect.y + playerRect.h > oy
            ) {
                return true;
            }
        }
        return false;
    }

    reset() {
        this.obstacles = [];
        this.spawnTimer = 0;
    }
}
