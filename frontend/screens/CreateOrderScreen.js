import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import addressSearchService from '../utils/addressSearchService';
import AuthManager from '../utils/authManager';
import ApiService from '../utils/apiService';

export default function CreateOrderScreen() {
  const navigation = useNavigation();

  const [form, setForm] = useState({
    name: '',
    location: '',
    contact: '',
    line: '',
    payment: [],
    limitTime: '',
    hours: 2,
    minutes: 0,
    note: ''
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressSearchResults, setAddressSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 防抖動計時器
  const searchTimeoutRef = useRef(null);
  
  // 付款方式選項
  const paymentOptions = [
    { label: '貨到付款', value: 'cash_on_delivery' },
    { label: '轉帳', value: 'bank_transfer' },
    { label: 'Line Pay', value: 'line_pay' }
  ];

  // 清空表單的函數
  const clearForm = () => {
    setForm({
      name: '',
      location: '',
      contact: '',
      line: '',
      payment: [],
      limitTime: '',
      hours: 2,
      minutes: 0,
      note: ''
    });
  };

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
    
    // 當商店名稱或代購地點改變時，觸發地址搜尋
    if (key === 'name' || key === 'location') {
      triggerAddressSearch();
    }
  };

  // 觸發地址搜尋（防抖動）
  const triggerAddressSearch = () => {
    // 清除之前的計時器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 設定新的計時器，500ms 後執行搜尋
    searchTimeoutRef.current = setTimeout(() => {
      performAddressSearch();
    }, 500);
  };

  // 執行地址搜尋
  const performAddressSearch = async () => {
    const { name: storeName, location } = form;
    
    // 如果商店名稱或地點為空，不執行搜尋
    if (!storeName || !location) {
      setAddressSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await addressSearchService.search(storeName, location);
      setAddressSearchResults(results);
      
      // 如果有搜尋結果，自動顯示地址選擇器
      if (results.length > 0) {
        setShowAddressPicker(true);
      }
    } catch (error) {
      console.error('地址搜尋失敗:', error);
      setAddressSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 選擇地址
  const selectAddress = (address) => {
    setForm({ ...form, location: address.address });
    setShowAddressPicker(false);
  };

  // 處理付款方式複選
  const handlePaymentChange = (value) => {
    const currentPayments = form.payment;
    const isSelected = currentPayments.includes(value);
    
    if (isSelected) {
      // 如果已選中，則移除
      setForm({
        ...form,
        payment: currentPayments.filter(p => p !== value)
      });
    } else {
      // 如果未選中，則添加
      setForm({
        ...form,
        payment: [...currentPayments, value]
      });
    }
  };

  // 獲取付款方式顯示文字
  const getPaymentDisplayText = () => {
    if (form.payment.length === 0) {
      return '💰付款方式';
    }
    return form.payment.map(paymentValue => {
      const option = paymentOptions.find(opt => opt.value === paymentValue);
      return option ? option.label : paymentValue;
    }).join(' / ');
  };

  const handleSubmit = async () => {
    // 獲取當前登入用戶
    const currentUser = await AuthManager.getCurrentUser();
    
    // 檢查用戶是否已登入
    if (!currentUser || !currentUser.id) {
      Alert.alert(
        '需要登入',
        '請先登入帳號才能發起代購活動',
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '前往登入', 
            onPress: () => navigation.navigate('Login') 
          }
        ]
      );
      return;
    }
    
    const userId = currentUser.id;
    
    if (!form.name || !form.location || !form.contact || form.payment.length === 0) {
      Alert.alert('請填寫完整資料', '請選擇至少一種付款方式');
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

    // 將付款方式陣列轉換為以 "/" 間隔的字串
    const paymentString = form.payment.map(paymentValue => {
      const option = paymentOptions.find(opt => opt.value === paymentValue);
      return option ? option.label : paymentValue;
    }).join(' / ');

    const newOrder = {
      id: Date.now().toString(),
      name: form.name,
      address: form.location,
      phone: form.contact,
      line: form.line,
      method: paymentString,
      note: form.note || '',
      joined: 0,
      color: 'green',
      comments: 0,
      liked: false,
      like_count: 0, // 初始愛心數量為 0
      created_by: userId, // 使用當前登入用戶 ID
      createdBy: userId, // 同時記錄兩種格式以確保兼容性
      created_at: createdAt,
      createdAt: createdAt, // 同時記錄兩種格式
      expires_at: expiresAt,
      completed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      status: 'preparing' // 初始狀態：搜集中
    };
    
    console.log('創建訂單:', {
      orderName: newOrder.name,
      userId: userId,
      createdBy: newOrder.created_by
    });

    try {
      // 先嘗試調用後端 API 創建訂單
      let apiSuccess = false;
      let apiErrorDetail = null;
      
      try {
        // 確保訂單資料格式與後端 OrderCreate 模型匹配
        const orderForAPI = {
          id: newOrder.id,
          name: newOrder.name,
          address: newOrder.address,
          phone: newOrder.phone || null,
          line: newOrder.line || null,
          method: newOrder.method || null,
          note: newOrder.note || null,
          joined: newOrder.joined || 0,
          color: newOrder.color || 'green',
          comments: newOrder.comments || 0,
          liked: newOrder.liked || false,
          like_count: newOrder.like_count || 0,
          created_by: newOrder.created_by, // 使用底線格式
          created_at: newOrder.created_at, // 使用底線格式
          expires_at: newOrder.expires_at || null, // 使用底線格式
          completed_at: newOrder.completed_at || null, // 使用底線格式
          cancelled_at: newOrder.cancelled_at || null, // 使用底線格式
          cancellation_reason: newOrder.cancellation_reason || null,
          status: newOrder.status || 'preparing',
        };
        
        console.log('📤 發送訂單到後端 API:', {
          orderId: orderForAPI.id,
          orderName: orderForAPI.name,
          createdBy: orderForAPI.created_by,
        });
        
        const response = await ApiService.createOrder(orderForAPI);
        apiSuccess = true;
        console.log('✅ 訂單已成功創建到資料庫:', response.id);
      } catch (apiError) {
        // 記錄詳細錯誤訊息，但不中斷用戶體驗
        apiErrorDetail = {
          message: apiError?.message || String(apiError),
          status: apiError?.status,
          detail: apiError?.response?.detail || apiError?.response?.message,
        };
        
        console.error('❌ 訂單 API 調用失敗:', {
          error: apiErrorDetail.message,
          status: apiErrorDetail.status,
          detail: apiErrorDetail.detail,
          orderId: newOrder.id,
          orderName: newOrder.name,
        });
        
        // 如果是用戶不存在錯誤，提示用戶
        if (apiErrorDetail.status === 404 && apiErrorDetail.detail?.includes('發起者用戶不存在')) {
          console.warn('⚠️ 發起者用戶不存在於資料庫中，訂單將僅保存到本地');
        }
      }
      
      // 保存到本地存儲（用於顯示）
      const stored = await AsyncStorage.getItem('orders');
      const parsed = stored ? JSON.parse(stored) : [];
      
      // 去除重複訂單：檢查是否已存在相同ID的訂單
      const existingIndex = parsed.findIndex(o => o.id === newOrder.id);
      
      const notif = await scheduleNotifications(newOrder);
      const orderWithNotification = { ...newOrder, notificationIds: notif };
      
      let updated;
      if (existingIndex >= 0) {
        // 如果已存在，更新現有訂單
        updated = [...parsed];
        updated[existingIndex] = orderWithNotification;
        console.log('更新現有訂單:', newOrder.id);
      } else {
        // 如果不存在，新增訂單
        updated = [...parsed, orderWithNotification];
        console.log('新增訂單:', newOrder.id);
      }
      
      await AsyncStorage.setItem('orders', JSON.stringify(updated));
      
      // 發送創建訂單通知給發起者
      try {
        const { createNotification } = require('../utils/notificationHelper');
        const currentUser = await AuthManager.getCurrentUser();
        const currentUserId = currentUser?.id;
        if (currentUserId) {
          await createNotification({
            user_id: currentUserId,
            type: 'created',
            title: '您已發起新代購活動',
            body: form.name,
            order_id: newOrder.id,
            order_name: form.name,
          });
        }
      } catch (notifError) {
        console.error('發送創建訂單通知失敗:', notifError);
      }
      
      // 先清空表單
      clearForm();
      
      // 顯示成功通知（根據 API 調用結果顯示不同訊息）
      setTimeout(() => {
        if (apiSuccess) {
          Alert.alert('發布成功！', [
            {
              text: '確定',
              onPress: () => {
                navigation.navigate('Orders');
              }
            }
          ]);
        } else {
          // API 失敗但本地保存成功
          const errorMsg = apiErrorDetail?.detail || apiErrorDetail?.message || '未知錯誤';
          Alert.alert(
            '發布成功（僅本地）', 
            `您的代購已保存到本地，但未能同步到資料庫。\n\n錯誤：${errorMsg}\n\n請檢查網路連接或稍後再試。`,
            [
              {
                text: '確定',
                onPress: () => {
                  navigation.navigate('Orders');
                }
              }
            ]
          );
        }
      }, 100);
    } catch (e) {
      console.error('儲存代購錯誤：', e);
      Alert.alert('儲存失敗');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>發起代購</Text>

      <TextInput 
        placeholder="📍商店名稱" 
        style={styles.input} 
        value={form.name}
        onChangeText={(v) => handleChange('name', v)} 
      />
      <View style={styles.locationInputContainer}>
        <TextInput 
          placeholder="📍代購地點" 
          style={styles.input} 
          value={form.location}
          onChangeText={(v) => handleChange('location', v)} 
        />
        {isSearching && (
          <View style={styles.searchIndicator}>
            <ActivityIndicator size="small" color="#f90" />
            <Text style={styles.searchText}>搜尋中...</Text>
          </View>
        )}
        {addressSearchResults.length > 0 && !isSearching && (
          <TouchableOpacity 
            style={styles.searchResultsButton}
            onPress={() => setShowAddressPicker(true)}
          >
            <Text style={styles.searchResultsText}>
              找到 {addressSearchResults.length} 個地址，點擊選擇
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
      <TouchableOpacity 
        style={styles.input} 
        onPress={() => setShowPaymentPicker(true)}
      >
        <Text style={[styles.inputText, form.payment.length === 0 && styles.placeholderText]}>
          {getPaymentDisplayText()}
        </Text>
        <Text style={styles.pickerHint}>點擊選擇付款方式</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.timeInput} 
        onPress={() => setShowTimePicker(true)}
      >
        <Text style={styles.timeInputText}>
          ⏰訂單截止時間：{form.hours}小時{form.minutes > 0 ? form.minutes + '分鐘' : ''}
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
        <Text style={styles.buttonText}>發布</Text>
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
            <Text style={styles.modalTitle}>設定訂單截止時間</Text>
            
            <View style={styles.pickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>小時</Text>
                <Picker
                  selectedValue={form.hours}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                  onValueChange={(value) => handleChange('hours', value)}
                >
                  {Array.from({ length: 25 }, (_, i) => (
                    <Picker.Item key={`hours-${i}`} label={`${i}小時`} value={i} color="#333" />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>分鐘</Text>
                <Picker
                  selectedValue={form.minutes}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                  onValueChange={(value) => handleChange('minutes', value)}
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <Picker.Item key={`minutes-${i}`} label={`${i}分鐘`} value={i} color="#333" />
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

      {/* 付款方式選擇器模態框 */}
      <Modal
        visible={showPaymentPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>選擇付款方式</Text>
            <Text style={styles.modalSubtitle}>可複選多種付款方式</Text>
            
            {paymentOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.paymentOption,
                  form.payment.includes(option.value) && styles.paymentOptionSelected
                ]}
                onPress={() => handlePaymentChange(option.value)}
              >
                <Text style={[
                  styles.paymentOptionText,
                  form.payment.includes(option.value) && styles.paymentOptionTextSelected
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.checkbox,
                  form.payment.includes(option.value) && styles.checkboxSelected
                ]}>
                  {form.payment.includes(option.value) ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowPaymentPicker(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={() => setShowPaymentPicker(false)}
              >
                <Text style={styles.confirmButtonText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 地址選擇器模態框 */}
      <Modal
        visible={showAddressPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddressPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>選擇代購地點</Text>
            <Text style={styles.modalSubtitle}>
              找到 {addressSearchResults.length} 個符合條件的地址
            </Text>
            
            <ScrollView style={styles.addressList} showsVerticalScrollIndicator={false}>
              {addressSearchResults.map((address) => (
                <TouchableOpacity
                  key={address.id}
                  style={styles.addressOption}
                  onPress={() => selectAddress(address)}
                >
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressName}>{address.name}</Text>
                    <Text style={styles.addressText}>{address.address}</Text>
                    {address.rating > 0 && (
                      <Text style={styles.addressRating}>
                        ⭐ {address.rating.toFixed(1)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.selectButton}>選擇</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAddressPicker(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 80,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f90',
    marginBottom: 20
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
    height: 150,
    color: '#333'
  },
  pickerItem: {
    color: '#333',
    fontSize: 18
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
  },
  // 付款方式選擇器樣式
  inputText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4
  },
  placeholderText: {
    color: '#999'
  },
  pickerHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic'
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center'
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  paymentOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#f90'
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500'
  },
  paymentOptionTextSelected: {
    color: '#f90',
    fontWeight: '600'
  },
  checkbox: {
    fontSize: 20,
    color: '#ccc'
  },
  checkboxSelected: {
    color: '#f90'
  },
  // 地址搜尋相關樣式
  locationInputContainer: {
    position: 'relative'
  },
  searchIndicator: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  searchText: {
    fontSize: 12,
    color: '#f90',
    marginLeft: 4
  },
  searchResultsButton: {
    backgroundColor: '#e3f2fd',
    borderColor: '#f90',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    alignItems: 'center'
  },
  searchResultsText: {
    fontSize: 12,
    color: '#f90',
    fontWeight: '500'
  },
  addressList: {
    maxHeight: 300,
    marginBottom: 20
  },
  addressOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  addressInfo: {
    flex: 1,
    marginRight: 12
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  addressRating: {
    fontSize: 12,
    color: '#f90'
  },
  selectButton: {
    fontSize: 14,
    color: '#f90',
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f90'
  }
});
