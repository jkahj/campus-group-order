import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../utils/apiService';
import AuthManager from '../utils/authManager';
import apiConfig from '../config/apiConfig';

export default function ParticipatedOrderDetailScreen({ navigation, route }) {
  const { orderId, order } = route.params || {};
  const [orderData, setOrderData] = useState(order);
  const [myComment, setMyComment] = useState(null);
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 獲取當前用戶
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || null;
      setCurrentUserId(userId);

      // 從資料庫載入訂單資料
      if (!orderData && orderId) {
        try {
          const dbOrder = await apiService.getOrder(orderId);
          setOrderData(dbOrder);
        } catch (error) {
          console.warn('從資料庫載入訂單失敗，使用本地數據:', error);
        }
      }

      // 如果沒有訂單資料，從本地載入
      if (!orderData) {
        const orders = JSON.parse(await AsyncStorage.getItem('orders')) || [];
        const localOrder = orders.find(o => o.id === orderId);
        if (localOrder) {
          setOrderData(localOrder);
        }
      }

      // 從資料庫載入當前用戶的所有留言
      if (userId && orderId) {
        try {
          const comments = await apiService.getCommentsByOrder(orderId);
          // 使用 filter 找到該留言者的所有留言（排除回覆）
          const myComments = comments.filter(c => 
            (String(c.commenter_id) === String(userId) || String(c.commenterId) === String(userId)) &&
            !c.is_reply && // 排除回覆
            c.status !== 'ignored' && c.status !== 'deleted' // 排除被忽略或刪除的留言
          );
          
          if (myComments && myComments.length > 0) {
            // 使用最新的留言作為主要留言（用於顯示狀態）
            const latestComment = myComments[myComments.length - 1];
            setMyComment(latestComment);
            
            // 合併所有留言的商品項目，並統整相同商品（保留 item_price）
            const itemsMap = new Map();
            
            myComments.forEach(comment => {
              if (comment.items && Array.isArray(comment.items) && comment.items.length > 0) {
                comment.items.forEach(item => {
                  const itemName = item.item_name || item.itemName || '';
                  const quantity = parseInt(item.quantity) || 1;
                  const itemPrice = item.item_price || null;
                  
                  if (itemName) {
                    // 使用商品名稱作為鍵，如果已存在則累加數量，保留價格（使用第一個非空的價格）
                    if (itemsMap.has(itemName)) {
                      const existing = itemsMap.get(itemName);
                      itemsMap.set(itemName, {
                        item_name: itemName,
                        quantity: existing.quantity + quantity,
                        item_price: existing.item_price || itemPrice // 保留第一個非空的價格
                      });
                    } else {
                      itemsMap.set(itemName, {
                        item_name: itemName,
                        quantity: quantity,
                        item_price: itemPrice
                      });
                    }
                  }
                });
              }
            });
            
            // 如果沒有 items，嘗試從舊格式載入
            if (itemsMap.size === 0) {
              myComments.forEach(comment => {
                const itemName = comment.itemName || comment.item_name;
                const quantity = parseInt(comment.quantity) || 1;
                
                if (itemName) {
                  if (itemsMap.has(itemName)) {
                    const existing = itemsMap.get(itemName);
                    itemsMap.set(itemName, {
                      item_name: itemName,
                      quantity: existing.quantity + quantity,
                      item_price: existing.item_price || null
                    });
                  } else {
                    itemsMap.set(itemName, {
                      item_name: itemName,
                      quantity: quantity,
                      item_price: null
                    });
                  }
                }
              });
            }
            
            // 將 Map 轉換為陣列（保留 item_price）
            const allItems = Array.from(itemsMap.values());
            
            setMyItems(allItems);
          } else {
            // 如果資料庫沒有，嘗試從本地載入
            const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
            const orderComments = comments[orderId] || [];
            const localComments = orderComments.filter(c => 
              (String(c.commenterId) === String(userId) || 
               String(c.actualUserId) === String(userId)) &&
              !c.isReply && // 排除回覆
              c.status !== 'ignored' && c.status !== 'deleted' // 排除被忽略或刪除的留言
            );
            
            if (localComments && localComments.length > 0) {
              // 使用最新的留言作為主要留言
              const latestComment = localComments[localComments.length - 1];
              setMyComment(latestComment);
              
              // 合併所有留言的商品項目，並統整相同商品（保留 item_price）
              const itemsMap = new Map();
              
              localComments.forEach(comment => {
                if (comment.items && Array.isArray(comment.items) && comment.items.length > 0) {
                  comment.items.forEach(item => {
                    const itemName = item.item_name || item.itemName || '';
                    const quantity = parseInt(item.quantity) || 1;
                    const itemPrice = item.item_price || null;
                    
                    if (itemName) {
                      if (itemsMap.has(itemName)) {
                        const existing = itemsMap.get(itemName);
                        itemsMap.set(itemName, {
                          item_name: itemName,
                          quantity: existing.quantity + quantity,
                          item_price: existing.item_price || itemPrice
                        });
                      } else {
                        itemsMap.set(itemName, {
                          item_name: itemName,
                          quantity: quantity,
                          item_price: itemPrice
                        });
                      }
                    }
                  });
                } else if (comment.itemName || comment.item_name) {
                  const itemName = comment.itemName || comment.item_name;
                  const quantity = parseInt(comment.quantity) || 1;
                  
                  if (itemName) {
                    if (itemsMap.has(itemName)) {
                      const existing = itemsMap.get(itemName);
                      itemsMap.set(itemName, {
                        item_name: itemName,
                        quantity: existing.quantity + quantity,
                        item_price: existing.item_price || null
                      });
                    } else {
                      itemsMap.set(itemName, {
                        item_name: itemName,
                        quantity: quantity,
                        item_price: null
                      });
                    }
                  }
                }
              });
              
              // 將 Map 轉換為陣列（保留 item_price）
              const allItems = Array.from(itemsMap.values());
              
              setMyItems(allItems);
            }
          }
        } catch (error) {
          console.error('載入留言失敗:', error);
          // 嘗試從本地載入
          const comments = JSON.parse(await AsyncStorage.getItem('comments')) || {};
          const orderComments = comments[orderId] || [];
          const localComments = orderComments.filter(c => 
            (String(c.commenterId) === String(userId) || 
             String(c.actualUserId) === String(userId)) &&
            !c.isReply &&
            c.status !== 'ignored' && c.status !== 'deleted'
          );
          
          if (localComments && localComments.length > 0) {
            const latestComment = localComments[localComments.length - 1];
            setMyComment(latestComment);
            
            // 合併所有留言的商品項目，並統整相同商品（保留 item_price）
            const itemsMap = new Map();
            
            localComments.forEach(comment => {
              if (comment.items && Array.isArray(comment.items) && comment.items.length > 0) {
                comment.items.forEach(item => {
                  const itemName = item.item_name || item.itemName || '';
                  const quantity = parseInt(item.quantity) || 1;
                  const itemPrice = item.item_price || null;
                  
                  if (itemName) {
                    if (itemsMap.has(itemName)) {
                      const existing = itemsMap.get(itemName);
                      itemsMap.set(itemName, {
                        item_name: itemName,
                        quantity: existing.quantity + quantity,
                        item_price: existing.item_price || itemPrice
                      });
                    } else {
                      itemsMap.set(itemName, {
                        item_name: itemName,
                        quantity: quantity,
                        item_price: itemPrice
                      });
                    }
                  }
                });
              } else if (comment.itemName || comment.item_name) {
                const itemName = comment.itemName || comment.item_name;
                const quantity = parseInt(comment.quantity) || 1;
                
                if (itemName) {
                  if (itemsMap.has(itemName)) {
                    const existing = itemsMap.get(itemName);
                    itemsMap.set(itemName, {
                      item_name: itemName,
                      quantity: existing.quantity + quantity,
                      item_price: existing.item_price || null
                    });
                  } else {
                    itemsMap.set(itemName, {
                      item_name: itemName,
                      quantity: quantity,
                      item_price: null
                    });
                  }
                }
              }
            });
            
            // 將 Map 轉換為陣列（保留 item_price）
            const allItems = Array.from(itemsMap.values());
            
            setMyItems(allItems);
          }
        }
      }
    } catch (error) {
      console.error('載入資料失敗:', error);
      Alert.alert('錯誤', '載入訂單資料失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>找不到訂單資料</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>返回</Text>
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
        <Text style={styles.headerTitle}>訂單詳情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 訂單基本資訊 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>訂單資訊</Text>
          <View style={styles.card}>
            <Text style={styles.orderName}>{orderData.name}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={16} color="#666" />
              <Text style={styles.infoText}>{orderData.address || orderData.location}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={16} color="#666" />
              <Text style={styles.infoText}>{orderData.phone || orderData.contact}</Text>
            </View>
            {orderData.line && (
              <View style={styles.infoRow}>
                <Ionicons name="chatbubble" size={16} color="#666" />
                <Text style={styles.infoText}>LINE: {orderData.line}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Ionicons name="card" size={16} color="#666" />
              <Text style={styles.infoText}>付款方式: {orderData.method || orderData.payment}</Text>
            </View>
          </View>
        </View>

        {/* 我的商品清單 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>我的商品清單</Text>
          <View style={styles.card}>
            {myItems.length > 0 ? (
              <View style={styles.itemsList}>
                {myItems.map((item, index) => {
                  const quantity = parseInt(item.quantity) || 1;
                  const itemPrice = item.item_price || null;
                  const subtotal = itemPrice ? itemPrice * quantity : null;
                  
                  return (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.item_name || item.itemName}</Text>
                        <View style={styles.quantityContainer}>
                          <Text style={styles.itemQuantity}>x {quantity}</Text>
                        </View>
                      </View>
                      {/* 顯示商品金額（如果發起人已填寫） */}
                      {itemPrice !== null && (
                        <View style={styles.itemPriceInfo}>
                          <Text style={styles.itemPriceLabel}>單價：</Text>
                          <Text style={styles.itemPriceValue}>${itemPrice}</Text>
                          {subtotal !== null && (
                            <Text style={styles.itemSubtotal}>
                              小計：${subtotal}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
                {/* 顯示總商品數量和總金額 */}
                <View style={styles.totalContainer}>
                  {(() => {
                    const totalQuantity = myItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
                    const totalAmount = myItems.reduce((sum, item) => {
                      const quantity = parseInt(item.quantity) || 1;
                      const itemPrice = item.item_price || 0;
                      return sum + (itemPrice * quantity);
                    }, 0);
                    const hasPrices = myItems.some(item => item.item_price !== null && item.item_price !== undefined);
                    
                    return (
                      <>
                        <Text style={styles.totalText}>
                          共 {myItems.length} 種商品，總數量: {totalQuantity}
                        </Text>
                        {hasPrices && totalAmount > 0 && (
                          <Text style={styles.totalAmountText}>
                            總金額：${totalAmount}
                          </Text>
                        )}
                      </>
                    );
                  })()}
                </View>
              </View>
            ) : myComment ? (
              <Text style={styles.emptyText}>此留言沒有商品資訊</Text>
            ) : (
              <Text style={styles.emptyText}>尚未找到您的留言記錄</Text>
            )}
          </View>
        </View>

        {/* 發起者提供的商品明細 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>代購者提供的商品明細</Text>
          <View style={styles.card}>
            {orderData.detail_image || orderData.detailImage ? (
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>明細照片：</Text>
                <TouchableOpacity
                  onPress={() => {
                    const uri = orderData.detail_image || orderData.detailImage;
                    if (!uri) {
                      Alert.alert('錯誤', '圖片路徑無效');
                      return;
                    }
                    // 處理相對路徑，如果是相對路徑則加上 baseURL
                    let fullUri = uri;
                    if (!uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('file://') && !uri.startsWith('data:')) {
                      // 相對路徑，加上 baseURL
                      fullUri = `${apiConfig.baseURL}${uri.startsWith('/') ? uri : '/' + uri}`;
                    }
                    console.log('打開全屏圖片，URI:', fullUri);
                    setImageUri(fullUri);
                    setImageError(false);
                    setImageLoading(true);
                    setShowImageModal(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: orderData.detail_image || orderData.detailImage }}
                    style={styles.detailImage}
                    resizeMode="contain"
                    onError={(error) => {
                      console.warn('縮圖載入失敗:', error);
                    }}
                  />
                  <View style={styles.viewImageButton}>
                    <Text style={styles.viewImageText}>點擊查看大圖</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.emptyText}>代購者尚未上傳明細照片</Text>
            )}
          </View>
        </View>

        {/* 訂單狀態 */}
        {myComment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>訂單狀態</Text>
            <View style={styles.card}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>接單狀態：</Text>
                <Text style={[
                  styles.statusValue,
                  myComment.accepted ? styles.statusAccepted : styles.statusPending
                ]}>
                  {myComment.accepted ? '已接單' : '待接單'}
                </Text>
              </View>
              {myComment.delivery_status && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>配送狀態：</Text>
                  <Text style={styles.statusValue}>
                    {myComment.delivery_status === 'pending' && '待處理'}
                    {myComment.delivery_status === 'accepted' && '已接單'}
                    {myComment.delivery_status === 'delivering' && '配送中'}
                    {myComment.delivery_status === 'completed' && '已完成'}
                    {myComment.delivery_status === 'rejected' && '已拒絕'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 全屏圖片 Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          setImageUri(null);
          setImageError(false);
          setImageLoading(false);
        }}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => {
              setShowImageModal(false);
              setImageUri(null);
              setImageError(false);
              setImageLoading(false);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.imageModalCloseButtonInner}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {imageLoading && !imageError && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.imageLoadingText}>載入圖片中...</Text>
            </View>
          )}
          
          {imageError && (
            <View style={styles.imageErrorContainer}>
              <Ionicons name="alert-circle" size={64} color="#fff" />
              <Text style={styles.imageErrorText}>圖片載入失敗</Text>
              <Text style={styles.imageErrorSubtext}>請檢查網路連線或圖片路徑</Text>
            </View>
          )}
          
          {imageUri && !imageError && (
            <Image
              source={{ uri: imageUri }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              onLoadStart={() => {
                setImageLoading(true);
                setImageError(false);
              }}
              onLoadEnd={() => {
                setImageLoading(false);
              }}
              onError={(error) => {
                console.error('全屏圖片載入失敗:', error);
                setImageLoading(false);
                setImageError(true);
              }}
            />
          )}
          
          {/* 點擊背景關閉 Modal */}
          <TouchableOpacity
            style={styles.imageModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowImageModal(false);
              setImageUri(null);
              setImageError(false);
              setImageLoading(false);
            }}
          />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  card: {
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
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  itemsList: {
    marginTop: 8,
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  quantityContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007BFF',
  },
  totalContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  totalAmountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007BFF',
    textAlign: 'center',
    marginTop: 8,
  },
  itemPriceInfo: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemPriceLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 4,
  },
  itemPriceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 12,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007BFF',
  },
  priceSection: {
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 8,
  },
  imageSection: {
    marginTop: 16,
  },
  imageLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  detailImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  viewImageButton: {
    marginTop: 8,
    padding: 8,
    alignItems: 'center',
  },
  viewImageText: {
    fontSize: 14,
    color: '#007BFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusAccepted: {
    color: '#4CAF50',
  },
  statusPending: {
    color: '#FF9800',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
  },
  imageModalCloseButtonInner: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    zIndex: 1,
  },
  imageLoadingContainer: {
    position: 'absolute',
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  imageErrorContainer: {
    position: 'absolute',
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  imageErrorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  imageErrorSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

