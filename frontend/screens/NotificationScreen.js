import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiService from '../utils/apiService';
import { AuthManager } from '../utils/authManager';

export default function NotificationScreen() {
  const navigation = useNavigation();
  const [inbox, setInbox] = useState([]);
  const [filterType, setFilterType] = useState('all'); // all, purchasing, payment, delivery
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const quickActionRef = useRef(false);

  const loadInbox = async () => {
    try {
      setLoading(true);
      
      // 獲取當前登入用戶 ID
      const currentUser = await AsyncStorage.getItem('currentUser');
      let userId = null;
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        userId = userData.id || null;
        setCurrentUserId(userId);
      }
      
      if (!userId || userId === 'me') {
        // 如果沒有用戶 ID，從 AsyncStorage 載入（保持兼容性）
        const saved = await AsyncStorage.getItem('inbox');
        const parsed = saved ? JSON.parse(saved) : [];
        console.log('未登入或用戶ID無效，從 AsyncStorage 載入通知:', parsed.length, '則通知');
        setInbox(parsed.sort((a, b) => (b.ts || 0) - (a.ts || 0)));
        return;
      }
      
      // 從後端 API 載入當前用戶的通知
      try {
        const response = await apiService.getNotificationsByUser(userId);
        const notifications = response.notifications || [];
        
        // 確保每則通知都對應到正確的 user_id
        const validNotifications = notifications.filter(notif => 
          notif && notif.user_id === userId
        );
        
        // 轉換資料格式以兼容現有界面（後端返回的資料格式）
        const formattedNotifications = validNotifications.map(notif => ({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          orderId: notif.order_id || null,
          commenterId: notif.commenter_id || null,
          commenterName: notif.commenter_name || null, // 保留以兼容現有代碼，即使資料庫沒有此欄位
          orderName: notif.order_name || null,
          read: notif.read === true || notif.read === 1,
          ts: notif.ts || (notif.created_at ? new Date(notif.created_at).getTime() : Date.now()),
          user_id: notif.user_id // 確保包含 user_id，用於驗證
        }));
        
        // 同步到 AsyncStorage 作為備份
        await AsyncStorage.setItem('inbox', JSON.stringify(formattedNotifications));
        
        // 按時間戳排序（最新的在前）
        const sorted = formattedNotifications.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        setInbox(sorted);
        
        console.log('從後端載入通知:', sorted.length, '則通知，用戶ID:', userId);
        console.log('通知內容:', sorted);
      } catch (error) {
        console.error('從後端載入通知失敗:', error);
        // 如果後端載入失敗，嘗試從 AsyncStorage 載入（保持兼容性）
        const saved = await AsyncStorage.getItem('inbox');
        const parsed = saved ? JSON.parse(saved) : [];
        console.log('後端載入失敗，從 AsyncStorage 載入通知:', parsed.length, '則通知');
        setInbox(parsed.sort((a, b) => (b.ts || 0) - (a.ts || 0)));
      }
    } catch (error) {
      console.error('載入通知失敗:', error);
      // 發生錯誤時，嘗試從 AsyncStorage 載入（保持兼容性）
      const saved = await AsyncStorage.getItem('inbox');
      const parsed = saved ? JSON.parse(saved) : [];
      setInbox(parsed.sort((a, b) => (b.ts || 0) - (a.ts || 0)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
    
    // 添加定時器，每5秒重新載入一次通知
    const interval = setInterval(() => {
      console.log('定時重新載入通知...');
      loadInbox();
    }, 5000);
    
    // 清理定時器
    return () => clearInterval(interval);
  }, []);

  // 添加 focus 事件監聽，當頁面獲得焦點時重新載入
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('通知頁面獲得焦點，重新載入通知');
      loadInbox();
      
      // 通知父組件更新未讀數量
      if (navigation.getParent()) {
        navigation.getParent().setParams({ updateUnreadCount: true });
      }
    });

    return unsubscribe;
  }, [navigation]);



  const markAllRead = async () => {
    try {
      // 更新本地狀態
      const updated = inbox.map(n => ({ ...n, read: true }));
      setInbox(updated);
      await AsyncStorage.setItem('inbox', JSON.stringify(updated));
      
      // 如果有用戶 ID，同步到後端
      if (currentUserId && currentUserId !== 'me') {
        const unreadNotifications = inbox.filter(n => !n.read);
        // 批量標記已讀
        await Promise.all(
          unreadNotifications.map(notif => 
            apiService.markNotificationRead(currentUserId, notif.id).catch(err => {
              console.error(`標記通知 ${notif.id} 已讀失敗:`, err);
              // 靜默處理錯誤，不影響用戶體驗
            })
          )
        );
        console.log('已同步所有通知的已讀狀態到後端');
      }
    } catch (error) {
      console.error('標記全部已讀失敗:', error);
      // 即使後端同步失敗，本地狀態已更新
    }
  };

  const clearAll = async () => {
    console.log('清空按鈕被點擊');
    
    const performClear = async () => {
      try {
        console.log('確認清空被點擊');
        
        // 如果有用戶 ID，先刪除後端的所有通知
        if (currentUserId && currentUserId !== 'me') {
          const notificationsToDelete = inbox.filter(n => n.id);
          // 批量刪除後端通知（非阻塞）
          Promise.all(
            notificationsToDelete.map(notif => 
              apiService.deleteNotification(notif.id).catch(err => {
                console.error(`刪除通知 ${notif.id} 失敗:`, err);
                // 靜默處理錯誤，不影響用戶體驗
              })
            )
          ).then(() => {
            console.log('已同步清空所有通知到後端');
          });
        }
        
        // 更新本地狀態
        setInbox([]);
        await AsyncStorage.setItem('inbox', JSON.stringify([]));
        console.log('清空完成');
      } catch (error) {
        console.error('清空失敗:', error);
        Alert.alert('清空失敗', '請稍後再試');
      }
    };
    
    if (Platform.OS === 'web') {
      // 網頁版使用 confirm 對話框
      if (window.confirm('確定要清空所有通知嗎？')) {
        await performClear();
      }
    } else {
      // 移動版使用 Alert
      Alert.alert('清空通知', '確定要清空所有通知嗎？', [
        { text: '取消' },
        { 
          text: '清空', 
          style: 'destructive', 
          onPress: performClear
        }
      ]);
    }
  };

  const markOneRead = async (id) => {
    try {
      // 更新本地狀態
      const updated = inbox.map(n => n.id === id ? { ...n, read: true } : n);
      setInbox(updated);
      await AsyncStorage.setItem('inbox', JSON.stringify(updated));
      
      // 如果有用戶 ID，同步到後端
      if (currentUserId && currentUserId !== 'me') {
        try {
          await apiService.markNotificationRead(currentUserId, id);
          console.log(`已同步通知 ${id} 的已讀狀態到後端`);
        } catch (error) {
          console.error(`標記通知 ${id} 已讀失敗:`, error);
          // 靜默處理錯誤，不影響用戶體驗
        }
      }
    } catch (error) {
      console.error('標記通知已讀失敗:', error);
      // 即使後端同步失敗，本地狀態已更新
    }
  };

  const deleteNotification = async (id) => {
    const performDelete = async () => {
      try {
        // 更新本地狀態
        const updated = inbox.filter(n => n.id !== id);
        setInbox(updated);
        await AsyncStorage.setItem('inbox', JSON.stringify(updated));
        console.log('通知已刪除:', id);
        
        // 如果有用戶 ID，同步到後端
        if (currentUserId && currentUserId !== 'me') {
          try {
            await apiService.deleteNotification(id);
            console.log(`已同步刪除通知 ${id} 到後端`);
          } catch (error) {
            console.error(`刪除通知 ${id} 失敗:`, error);
            // 靜默處理錯誤，不影響用戶體驗
          }
        }
      } catch (error) {
        console.error('刪除通知失敗:', error);
        Alert.alert('刪除失敗', '請稍後再試');
      }
    };
    
    if (Platform.OS === 'web') {
      // 網頁版使用 confirm 對話框
      if (window.confirm('確定要刪除這則通知嗎？')) {
        await performDelete();
      }
    } else {
      // 移動版使用 Alert
      Alert.alert('刪除通知', '確定要刪除這則通知嗎？', [
        { text: '取消' },
        { 
          text: '刪除', 
          style: 'destructive', 
          onPress: performDelete
        }
      ]);
    }
  };

  const getFilteredInbox = () => {
    if (filterType === 'all') return inbox;
    if (filterType === 'purchasing') return inbox.filter(n => ['created', 'liked', 'comment', 'reply', 'deleted', 'expired', 'deadline_warning', 'joined', 'joinResponse', 'orderAccepted', 'orderAcceptedSuccess', 'newRating'].includes(n.type));
    if (filterType === 'payment') return inbox.filter(n => ['payment', 'refund'].includes(n.type));
    if (filterType === 'delivery') return inbox.filter(n => ['delivery', 'arrived', 'shipping'].includes(n.type));
    return inbox;
  };

  const renderIcon = (type) => {
    if (type === 'created') return <Ionicons name="add-circle-outline" size={20} color="#1a73e8" />;
    if (type === 'liked') return <Ionicons name="heart-outline" size={20} color="#e53935" />;
    if (type === 'comment') return <Ionicons name="chatbubble-outline" size={20} color="#007BFF" />;
    if (type === 'reply') return <Ionicons name="chatbubbles-outline" size={20} color="#FF6B35" />;
    if (type === 'deleted') return <MaterialIcons name="delete-outline" size={20} color="#333" />;
    if (type === 'expired') return <Ionicons name="timer-outline" size={20} color="#ff6f00" />;
    if (type === 'deadline_warning') return <Ionicons name="warning-outline" size={20} color="#ff4444" />;
    if (type === 'payment') return <Ionicons name="card-outline" size={20} color="#4caf50" />;
    if (type === 'refund') return <Ionicons name="arrow-back-circle-outline" size={20} color="#ff9800" />;
    if (type === 'delivery') return <Ionicons name="car-outline" size={20} color="#2196f3" />;
    if (type === 'arrived') return <Ionicons name="checkmark-circle-outline" size={20} color="#4caf50" />;
    if (type === 'shipping') return <Ionicons name="bicycle-outline" size={20} color="#ff9800" />;
    if (type === 'joined') return <Ionicons name="person-add-outline" size={20} color="#9c27b0" />;
    if (type === 'joinResponse') return <Ionicons name="checkmark-done-outline" size={20} color="#4caf50" />;
    if (type === 'commenterContacted') return <Ionicons name="chatbubble-ellipses" size={20} color="#4caf50" />;
    if (type === 'commentIgnored') return <Ionicons name="close-circle" size={20} color="#f44336" />;
    if (type === 'orderAccepted') return <Ionicons name="checkmark-circle" size={20} color="#4caf50" />;
    if (type === 'orderAcceptedSuccess') return <Ionicons name="checkmark-done" size={20} color="#4caf50" />;
    if (type === 'orderCompleted') return <Ionicons name="checkmark-done-circle" size={20} color="#4caf50" />;
    if (type === 'newRating') return <Ionicons name="star" size={20} color="#FFD700" />;
    return <Ionicons name="notifications-outline" size={20} color="#666" />;
  };

  // 處理通知點擊（留言者評價代購者）
  const navigateToOrderRating = async (item) => {
    try {
      // 優先從後端 API 獲取訂單資料
      let order = null;
      try {
        if (item.orderId) {
          const backendOrder = await apiService.getOrder(item.orderId);
          if (backendOrder) {
            order = backendOrder;
          }
        }
      } catch (apiError) {
        console.log('從後端獲取訂單失敗，嘗試從本地獲取:', apiError?.message || apiError);
      }

      // 如果後端沒有，嘗試從本地獲取
      if (!order) {
        const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
        order = orders.find(o => o.id === item.orderId);
      }

      if (!order) {
        Alert.alert('找不到訂單', '該訂單可能已被刪除');
        return;
      }

      // 嘗試獲取留言信息（用於識別當前用戶的留言）
      let commentMatch = null;
      try {
        const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
        const orderComments = comments[item.orderId] || [];
        
        // 優先使用 comment_id，然後使用 commenter_id 匹配
        if (item.commentId) {
          commentMatch = orderComments.find(comment =>
            comment.id === item.commentId ||
            comment.originalCommentId === item.commentId
          );
        }
        
        // 如果沒有找到，嘗試使用 commenter_id 匹配
        if (!commentMatch && item.commenterId) {
          commentMatch = orderComments.find(comment =>
            comment.commenterId === item.commenterId ||
            comment.id === item.commenterId
          );
        }

        // 如果還是沒有找到，嘗試使用當前用戶 ID 匹配
        if (!commentMatch) {
          try {
            const currentUser = await AuthManager.getCurrentUser();
            const currentUserId = currentUser?.id;
            if (currentUserId) {
              commentMatch = orderComments.find(comment =>
                comment.commenterId === currentUserId ||
                comment.id === currentUserId
              );
            }
          } catch (userError) {
            console.log('獲取當前用戶 ID 失敗:', userError);
          }
        }
      } catch (commentError) {
        console.log('獲取留言信息失敗:', commentError);
      }

      // 構建 commenterInfo（用於 OrderRatingScreen）
      // 注意：對於留言者評價代購者的情況，commenterInfo 代表當前用戶（留言者）的信息
      const commenterInfo = commentMatch ? {
        commenterId: commentMatch.commenterId || commentMatch.id,
        commenterName: commentMatch.commenterName || commentMatch.user || item.commenterName || '留言者',
        name: commentMatch.commenterName || commentMatch.user || item.commenterName || '留言者',
        id: commentMatch.id,
        originalCommentId: commentMatch.originalCommentId || commentMatch.id,
      } : {
        commenterId: item.commenterId || 'me',
        commenterName: item.commenterName || '我',
        name: item.commenterName || '我',
        id: item.commentId || item.commenterId || 'me',
        originalCommentId: item.commentId || item.commenterId || 'me',
      };

      // 導航到評價頁面（留言者評價代購者）
      // isFromPurchaser: false 表示留言者評價代購者
      navigation.navigate('OrderRating', {
        orderInfo: order,
        commenterInfo,
        isFromPurchaser: false, // 留言者評價代購者
      });
    } catch (error) {
      console.error('跳轉評價頁失敗:', error);
      Alert.alert('操作失敗', '無法打開評價頁面');
    }
  };

  const handleNotificationPress = async (item, options = {}) => {
    const { skipDefault } = options;

    if (quickActionRef.current) {
      quickActionRef.current = false;
      if (!skipDefault) {
        return;
      }
    }

    // 標記為已讀
    await markOneRead(item.id);
    
    // 如果是留言或回覆通知，跳轉到訂單管理畫面
    if ((item.type === 'comment' || item.type === 'reply') && item.orderId) {
      try {
        // 獲取訂單資料
        const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
        const order = orders.find(o => o.id === item.orderId);
        
        if (order) {
          // 跳轉到訂單管理畫面
          navigation.navigate('OrderManagement', {
            order: order,
            orderId: order.id
          });
        } else {
          Alert.alert('找不到訂單', '該訂單可能已被刪除');
        }
      } catch (error) {
        console.error('跳轉訂單管理失敗:', error);
        Alert.alert('操作失敗', '無法打開訂單管理畫面');
      }
    }

    // 訂單完成通知：導向評價頁面（留言者評價代購者）
    if ((item.type === 'orderCompleted' || item.type === 'arrival') && item.orderId) {
      await navigateToOrderRating(item);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.row, !item.read && styles.unreadRow]}>
      <TouchableOpacity 
        style={styles.notificationContent} 
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconWrap}>{renderIcon(item.type)}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          {!!item.body && <Text style={styles.body}>{item.body}</Text>}
          <Text style={styles.time}>{new Date(item.ts || Date.now()).toLocaleString()}</Text>
          {(item.type === 'orderCompleted' || item.type === 'arrival') && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.rateButton}
                onPress={async () => {
                  quickActionRef.current = true;
                  await handleNotificationPress(item, { skipDefault: true });
                  await navigateToOrderRating(item);
                }}
              >
                <Ionicons name="star" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.rateButtonText}>前往評價</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
      
      {Platform.OS === 'web' ? (
        <button
          style={{
            padding: '8px 12px',
            marginLeft: 8,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 4
          }}
          onClick={(e) => {
            e.preventDefault();
            console.log('網頁版刪除按鈕點擊:', item.id);
            deleteNotification(item.id);
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#ffebee';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff4444" />
        </button>
      ) : (
        <TouchableOpacity 
          style={styles.deleteBtn} 
          onPress={() => {
            console.log('移動版刪除按鈕點擊:', item.id);
            deleteNotification(item.id);
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>通知</Text>
        <View style={{ flexDirection: 'row' }}>
          {Platform.OS === 'web' ? (
            <button
              style={{
                backgroundColor: '#f1f3f4',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                marginRight: 8
              }}
              onClick={(e) => {
                e.preventDefault();
                console.log('網頁版全部已讀按鈕點擊');
                markAllRead();
              }}
            >
              <Text style={styles.smallBtnText}>全部已讀</Text>
            </button>
          ) : (
            <TouchableOpacity 
              style={styles.smallBtn} 
              onPress={markAllRead}
            >
              <Text style={styles.smallBtnText}>全部已讀</Text>
            </TouchableOpacity>
          )}
          
          {Platform.OS === 'web' ? (
            <button
              style={{
                backgroundColor: '#f1f3f4',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.preventDefault();
                console.log('網頁版清空按鈕點擊');
                clearAll();
              }}
            >
              <Text style={styles.smallBtnText}>清空</Text>
            </button>
          ) : (
            <TouchableOpacity 
              style={[styles.smallBtn, { marginLeft: 8 }]} 
              onPress={clearAll}
            >
              <Text style={styles.smallBtnText}>清空</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>



      {/* 分類篩選 */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: '全部' },
          { key: 'purchasing', label: '代購' },
          { key: 'payment', label: '付款' },
          { key: 'delivery', label: '配送' }
        ].map((filter, index) => {
          if (Platform.OS === 'web') {
            return (
              <button
                key={`filter-${filter.key}-${index}`}
                style={{
                  flex: 1,
                  backgroundColor: filterType === filter.key ? '#ff6b35' : '#f1f3f4',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  marginRight: index < 3 ? 8 : 0
                }}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('網頁版篩選按鈕點擊:', filter.key);
                  setFilterType(filter.key);
                }}
              >
                <Text style={[
                  styles.filterText, 
                  filterType === filter.key && styles.filterTextActive
                ]}>
                  {filter.label}
                </Text>
              </button>
            );
          } else {
            return (
              <TouchableOpacity
                key={`filter-${filter.key}-${index}`}
                style={[styles.filterBtn, filterType === filter.key && styles.filterBtnActive]}
                onPress={() => setFilterType(filter.key)}
              >
                <Text style={[styles.filterText, filterType === filter.key && styles.filterTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          }
        })}
      </View>

      <FlatList
        data={getFilteredInbox()}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>目前沒有通知</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshing={loading}
        onRefresh={loadInbox}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  smallBtn: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  smallBtnText: {
    color: '#333',
    fontWeight: '600'
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8
  },
  filterBtn: {
    flex: 1,
    backgroundColor: '#f1f3f4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center'
  },
  filterBtnActive: {
    backgroundColor: '#ff6b35'
  },
  filterText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14
  },
  filterTextActive: {
    color: '#fff'
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    alignItems: 'center'
  },
  unreadRow: {
    backgroundColor: '#fafcff'
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
    paddingTop: 2
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333'
  },
  body: {
    fontSize: 13,
    color: '#555',
    marginTop: 2
  },
  time: {
    fontSize: 12,
    color: '#888',
    marginTop: 4
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: '#1a73e8',
    borderRadius: 999,
    marginLeft: 8,
    marginTop: 6
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
    borderRadius: 4,
    backgroundColor: 'transparent'
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ff6b35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

});


