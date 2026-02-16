// カメラ入力（MediaPipe Pose）+ 骨格描画
import { PlayerAction } from './player';

declare const Pose: any;
declare const Camera: any;

// MediaPipe Poseの骨格接続定義
const POSE_CONNECTIONS: [number, number][] = [
    // 顔
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    // 胴体
    [11, 12], [11, 23], [12, 24], [23, 24],
    // 左腕
    [11, 13], [13, 15],
    // 右腕
    [12, 14], [14, 16],
    // 左脚
    [23, 25], [25, 27],
    // 右脚
    [24, 26], [26, 28],
];

export class CameraInput {
    private pose: any = null;
    private camera: any = null;
    private _inputX = 0;
    private _smoothedX = 0;
    private _inputY = 0;
    private _smoothedY = 0;
    private _baselineY = -1;
    private _calibrationFrames = 0;
    private _calibrationSum = 0;
    private _action: PlayerAction = 'stand';
    private _active = false;
    private videoEl: HTMLVideoElement;
    private previewVideoEl: HTMLVideoElement;
    private cameraDotEl: HTMLElement;
    private previewEl: HTMLElement;
    private skeletonCanvas: HTMLCanvasElement;
    private skeletonCtx: CanvasRenderingContext2D | null = null;

    private jumpThreshold = -0.12;  // 誤検出軽減のため厳しく
    private crouchThreshold = 0.18;

    constructor() {
        this.videoEl = document.getElementById('cameraVideo') as HTMLVideoElement;
        this.previewVideoEl = document.getElementById('previewVideo') as HTMLVideoElement;
        this.cameraDotEl = document.getElementById('cameraDot') as HTMLElement;
        this.previewEl = document.getElementById('cameraPreview') as HTMLElement;
        this.skeletonCanvas = document.getElementById('skeletonCanvas') as HTMLCanvasElement;
    }

    get inputX(): number {
        return this._smoothedX;
    }

    get action(): PlayerAction {
        return this._action;
    }

    get active(): boolean {
        return this._active;
    }

