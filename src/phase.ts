// フェーズ管理
import { settings } from './settings';

export type Phase = 'IDLE' | 'READY' | 'RESERVE' | 'EXECUTE' | 'REALTIME';

export class PhaseManager {
    phase: Phase = 'IDLE';
    timer = 0;        // 現在のフェーズの残り時間 (秒)
    elapsed = 0;      // 現在のフェーズで経過した時間 (秒)
    duration = 0;     // 現在のフェーズの全体時間 (秒)

    private onPhaseChange?: (phase: Phase) => void;

    constructor(onPhaseChange?: (phase: Phase) => void) {
        this.onPhaseChange = onPhaseChange;
    }

    start() {
        if (settings.mode === 'realtime') {
            this.setPhase('REALTIME');
        } else {
            this.setPhase('READY');
        }
    }

    reset() {
        this.phase = 'IDLE';
        this.timer = 0;
        this.elapsed = 0;
        this.duration = 0;
    }

    update(dt: number) {
        if (this.phase === 'IDLE' || this.phase === 'REALTIME') return;

        this.timer -= dt;
        this.elapsed += dt;

        if (this.timer <= 0) {
            this.advance();
        }
    }

    private advance() {
        switch (this.phase) {
            case 'READY':
                this.setPhase('RESERVE');
                break;
            case 'RESERVE':
                this.setPhase('EXECUTE');
                break;
            case 'EXECUTE':
                this.setPhase('RESERVE');
                break;
        }
    }

    private setPhase(phase: Phase) {
        this.phase = phase;
        this.elapsed = 0;
        switch (phase) {
            case 'READY':
                this.duration = 1;
                break;
            case 'RESERVE':
                this.duration = settings.reserveTime;
                break;
            case 'EXECUTE':
                this.duration = 0.5;
                break;
            case 'REALTIME':
                this.duration = 0;
                break;

            default:
                this.duration = 0;
        }
        this.timer = this.duration;
        this.onPhaseChange?.(phase);
    }

    /** フェーズの進行率 0~1 */
    get progress(): number {
        if (this.duration === 0) return 0;
        return Math.min(1, this.elapsed / this.duration);
    }
}
