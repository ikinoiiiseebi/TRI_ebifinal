// プレイヤー管理
import { settings } from './settings';

export type PlayerAction = 'stand' | 'jump' | 'crouch' | 'pushup';

export interface PositionRecord {
    x: number;       // Canvas上のX座標
    lane: number;    // レーン番号
    action: PlayerAction; // アクション
    time: number;    // 記録時刻
}

export class Player {
    lane = 1;         // 現在レーン (0-indexed)
    action: PlayerAction = 'stand';
    x = 0;            // Canvas上のX座標 (描画時に計算)
    y = 0;            // Canvas上のY座標 (ベース位置)
    displayY = 0;     // 表示用Y座標 (ジャンプ/しゃがみ反映)
    width = 36;
    height = 48;
    trail: PositionRecord[] = [];     // 残像用の位置履歴
    maxTrailLength = 30;

    /** レーン中央のX座標を計算 */
    getLaneX(lane: number, roadLeft: number, laneWidth: number): number {
        return roadLeft + laneWidth * lane + laneWidth / 2;
    }

    /** 指定レーンに移動 */
    setLane(lane: number) {
        const max = settings.laneCount - 1;
        this.lane = Math.max(0, Math.min(max, lane));
    }

    /** アクション設定 */
    setAction(action: PlayerAction) {
        this.action = action;
    }

    /** 位置を更新し履歴に記録 */
    updatePosition(roadLeft: number, laneWidth: number, canvasHeight: number, time: number) {
        this.x = this.getLaneX(this.lane, roadLeft, laneWidth);
        this.y = canvasHeight * 0.78;

        // ジャンプ・しゃがみ・腕立てによる表示Y座標の変更
        if (this.action === 'jump') {
            this.displayY = this.y - 30; // 上方向にオフセット
        } else if (this.action === 'crouch') {
            this.displayY = this.y + 10; // 下方向にオフセット
        } else if (this.action === 'pushup') {
            this.displayY = this.y + 20; // 地面に近い位置
        } else {
            this.displayY = this.y;
        }

        this.trail.push({ x: this.x, lane: this.lane, action: this.action, time });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
    }

    /** 矩形取得 (当たり判定用) */
    getRect() {
        if (this.action === 'jump') {
            // ジャンプ中は上方に浮いている扱い
            return {
                x: this.x - this.width / 2,
                y: this.displayY - this.height / 2,
                w: this.width,
                h: this.height * 0.6,
            };
        } else if (this.action === 'crouch') {
            // しゃがみ中は背が低い扱い
            return {
                x: this.x - this.width / 2,
                y: this.y,
                w: this.width,
                h: this.height * 0.4,
            };
        } else if (this.action === 'pushup') {
            // 腕立て伏せ中は非常に低い
            return {
                x: this.x - this.width * 0.75,
                y: this.y + 10,
                w: this.width * 1.5,
                h: this.height * 0.2,
            };
        }
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            w: this.width,
            h: this.height,
        };
    }

    /** 描画サイズ取得 */
    getDisplaySize(): { w: number; h: number } {
        if (this.action === 'crouch') {
            return { w: this.width * 1.2, h: this.height * 0.5 };
        } else if (this.action === 'pushup') {
            return { w: this.width * 1.5, h: this.height * 0.3 };
        }
        return { w: this.width, h: this.height };
    }

    reset() {
        this.lane = settings.laneCount === 3 ? 1 : 0;
        this.action = 'stand';
        this.trail = [];
    }
}