    async start(): Promise<boolean> {
        try {
            this.pose = new Pose({
                locateFile: (file: string) =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
            });

            this.pose.setOptions({
                modelComplexity: 0,
                smoothLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            this.pose.onResults((results: any) => {
                this.onPoseResults(results);
            });

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 320, height: 240 },
            });

            this.videoEl.srcObject = stream;
            this.previewVideoEl.srcObject = stream;

            this.camera = new Camera(this.videoEl, {
                onFrame: async () => {
                    if (this.pose) {
                        await this.pose.send({ image: this.videoEl });
                    }
                },
                width: 320,
                height: 240,
            });

            // 骨格Canvasの初期化
            this.skeletonCanvas.width = 320;
            this.skeletonCanvas.height = 240;
            this.skeletonCtx = this.skeletonCanvas.getContext('2d');

            this._baselineY = -1;
            this._calibrationFrames = 0;
            this._calibrationSum = 0;

            await this.camera.start();
            this._active = true;
            this.previewEl.style.display = 'block';
            return true;
        } catch (e) {
            console.warn('カメラの初期化に失敗:', e);
            this._active = false;
            return false;
        }
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
        }
        this._active = false;
        this._action = 'stand';
        this.previewEl.style.display = 'none';
        if (this.videoEl.srcObject) {
            const tracks = (this.videoEl.srcObject as MediaStream).getTracks();
            tracks.forEach((t) => t.stop());
            this.videoEl.srcObject = null;
            this.previewVideoEl.srcObject = null;
        }
    }

    private onPoseResults(results: any) {
        if (!results.poseLandmarks) {
            // ランドマークなし: 骨格クリア
            if (this.skeletonCtx) {
                this.skeletonCtx.clearRect(0, 0, 320, 240);
            }
            return;
        }

        const landmarks = results.poseLandmarks;

        // 骨格描画
        this.drawSkeleton(landmarks);

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];

        if (!leftShoulder || !rightShoulder) return;

        // --- X軸（左右）: 肩の中心 ---
        const centerX = (leftShoulder.x + rightShoulder.x) / 2;
        this._inputX = -(centerX - 0.5) * 2;
        this._smoothedX = this._smoothedX * 0.8 + this._inputX * 0.2;

        // --- アクション判定: 腰のY座標ベース ---
        if (!leftHip || !rightHip) return;

        const hipY = (leftHip.y + rightHip.y) / 2;

        // 腰のY座標で判定（0=画面上端、1=画面下端、0.5が中心目安）
        if (hipY > 1.0) {
            // 画面外下 → 腕立て伏せ
            this._action = 'pushup';
        } else if (hipY > 0.7) {
            // 腰が低い → しゃがみ
            this._action = 'crouch';
        } else if (hipY < 0.4) {
            // 腰が高い → ジャンプ
            this._action = 'jump';
        } else {
            this._action = 'stand';
        }

        // HTMLのドットは非表示にし、Canvas上で描画
        this.cameraDotEl.style.display = 'none';
    }

    /** 骨格をCanvasに描画 */
    private drawSkeleton(landmarks: any[]) {
        const ctx = this.skeletonCtx;
        if (!ctx) return;

        const w = 320;
        const h = 240;
        ctx.clearRect(0, 0, w, h);

        // 接続線を描画
        ctx.strokeStyle = this.getActionColor(0.6);
        ctx.lineWidth = 2;

        for (const [i, j] of POSE_CONNECTIONS) {
            const lm1 = landmarks[i];
            const lm2 = landmarks[j];
            if (!lm1 || !lm2) continue;
            if (lm1.visibility < 0.3 || lm2.visibility < 0.3) continue;

            ctx.beginPath();
            ctx.moveTo(lm1.x * w, lm1.y * h);
            ctx.lineTo(lm2.x * w, lm2.y * h);
            ctx.stroke();
        }

        // 関節点を描画（鼻も含め全て同じサイズ）
        const jointColor = this.getActionColor(0.9);
        const importantJoints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

        for (const idx of importantJoints) {
            const lm = landmarks[idx];
            if (!lm || lm.visibility < 0.3) continue;

            ctx.fillStyle = jointColor;
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 腰の中心に基準点マーカーを描画（検出の中心）
        const lh = landmarks[23];
        const rh = landmarks[24];
        if (lh && rh && lh.visibility > 0.3 && rh.visibility > 0.3) {
            const hipCX = ((lh.x + rh.x) / 2) * w;
            const hipCY = ((lh.y + rh.y) / 2) * h;

            // 基準線（横線）
            if (this._baselineY > 0) {
                const baselineScreenY = this._baselineY * h;
                ctx.strokeStyle = 'rgba(196, 164, 106, 0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(0, baselineScreenY);
                ctx.lineTo(w, baselineScreenY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 腰中心の大きなマーカー
            ctx.shadowColor = this.getActionColor(0.6);
            ctx.shadowBlur = 12;
            ctx.fillStyle = this.getActionColor(0.9);
            ctx.beginPath();
            ctx.arc(hipCX, hipCY, 7, 0, Math.PI * 2);
            ctx.fill();

            // 外枠
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(hipCX, hipCY, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 状態テキスト（腰の上に表示）
            ctx.font = `bold 14px 'Shippori Mincho', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.getActionColor(0.9);
            ctx.shadowColor = this.getActionColor(0.5);
            ctx.shadowBlur = 8;

            if (this._action === 'jump') {
                ctx.fillText('跳', hipCX, hipCY - 18);
            } else if (this._action === 'crouch') {
                ctx.fillText('伏', hipCX, hipCY - 18);
            } else if (this._action === 'pushup') {
                ctx.fillText('腕', hipCX, hipCY - 18);
            }
            ctx.shadowBlur = 0;
        }
    }

    /** アクションに応じた色を返す */
    private getActionColor(alpha: number): string {
        switch (this._action) {
            case 'jump':
                return `rgba(106, 159, 212, ${alpha})`;
            case 'crouch':
                return `rgba(180, 140, 60, ${alpha})`;
            case 'pushup':
                return `rgba(220, 120, 50, ${alpha})`;
            default:
                return `rgba(0, 255, 200, ${alpha})`;
        }
    }
}
