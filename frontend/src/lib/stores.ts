import { writable } from 'svelte/store';

// 計算されたルート情報を保持するストア
export const routeStore = writable<any>(null);

// クリックされた地点の道路プロファイル情報を保持するストア
export const roadProfileStore = writable<any>(null);
