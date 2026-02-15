// 入力管理（カメラ＋キーボードフォールバック）
import { settings } from './settings';
import { CameraInput } from './camera';
import { PlayerAction } from './player';

export class InputManager {
    private cameraInput: CameraInput;
    private keyboardLane = 1;
    private _currentLane = 1;
    private _currentAction: PlayerAction = 'stand';

    // キー状態
    private keysDown = new Set<string>();

    // アクションホールド（1秒間継続）
    private actionHoldTimer = 0;
    private actionHoldType: PlayerAction = 'stand';
    private readonly actionHoldDuration = 1.0;

    constructor() {
        this.cameraInput = new CameraInput();
        this.setupKeyboard();
    }

    get currentLane(): number {
        return this._currentLane;
    }

    get currentAction(): PlayerAction {
        return this._currentAction;
    }

    private setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            this.keysDown.add(e.key);

            if (e.key === 'ArrowLeft') {
                this.keyboardLane = Math.max(0, this.keyboardLane - 1);
            } else if (e.key === 'ArrowRight') {
                this.keyboardLane = Math.min(settings.laneCount - 1, this.keyboardLane + 1);
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keysDown.delete(e.key);
        });
    }

    async enableCamera(): Promise<boolean> {
        return await this.cameraInput.start();
    }

    disableCamera() {
        this.cameraInput.stop();
    }

    get isCameraActive(): boolean {
        return this.cameraInput.active;
    }

    /** 毎フレーム呼ぶ。現在の入力からレーンとアクションを更新 */
    update(dt: number = 1 / 60) {
        let rawAction: PlayerAction = 'stand';

        if (settings.cameraEnabled && this.cameraInput.active) {
            this._currentLane = this.cameraToLane(this.cameraInput.inputX);
            if (this.keysDown.has('ArrowUp') || this.keysDown.has(' ')) {
                rawAction = 'jump';
            } else if (this.keysDown.has('ArrowDown')) {
                rawAction = 'crouch';
            } else {
                rawAction = this.cameraInput.action;
            }
        } else {
            this._currentLane = this.keyboardLane;
            if (this.keysDown.has('ArrowUp') || this.keysDown.has(' ')) {
                rawAction = 'jump';
            } else if (this.keysDown.has('ArrowDown')) {
                rawAction = 'crouch';
            } else {
                rawAction = 'stand';
            }
        }

        // アクションホールド処理: ジャンプ/しゃがみ入力で1秒間継続
        if (rawAction === 'jump' || rawAction === 'crouch') {
            this.actionHoldTimer = this.actionHoldDuration;
            this.actionHoldType = rawAction;
        }

        if (this.actionHoldTimer > 0) {
            this.actionHoldTimer -= dt;
            this._currentAction = this.actionHoldType;
        } else {
            this._currentAction = rawAction;
        }
    }

    private cameraToLane(inputX: number): number {
        if (settings.laneCount === 3) {
            if (inputX < -0.33) return 0;
            if (inputX > 0.33) return 2;
            return 1;
        } else {
            return inputX < 0 ? 0 : 1;
        }
    }

    resetKeyboardLane() {
        this.keyboardLane = settings.laneCount === 3 ? 1 : 0;
        this._currentLane = this.keyboardLane;
        this._currentAction = 'stand';
        this.actionHoldTimer = 0;
        this.actionHoldType = 'stand';
        this.keysDown.clear();
    }
}
