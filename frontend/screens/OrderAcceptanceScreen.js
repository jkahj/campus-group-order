import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserTier, getTierInfo, getTierColor, getOrderSuggestion } from '../utils/userTierManager';
import apiService from '../utils/apiService';
import AuthManager from '../utils/authManager';

export default function OrderAcceptanceScreen({ navigation, route }) {
  const { commentData, orderInfo } = route.params || {};
  const [commenterTier, setCommenterTier] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (commentData?.commenterId) {
      loadCommenterTier(commentData.commenterId);
    }
  }, [commentData]);

  const loadCommenterTier = async (commenterId) => {
    try {
      // 使用工具函數載入用戶信譽等級
      const userTier = await getUserTier(commenterId);
      setCommenterTier(userTier);
    } catch (error) {
      console.error('載入用戶信譽等級失敗:', error);
      setCommenterTier({ score: 0, tier: '掰咖' });
    }
  };



  const handleAcceptOrder = async () => {
    setLoading(true);
    try {
      // 更新留言者的狀態為已接單
      const saved = await AsyncStorage.getItem('comments');
      const parsed = saved ? JSON.parse(saved) : {};
      const orderComments = parsed[orderInfo.id] || [];
      
      const updatedComments = orderComments.map(comment => {
        // 只使用留言的唯一ID進行精確匹配，避免同一個用戶的多筆留言都被匹配
        // comment.id 是每個留言的唯一標識符，應該只用它來匹配
        const matchesById = comment.id === commentData.id;
        
        if (matchesById) {
          // 額外檢查：確保不是回覆，且還沒有被接單（避免重複接單）
          if (comment.isReply || comment.accepted) {
            return comment; // 不處理回覆或已經接單的留言
          }
          
          return {
            ...comment,
            accepted: true,
            acceptedAt: Date.now(),
            deliveryStatus: 'accepted' // 設置為已接單狀態
          };
        }
        return comment;
      });
      
      parsed[orderInfo.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(parsed));

      // 更新訂單的參與者資訊
      const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
      const updatedOrders = orders.map(order => {
        if (order.id === orderInfo.id) {
          // 檢查是否已經有該留言者的參與記錄（使用 commentId 或 commenterId 精確匹配）
          const existingJoiner = order.joiners?.find(
            joiner => joiner.commentId === commentData.id || 
                     joiner.id === commentData.commenterId
          );
          
          if (!existingJoiner) {
            // 如果沒有參與記錄，則添加
            const newJoiner = {
              id: commentData.commenterId,
              name: commentData.commenterName,
              phone: commentData.commenterPhone || '',
              line: commentData.commenterLine || '',
              joinTime: Date.now(),
              status: 'accepted',
              userId: commentData.commenterId, // 使用實際的留言者ID，而不是 'me'
              commentId: commentData.id,
              acceptedAt: Date.now()
            };
            
            return {
              ...order,
              joiners: [...(order.joiners || []), newJoiner],
              joined: (order.joined || 0) + 1
            };
          } else {
            // 如果已有參與記錄，只更新匹配的參與者狀態
            const updatedJoiners = order.joiners.map(joiner => 
              (joiner.commentId === commentData.id || joiner.id === commentData.commenterId)
                ? { ...joiner, status: 'accepted', acceptedAt: Date.now() }
                : joiner
            );
            
            return {
              ...order,
              joiners: updatedJoiners
            };
          }
        }
        return order;
      });
      
      await AsyncStorage.setItem('orders', JSON.stringify(updatedOrders));

      // 發送接單確認通知給留言者
      const { sendNotificationToCommenter, sendNotificationToOrderCreator } = require('../utils/notificationHelper');
      
      // 通知留言者：接單確認
      await sendNotificationToCommenter(
        commentData.commenterId,
        'orderAccepted',
        '代購接單確認',
        `您的留言「${commentData.text}」已被發起代購者確認接單！`,
        {
          order_id: orderInfo.id,
          order_name: orderInfo.name,
          comment_id: commentData.id || null,
        }
      );

      // 發送接單成功通知給發起代購者
      await sendNotificationToOrderCreator(
        orderInfo.id,
        'orderAcceptedSuccess',
        '接單成功',
        `您已成功接單：${commentData.commenterName} 的留言「${commentData.text}」`,
        {
          order_name: orderInfo.name,
          commenter_id: commentData.commenterId,
          comment_id: commentData.id || null,
        }
      );

      // 顯示成功訊息
      Alert.alert(
        '接單成功',
        '您已成功確認接單，留言者將收到通知',
        [
          {
            text: '確定',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('接單失敗:', error);
      Alert.alert('接單失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const [showIgnoreModal, setShowIgnoreModal] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState('');

  const handleIgnoreComment = async () => {
    // 顯示忽略原因輸入模態框
    setShowIgnoreModal(true);
  };

  const confirmIgnoreComment = async () => {
    if (!ignoreReason.trim()) {
      Alert.alert('請輸入忽略原因', '必須提供忽略留言的原因');
      return;
    }

    try {
      setLoading(true);
      
      // 發送忽略通知給留言者
      const inbox = JSON.parse(await AsyncStorage.getItem('inbox')) || [];
      const ignoreNotification = {
        id: `${Date.now()}_ignore_${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        type: 'commentIgnored',
        title: '留言已被忽略',
        body: `${orderInfo.name} 的留言已被忽略\n原因: ${ignoreReason}`,
        read: false,
        orderId: orderInfo.id,
        commenterId: commentData.commenterId,
        ignoreReason: ignoreReason,
        ignoredBy: 'me', // 忽略者的ID
        ignoredAt: Date.now()
      };
      
      await AsyncStorage.setItem('inbox', JSON.stringify([ignoreNotification, ...inbox]));

      // 直接刪除留言而不是標記為忽略
      const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
      const orderComments = comments[orderInfo.id] || [];
      
      // 只刪除指定的留言，保留其他留言
      const updatedComments = orderComments.filter(comment => {
        // 只根據留言ID匹配，確保只刪除單一留言
        return comment.id !== commentData.id;
      });
      
      comments[orderInfo.id] = updatedComments;
      await AsyncStorage.setItem('comments', JSON.stringify(comments));

      // 記錄到本地忽略清單，避免後續從後端同步時再次出現
      const ignored = JSON.parse(await AsyncStorage.getItem('ignoredComments')) || {};
      const ignoredList = new Set(ignored[orderInfo.id] || []);
      ignoredList.add(commentData.id);
      ignored[orderInfo.id] = Array.from(ignoredList);
      await AsyncStorage.setItem('ignoredComments', JSON.stringify(ignored));

      // 同步更新後端留言狀態（優先更新為 ignored，失敗則刪除）
      try {
        const currentUser = await AuthManager.getCurrentUser();
        const ignoredById = currentUser?.id || 'me';
        const looksValid = (v) => !!v && v !== 'me' && v.length > 3;
        const commentIdValid = looksValid(commentData.id);
        const ignoredByIdValid = looksValid(ignoredById);
        if (commentIdValid && ignoredByIdValid) {
          try {
            const updateData = {
              status: 'ignored',
              ignored_reason: ignoreReason,
              ignored_by: ignoredById,
              ignored_at: Date.now()
            };
            await apiService.updateComment(commentData.id, updateData);
          } catch (updateErr) {
            try {
              await apiService.deleteComment(commentData.id);
            } catch (deleteErr) {
              // 靜默略過
            }
          }
        }
      } catch (_) {
        // 靜默略過
      }

      // 關閉模態框並顯示成功訊息
      setShowIgnoreModal(false);
      setIgnoreReason('');
      
      Alert.alert(
        '已忽略留言',
        '留言已被刪除，留言者已收到通知',
        [
          {
            text: '確定',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('忽略留言失敗:', error);
      Alert.alert('操作失敗', '請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (!commentData || !orderInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>無效的留言詳情</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tierInfo = getTierInfo(commenterTier?.score || 0);
  const tierColor = getTierColor(commenterTier?.tier || '掰咖');

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>留言詳情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 代購資訊 */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>代購資訊</Text>
          <View style={styles.orderCard}>
            <Text style={styles.orderName}>{orderInfo.name}</Text>
            <Text style={styles.orderLocation}>📍地點：{orderInfo.location}</Text>
            <Text style={styles.orderContact}>📞電話：{orderInfo.contact}</Text>
            {orderInfo.line && <Text style={styles.orderLine}>💬Line ID：{orderInfo.line}</Text>}
            <Text style={styles.orderPayment}>💰付款方式：{orderInfo.payment}</Text>
            {orderInfo.note && <Text style={styles.orderNote}>📝備註：{orderInfo.note}</Text>}
          </View>
        </View>

        {/* 留言者資訊 */}
        <View style={styles.commenterSection}>
          <Text style={styles.sectionTitle}>留言者資訊</Text>
          <View style={styles.commenterCard}>
            <View style={styles.commenterHeader}>
              <View style={[styles.avatar, { backgroundColor: tierColor + '20' }]}>
                <FontAwesome5 name="user" size={20} color={tierColor} />
              </View>
              <View style={styles.commenterInfo}>
                <Text style={styles.commenterName}>{commentData.commenterName}</Text>
                <View style={styles.tierBadge}>
                  <FontAwesome5 
                    name={tierInfo.icon} 
                    size={12} 
                    color={tierColor} 
                  />
                  <Text style={[styles.tierText, { color: tierColor }]}>
                    {commenterTier?.tier || '掰咖'}
                  </Text>
                </View>
              </View>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>信譽積分</Text>
                <Text style={[styles.scoreValue, { color: tierColor }]}>
                  {commenterTier?.score || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 留言內容 */}
        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>留言內容</Text>
          <View style={styles.commentCard}>
            <Text style={styles.commentText}>{commentData.text}</Text>
            <Text style={styles.commentTime}>
              {new Date(commentData.timestamp || Date.now()).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* 信譽等級說明 */}
        <View style={styles.tierInfoSection}>
          <Text style={styles.sectionTitle}>信譽等級說明</Text>
          <View style={styles.tierInfoCard}>
            <View style={styles.tierRow}>
              <FontAwesome5 name={tierInfo.icon} size={16} color={tierColor} />
              <Text style={[styles.tierName, { color: tierColor }]}>{tierInfo.name}</Text>
            </View>
            <Text style={styles.tierDescription}>
              {tierInfo.name === '咖皇' && '最高等級用戶，擁有專屬代購機制和客服專員'}
              {tierInfo.name === '咖王' && '高級用戶，可設立私人團購，擁有專屬小幫手'}
              {tierInfo.name === '團咖' && '中級用戶，可申請商品團購，定期舉辦團購活動'}
              {tierInfo.name === '買咖' && '基礎用戶，可加入公開團購，發起小型團購'}
              {tierInfo.name === '掰咖' && '新用戶，可發起公開代購，查看發起代購'}
            </Text>
          </View>
        </View>

        {/* 信譽評估 */}
        <View style={styles.suggestionSection}>
          <Text style={styles.sectionTitle}>信譽評估</Text>
          <View style={styles.suggestionCard}>
            {(() => {
              const suggestion = getOrderSuggestion(commenterTier?.score || 0);
              return (
                <View style={styles.suggestionRow}>
                  <Ionicons name={suggestion.icon} size={20} color={suggestion.color} />
                  <Text style={[styles.suggestionText, { color: suggestion.color }]}>
                    {suggestion.text}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
      </ScrollView>

             {/* 底部按鈕 */}
       <View style={styles.bottomButtons}>
         <TouchableOpacity 
           style={[styles.rejectButton, loading && styles.disabledButton]} 
           onPress={handleIgnoreComment}
           disabled={loading}
         >
           <Ionicons name="close-circle" size={20} color="#F44336" />
           <Text style={styles.rejectButtonText}>忽略留言</Text>
         </TouchableOpacity>
         
         <TouchableOpacity 
           style={[styles.acceptButton, loading && styles.disabledButton]} 
           onPress={handleAcceptOrder}
           disabled={loading}
         >
           <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
           <Text style={styles.acceptButtonText}>
             {loading ? '處理中...' : '確認接單'}
           </Text>
         </TouchableOpacity>
       </View>

      {/* 忽略原因輸入模態框 */}
      <Modal
        visible={showIgnoreModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowIgnoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>輸入忽略原因</Text>
            <Text style={styles.modalSubtitle}>
              請說明為什麼要忽略此留言，留言者將收到通知
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="請輸入忽略原因..."
              placeholderTextColor="#999"
              value={ignoreReason}
              onChangeText={setIgnoreReason}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowIgnoreModal(false);
                  setIgnoreReason('');
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, !ignoreReason.trim() && styles.disabledButton]}
                onPress={confirmIgnoreComment}
                disabled={!ignoreReason.trim() || loading}
              >
                <Text style={styles.confirmButtonText}>確認忽略</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  content: {
    flex: 1,
    padding: 16,
  },
  orderSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderLine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderPayment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  commenterSection: {
    marginBottom: 20,
  },
  commenterCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commenterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commenterInfo: {
    flex: 1,
  },
  commenterName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  commentSection: {
    marginBottom: 20,
  },
  commentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commentText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  tierInfoSection: {
    marginBottom: 20,
  },
  tierInfoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tierDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  suggestionSection: {
    marginBottom: 20,
  },
  suggestionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    lineHeight: 20,
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginRight: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E8',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginLeft: 8,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
    marginLeft: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
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
  // 模態框樣式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
