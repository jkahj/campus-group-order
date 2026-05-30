import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { MAX_CONTENT_WIDTH } from '../utils/responsive';

/**
 * 共用的響應式容器
 * - 手機：左右貼齊，佔滿寬度
 * - 平板 / Web：內容置中、限制最大寬度，避免太寬導致閱讀困難
 */
export default function ResponsiveContainer({ style, children }) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
  },
});



