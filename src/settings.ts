// 設定の状態管理
export interface GameSettings {
    laneCount: 2 | 3;
    reserveTime: 3 | 5;
    cameraEnabled: boolean;
    mode: 'normal' | 'realtime';
}

export const settings: GameSettings = {
    laneCount: 3,
    reserveTime: 3,
    cameraEnabled: false,
    mode: 'normal',
};

export function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    settings[key] = value;
}
