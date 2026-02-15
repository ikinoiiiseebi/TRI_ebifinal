// 予約バッファ管理
import { PlayerAction } from './player';

export interface ReservationEntry {
    time: number;     // 予約フェーズ開始からの経過時間（秒）
    lane: number;     // そのときのレーン
    action: PlayerAction; // そのときのアクション
}

export class ReservationBuffer {
    entries: ReservationEntry[] = [];
    private recordInterval = 0.1;
    private lastRecordTime = 0;

    clear() {
        this.entries = [];
        this.lastRecordTime = 0;
    }

    /** RESERVE中に呼ぶ。100msごとに現在のレーンとアクションを記録 */
    record(elapsed: number, currentLane: number, currentAction: PlayerAction) {
        if (elapsed - this.lastRecordTime >= this.recordInterval || this.entries.length === 0) {
            this.entries.push({ time: elapsed, lane: currentLane, action: currentAction });
            this.lastRecordTime = elapsed;
        }
    }

    /** EXECUTE中に呼ぶ。progress(0~1)に対応するレーンを返す */
    getLaneAtProgress(progress: number): number {
        if (this.entries.length === 0) return 1;
        if (this.entries.length === 1) return this.entries[0].lane;

        const totalTime = this.entries[this.entries.length - 1].time;
        if (totalTime === 0) return this.entries[0].lane;

        const targetTime = progress * totalTime;

        for (let i = 0; i < this.entries.length - 1; i++) {
            if (targetTime >= this.entries[i].time && targetTime <= this.entries[i + 1].time) {
                return this.entries[i + 1].lane;
            }
        }

        return this.entries[this.entries.length - 1].lane;
    }

    /** EXECUTE中に呼ぶ。progress(0~1)に対応するアクションを返す */
    getActionAtProgress(progress: number): PlayerAction {
        if (this.entries.length === 0) return 'stand';
        if (this.entries.length === 1) return this.entries[0].action;

        const totalTime = this.entries[this.entries.length - 1].time;
        if (totalTime === 0) return this.entries[0].action;

        const targetTime = progress * totalTime;

        for (let i = 0; i < this.entries.length - 1; i++) {
            if (targetTime >= this.entries[i].time && targetTime <= this.entries[i + 1].time) {
                return this.entries[i + 1].action;
            }
        }

        return this.entries[this.entries.length - 1].action;
    }

    /** 予約ラインの描画用データ */
    getTrajectory(): ReservationEntry[] {
        return [...this.entries];
    }
}
