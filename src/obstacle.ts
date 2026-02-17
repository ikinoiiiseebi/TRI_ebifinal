// 障害物管理
import { settings } from './settings';
import { PlayerAction } from './player';

export type ObstacleType = 'normal' | 'ground' | 'overhead' | 'crawl';

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
    private lastSpawnY = -80;
    private baseInterval = 0.8;   // 密度設定 (初期時間間隔: 広げた)
    private minInterval = 0.3;    // 最小時間間隔

    update(dt: number, speed: number, roadLeft: number, laneWidth: number, elapsedTotal: number) {
        // 既存の障害物を移動
        for (const obs of this.obstacles) {
            obs.y += speed * dt;
        }

        // 最終生成位置も移動（画面に対して手前に来る）
        this.lastSpawnY += speed * dt;

        // 先読み生成: 現在位置から3000px先まで埋める
        // 画面上端(0)より先はマイナス座標
        const lookAheadDistance = 3000;
        const generationLimit = -lookAheadDistance;

        while (this.lastSpawnY > generationLimit) {
            // 次の生成位置を決定
            // 時間ベースの間隔ロジックを距離に変換
            let intervalTime = Math.max(this.minInterval, this.baseInterval - elapsedTotal * 0.008);
            if (settings.mode === 'realtime') {
                intervalTime *= 2;
            }
            const intervalDist = speed * intervalTime;

            // 奥（マイナス方向）へ移動して配置
            this.lastSpawnY -= intervalDist;
            this.spawn(laneWidth, elapsedTotal, this.lastSpawnY);
        }

        this.obstacles = this.obstacles.filter(o => o.y < 2000);
    }

    private spawn(laneWidth: number, elapsedTotal: number, startY: number) {
        const laneCount = settings.laneCount;

        // 障害物タイプを選択（ゲーム開始0.5秒後からground/overhead出現）
        let type: ObstacleType = 'normal';
        if (elapsedTotal > 0.5) {
            const roll = Math.random();
            if (elapsedTotal > 1.0 && roll < 0.15) {
                type = 'crawl';
            } else if (roll < 0.35) {
                type = 'ground';
            } else if (roll < 0.60) {
                type = 'overhead';
            }
        }

        if (type === 'ground' || type === 'overhead' || type === 'crawl') {
            // ジャンプ/しゃがみ/腕立て障害物: 全レーンに配置可能
            // 70%の確率で全レーン、30%で一部レーン
            const allLanes = type === 'crawl' ? true : Math.random() < 0.7;
            if (allLanes) {
                for (let i = 0; i < laneCount; i++) {
                    this.obstacles.push({
                        lane: i,
                        y: startY,
                        width: laneWidth * 0.7,
                        height: type === 'ground' ? 30 : type === 'crawl' ? 25 : 35,
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
                        y: startY,
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
                    y: startY,
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
            if (obs.type === 'crawl' && playerAction === 'pushup') {
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
        this.lastSpawnY = -80;
    }
}
