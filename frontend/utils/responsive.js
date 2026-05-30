import { Dimensions, Platform } from 'react-native';

// 取得螢幕尺寸
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 設定設計稿的基準寬度（以手機 375px 為基準）
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// 依螢幕寬度計算百分比寬度
export const wp = (percentage) => {
  const value = (percentage * SCREEN_WIDTH) / 100;
  return Math.round(value);
};

// 依螢幕高度計算百分比高度
export const hp = (percentage) => {
  const value = (percentage * SCREEN_HEIGHT) / 100;
  return Math.round(value);
};

// 字體大小自動縮放
export const normalizeFont = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  // Web 上不用太小，手機上略微調整
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Math.round(newSize);
  }
  return Math.round(newSize * 0.95);
};

// 統一的頁面最大寬度（Web / 平板時不會太寬）
export const MAX_CONTENT_WIDTH = 900;



