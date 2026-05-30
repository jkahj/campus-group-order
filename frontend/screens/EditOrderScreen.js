import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, SafeAreaView, Animated, Modal
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function EditOrderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { order } = route.params;

  const [form, setForm] = useState({
    name: '',
    location: '',
    contact: '',
    line: '',
    payment: '',
    limitTime: '',
    hours: 2,
    minutes: 0,
    note: ''
  });
  const [orderComments, setOrderComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // 動畫相關
  const deliveryAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // 初始化表單數據
  useEffect(() => {
    if (order) {
      // 計算剩餘時間（小時和分鐘）
      let remainingHours = 1;
      let remainingMinutes = 0;
      
      if (order.expiresAt) {
        const remainingMs = order.expiresAt - Date.now();
        if (remainingMs > 0) {
          remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
          remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        }
      }
      
      setForm({
        name: order.name || '',
        location: order.address || '',
        contact: order.phone || order.contact || '',
        line: order.line || '',
        payment: order.method || order.payment || '',
        limitTime: `${remainingHours}小時${remainingMinutes > 0 ? remainingMinutes + '分鐘' : ''}`,
        hours: Math.max(1, remainingHours),
        minutes: remainingMinutes,
        note: order.limit || order.note || ''
      });

      // 載入訂單的留言
      loadOrderComments();
    }
  }, [order]);

  // 載入訂單留言
  const loadOrderComments = async () => {
    try {
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderMsgs = comments[order.id] || [];
      setOrderComments(orderMsgs);
    } catch (error) {
      console.error('載入訂單留言失敗:', error);
    }
  };

  // 開始配送功能
  const handleStartDelivery = async () => {
    if (orderComments.length === 0) {
      Alert.alert('沒有留言', '此訂單目前沒有留言，無法開始配送');
      return;
    }

    // 檢查是否有已接單的留言
    const acceptedComments = orderComments.filter(comment => 
      comment.status === 'accepted' || comment.accepted === true
    );

    if (acceptedComments.length === 0) {
      Alert.alert('沒有已接單的留言', '請先確認接單後再開始配送');
      return;
    }

    Alert.alert(
      '確認開始配送',
      `確定要開始配送此訂單嗎？\n將通知 ${acceptedComments.length} 位留言者開始配送。\n\n所有參與者的訂單狀態將變更為「配送中」。`,
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '確認配送',
          style: 'destructive',
          onPress: () => startDeliveryAnimation(acceptedComments)
        }
      ]
    );
  };

  // 開始配送動畫
  const startDeliveryAnimation = async (acceptedComments) => {
    setIsDelivering(true);
    
    // 開始脈衝動畫
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    
    // 開始配送動畫
    Animated.timing(deliveryAnimation, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    pulseLoop.start();

    // 2秒後執行實際的配送邏輯
    setTimeout(() => {
      pulseLoop.stop();
      confirmStartDelivery(acceptedComments);
    }, 2000);
  };

  // 獲取狀態文字
  const getStatusText = (status) => {
    switch (status) {
      case 'preparing': return '搜集中';
      case 'delivering': return '配送中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return '搜集中';
    }
  };

  // 獲取狀態顏色
  const getStatusColor = (status) => {
    switch (status) {
      case 'preparing': return '#FF9800';
      case 'delivering': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#FF9800';
    }
  };

  // 確認開始配送
  const confirmStartDelivery = async (acceptedComments) => {
    try {
      setLoading(true);

      // 更新訂單狀態為配送中
      const stored = await AsyncStorage.getItem('orders');
      const parsed = stored ? JSON.parse(stored) : [];
      const updated = parsed.map(o => 
        o.id === order.id ? { ...o, status: 'delivering', deliveryStartedAt: Date.now() } : o
      );
      await AsyncStorage.setItem('orders', JSON.stringify(updated));

      // 發送配送通知給所有已接單的留言者
      const { sendNotificationToCommenter } = require('../utils/notificationHelper');
      
      // 批量發送通知給所有已接單的留言者
      await Promise.all(
        acceptedComments.map(comment => 
          sendNotificationToCommenter(
            comment.commenterId || comment.userId,
            'delivery',
            '代購開始配送',
            `${order.name} 已開始配送，請注意查收！`,
            {
              order_id: order.id,
              order_name: order.name,
              comment_id: comment.id || null,
            }
          ).catch(err => {
            console.error(`發送配送通知給 ${comment.commenterId} 失敗:`, err);
          })
        )
      );

      // 更新所有留言狀態為配送中（不只是已接單的）
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderMsgs = comments[order.id] || [];
      const updatedComments = orderMsgs.map(comment => {
        // 將所有有效留言（非回覆、非忽略）的狀態都設為配送中
        if (!comment.isReply && comment.status !== 'ignored') {
          return {
            ...comment,
            deliveryStatus: 'delivering',
            deliveryStartedAt: Date.now()
          };
        }
        return comment;
      });
      
      comments[order.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));

      // 重置動畫狀態
      setIsDelivering(false);
      deliveryAnimation.setValue(0);
      pulseAnimation.setValue(1);

      // 顯示成功訊息
      Alert.alert(
        '配送已開始',
        `已成功通知所有參與者開始配送！\n\n所有留言者的訂單狀態已變更為「配送中」。\n訂單將從首頁消失，請前往「訂單管理」頁面進行後續操作。`,
        [
          {
            text: '確定',
            onPress: () => {
              // 重新載入留言數據
              loadOrderComments();
            }
          }
        ]
      );
    } catch (error) {
      console.error('開始配送失敗:', error);
      Alert.alert('操作失敗', '開始配送失敗，請稍後再試');
      setIsDelivering(false);
      deliveryAnimation.setValue(0);
      pulseAnimation.setValue(1);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.location || !form.contact) {
      Alert.alert('請填寫完整資料');
      return;
    }

    const parseHours = (text) => {
      if (!text) return 1;
      const m = String(text).match(/[\d\.]+/);
      const h = m ? parseFloat(m[0]) : 1;
      return isNaN(h) ? 1 : Math.max(0.1, h);
    };

    const createdAt = Date.now();
    const totalHours = form.hours + (form.minutes / 60);
    const expiresAt = createdAt + totalHours * 3600 * 1000;

    // 取消舊的通知
    if (order.notificationIds) {
      try {
        if (order.notificationIds.preId) {
          await Notifications.cancelScheduledNotificationAsync(order.notificationIds.preId);
        }
        if (order.notificationIds.endId) {
          await Notifications.cancelScheduledNotificationAsync(order.notificationIds.endId);
        }
      } catch (e) {
        console.log('取消舊通知失敗:', e);
      }
    }

    // 暫時完全停用截止提醒通知，避免任何立即觸發問題
    const scheduleNotifications = async (order) => {
      try {
        console.log('截止提醒通知功能已暫時停用，避免立即觸發問題');
        console.log(`訂單 ${order.name} 將在 ${new Date(order.expiresAt).toLocaleString()} 截止`);
        
        // 不安排任何通知，返回 null
        return { preId: null, endId: null };
      } catch (error) {
        console.error('安排通知失敗:', error);
        return { preId: null, endId: null };
      }
    };

    const updatedOrder = {
      ...order,
      name: form.name,
      address: form.location,
      phone: form.contact,
      line: form.line,
      method: form.payment,
      limit: form.note || '',
      remaining: `訂單截止剩餘 ${form.hours}小時${form.minutes > 0 ? form.minutes + '分鐘' : ''}`,
      expiresAt
    };

    try {
      // 更新訂單
      const stored = await AsyncStorage.getItem('orders');
      const parsed = stored ? JSON.parse(stored) : [];
      const notif = await scheduleNotifications(updatedOrder);
      const updated = parsed.map(o => 
        o.id === order.id ? { ...updatedOrder, notificationIds: notif } : o
      );
      await AsyncStorage.setItem('orders', JSON.stringify(updated));

      // 發送編輯訂單通知給發起者
      try {
        const { sendNotificationToOrderCreator } = require('../utils/notificationHelper');
        await sendNotificationToOrderCreator(
          order.id,
          'edited',
          '你編輯了代購',
          form.name,
          {
            order_name: form.name,
          }
        );
      } catch (notifError) {
        console.error('發送編輯訂單通知失敗:', notifError);
      }

      // 顯示成功通知
      Alert.alert('編輯成功！', '您的代購已成功更新！', [
        {
          text: '確定',
          onPress: () => {
            // 先回到主標籤導航器，然後確保顯示首頁標籤
            navigation.navigate('Main', { screen: 'Home' });
          }
        }
      ]);
    } catch (e) {
      console.error('更新代購錯誤：', e);
      Alert.alert('更新失敗');
    }
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>無效的訂單資訊</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>返回上頁</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>編輯代購資訊</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>編輯代購資訊</Text>

        {/* 訂單狀態和配送管理 */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>訂單狀態</Text>
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              當前狀態：<Text style={[styles.statusValue, { color: getStatusColor(order.status) }]}>
                {getStatusText(order.status)}
              </Text>
            </Text>
            <Text style={styles.commentCount}>
              留言數量：{orderComments.length} 個
            </Text>
            {orderComments.length > 0 && (
              <Text style={styles.acceptedCount}>
                已接單：{orderComments.filter(c => c.status === 'accepted' || c.accepted === true).length} 個
              </Text>
            )}
          </View>
        </View>

        {/* 開始配送按鈕 */}
        {orderComments.length > 0 && (
          <View style={styles.deliverySection}>
            <Animated.View style={{
              transform: [
                { scale: pulseAnimation },
                { 
                  translateX: deliveryAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 20]
                  })
                }
              ]
            }}>
              <TouchableOpacity 
                style={[
                  styles.deliveryButton, 
                  loading && styles.disabledButton,
                  order.status === 'delivering' && styles.deliveringButton,
                  isDelivering && styles.deliveringAnimationButton
                ]} 
                onPress={handleStartDelivery}
                disabled={loading || order.status === 'delivering' || isDelivering}
              >
                <Ionicons 
                  name={isDelivering ? 'car-sport' : 
                        order.status === 'delivering' ? 'checkmark-circle' : 'car'} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.deliveryButtonText}>
                  {isDelivering ? '配送中...' :
                   loading ? '處理中...' : 
                   order.status === 'delivering' ? '配送中' : '開始配送'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            
            {isDelivering && (
              <Animated.View style={{
                opacity: deliveryAnimation.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 1, 0]
                })
              }}>
                <Text style={styles.deliveryAnimationText}>
                  🚚 正在準備配送...
                </Text>
              </Animated.View>
            )}
            
            {order.status === 'delivering' && !isDelivering && (
              <Text style={styles.deliveryNote}>
                ✓ 配送已開始，所有參與者狀態已變更為「配送中」
              </Text>
            )}
          </View>
        )}

        <Text style={styles.formTitle}>編輯資訊</Text>

      <TextInput 
        placeholder="📍商店名稱" 
        style={styles.input} 
        value={form.name}
        onChangeText={(v) => handleChange('name', v)} 
      />
      <TextInput 
        placeholder="📍代購地點" 
        style={styles.input} 
        value={form.location}
        onChangeText={(v) => handleChange('location', v)} 
      />
      <TextInput 
        placeholder="📞聯絡方式" 
        style={styles.input} 
        value={form.contact}
        onChangeText={(v) => handleChange('contact', v)} 
      />
      <TextInput 
        placeholder="💬Line ID" 
        style={styles.input} 
        value={form.line}
        onChangeText={(v) => handleChange('line', v)} 
      />
      <TextInput 
        placeholder="💰付款方式" 
        style={styles.input} 
        value={form.payment}
        onChangeText={(v) => handleChange('payment', v)} 
      />
      <TouchableOpacity 
        style={styles.timeInput} 
        onPress={() => setShowTimePicker(true)}
      >
        <Text style={styles.timeInputText}>
          ⏰時間限制：{form.hours}小時{form.minutes > 0 ? form.minutes + '分鐘' : ''}
        </Text>
        <Text style={styles.timeInputHint}>點擊設定時間</Text>
      </TouchableOpacity>
      <TextInput 
        placeholder="📝其他備註" 
        style={styles.input} 
        value={form.note}
        onChangeText={(v) => handleChange('note', v)} 
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>確認</Text>
      </TouchableOpacity>

      {/* 時間選擇器模態框 */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>設定時間限制</Text>
            
            <View style={styles.pickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>小時</Text>
                <Picker
                  selectedValue={form.hours}
                  style={styles.picker}
                  onValueChange={(value) => handleChange('hours', value)}
                >
                  {Array.from({ length: 25 }, (_, i) => (
                    <Picker.Item key={`hours-${i}`} label={`${i}小時`} value={i} />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>分鐘</Text>
                <Picker
                  selectedValue={form.minutes}
                  style={styles.picker}
                  onValueChange={(value) => handleChange('minutes', value)}
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <Picker.Item key={`minutes-${i}`} label={`${i}分鐘`} value={i} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.confirmButtonText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 24,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f90',
    marginBottom: 20
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    marginTop: 8
  },
  // 狀態區域樣式
  statusSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  statusValue: {
    fontWeight: 'bold',
  },
  commentCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  acceptedCount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  // 配送區域樣式
  deliverySection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  deliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deliveringButton: {
    backgroundColor: '#2196F3',
  },
  deliveryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  deliveryNote: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // 動畫相關樣式
  deliveringAnimationButton: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  deliveryAnimationText: {
    fontSize: 16,
    color: '#FF6B35',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  button: {
    backgroundColor: '#f90',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // 時間選擇器樣式
  timeInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    backgroundColor: '#f9f9f9'
  },
  timeInputText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4
  },
  timeInputHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 32,
    width: '90%',
    maxWidth: 400
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center'
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center'
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  picker: {
    width: 120,
    height: 150
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f3f4',
    padding: 12,
    borderRadius: 8,
    marginRight: 8
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#f90',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  }
});
