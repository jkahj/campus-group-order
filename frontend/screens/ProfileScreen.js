import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthManager from '../utils/authManager';
import apiConfig from '../config/apiConfig';
import apiService from '../utils/apiService';
import {
  getUserCreditScore,
  getUserTier,
  getScoreHistory
} from '../utils/creditScoreManager';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { normalizeFont } from '../utils/responsive';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('reviews'); // 'reviews' or 'credit'
  const [reviewSubTab, setReviewSubTab] = useState('all'); // 'all', 'fromBuyers', 'fromSellers'
  const [profileImage, setProfileImage] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userData, setUserData] = useState({
    username: 'XXX',
    location: '高雄市',
    rating: 5.0,
    reviewCount: 10,
    creditScore: 100, // 初始分數設為100分
  });
  const [userReviews, setUserReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({
    all: { rating: 0, count: 0 },
    fromBuyers: { rating: 0, count: 0 },
    fromSellers: { rating: 0, count: 0 }
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({
    username: '',
    location: '',
  });
  const [scoreHistory, setScoreHistory] = useState([]);

  // 載入用戶資料
  useEffect(() => {
    loadUserData();
    loadScoreHistory();
    loadUserReviews();
  }, []);

  // 監聽畫面焦點，當從編輯畫面返回時重新載入資料
  useFocusEffect(
    React.useCallback(() => {
      console.log('ProfileScreen 獲得焦點，重新載入資料');
      loadUserData();
      loadScoreHistory(); // 同時刷新積分歷史
      loadUserReviews(); // 同時刷新用戶評分
    }, [])
  );


  const getScopedStorageKey = (baseKey, userId) => {
    const scopedId = userId ?? 'guest';
    return `${baseKey}_${scopedId}`;
  };

  const resolveCurrentUserId = async () => {
    if (currentUserId) {
      return currentUserId;
    }
    const currentUser = await AuthManager.getCurrentUser();
    const resolvedId = currentUser?.id ? String(currentUser.id) : null;
    if (resolvedId) {
      setCurrentUserId(prev => prev || resolvedId);
    }
    return resolvedId;
  };

  const loadUserData = async () => {
    try {
      // 獲取當前登入用戶資訊
      const currentUser = await AuthManager.getCurrentUser();
      console.log('當前用戶:', currentUser);
      const userId = currentUser?.id ? String(currentUser.id) : null;
      setCurrentUserId(userId);
      const profileDataKey = getScopedStorageKey('profileData', userId);
      const profileImageKey = getScopedStorageKey('profileImage', userId);
      const localProfileImageRaw = await AsyncStorage.getItem(profileImageKey);
      const normalizedLocalImage =
        typeof localProfileImageRaw === 'string' && localProfileImageRaw.trim().length > 0
          ? localProfileImageRaw.trim()
          : null;
      let resolvedUserData = null;
      let effectiveProfileImage = null;
      
      if (currentUser) {
        setUserData(prevData => ({
          ...prevData,
          username: currentUser.name || prevData.username,
          location: currentUser.city || prevData.location,
        }));
        setEditData({
          username: currentUser.name || '',
          location: currentUser.city || '高雄市',
        });
      }

      if (userId) {
        try {
          const userFromDB = await apiService.getUser(userId);
          if (userFromDB) {
            const backendPhoto =
              typeof userFromDB.photo === 'string' && userFromDB.photo.trim().length > 0
                ? userFromDB.photo.trim()
                : null;
            const photoToUse = backendPhoto || normalizedLocalImage || null;

            resolvedUserData = {
              username: userFromDB.name || currentUser?.name || '',
              location: userFromDB.city || currentUser?.city || '高雄市',
              rating: userFromDB.rating ? parseFloat(userFromDB.rating) : userData.rating,
              reviewCount: userFromDB.review_count ?? userData.reviewCount,
              creditScore: userData.creditScore,
              creditTier: userData.creditTier,
              phone: userFromDB.phone ?? '',
              email: userFromDB.email ?? '',
              aboutMe: userFromDB.about_me ?? '',
              photo: photoToUse
            };
            setUserData(prevData => ({
              ...prevData,
              ...resolvedUserData,
            }));
            setEditData({
              username: resolvedUserData.username,
              location: resolvedUserData.location,
            });
            if (photoToUse) {
              const resolvedUri = resolveImageUri(photoToUse);
              if (resolvedUri) {
                effectiveProfileImage = resolvedUri;
                setProfileImage(resolvedUri);
                await AsyncStorage.setItem(profileImageKey, photoToUse);
              } else {
                console.warn('後端返回的 photo 欄位不是有效的圖片 URL，已改用本地快取或預設值');
              }
            }
            await AsyncStorage.setItem(profileDataKey, JSON.stringify(resolvedUserData));
          }
        } catch (apiError) {
          console.warn('從後端載入用戶資料失敗，使用本地資料:', apiError?.message || apiError);
        }
      }

      if (!resolvedUserData) {
        const savedProfileData = await AsyncStorage.getItem(profileDataKey);
        if (savedProfileData) {
          const parsedData = JSON.parse(savedProfileData);
          resolvedUserData = parsedData;
          if (!resolvedUserData.photo && normalizedLocalImage) {
            resolvedUserData.photo = normalizedLocalImage;
          }
          setUserData(prevData => ({
            ...prevData,
            ...parsedData,
          }));
          setEditData({
            username: parsedData.username || '',
            location: parsedData.location || '高雄市',
          });
          if (resolvedUserData.photo) {
            const resolvedUri = resolveImageUri(resolvedUserData.photo);
            if (resolvedUri) {
              effectiveProfileImage = resolvedUri;
              setProfileImage(resolvedUri);
              await AsyncStorage.setItem(profileImageKey, resolvedUserData.photo);
            }
          }
        }
      }

      // 載入真實的信譽積分數據
      const userIdForScore = userId || 'me';
      const creditScore = await getUserCreditScore(userIdForScore);
      const creditTier = await getUserTier(userIdForScore);
      
      setUserData(prevData => ({
        ...prevData,
        creditScore: creditScore,
        creditTier: creditTier
      }));
      
      if (!effectiveProfileImage) {
        const savedImage = await AsyncStorage.getItem(profileImageKey);
        if (!savedImage) {
          setProfileImage(null);
        } else {
          const resolvedUri = resolveImageUri(savedImage);
          if (resolvedUri) {
            effectiveProfileImage = resolvedUri;
            setProfileImage(resolvedUri);
          } else {
            console.warn('讀取到非有效的本地照片 URL，忽略:', savedImage?.slice?.(0, 30));
            setProfileImage(null);
          }
        }
      }
    } catch (error) {
      console.error('載入用戶資料失敗:', error);
    }
  };

  // 載入積分歷史
  const loadScoreHistory = async () => {
    try {
      const currentUser = await AuthManager.getCurrentUser();
      const userId = currentUser?.id || 'me';
      const history = await getScoreHistory(userId);
      const normalizedHistory = Array.isArray(history) ? history : [];
      setScoreHistory(normalizedHistory);
      console.log('積分歷史載入成功:', normalizedHistory.length, '筆記錄');
    } catch (error) {
      console.error('載入積分歷史失敗:', error);
    }
  };

  const normalizeIsFromPurchaser = (value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no'].includes(normalized)) {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return !!value;
  };

  // 載入用戶評分
  const loadUserReviews = async () => {
    try {
      console.log('=== 開始載入用戶評分 ===');
      const currentUser = await AuthManager.getCurrentUser();
      const currentUserId = currentUser?.id || 'me';

      const normalizedBackendReviews = [];
      let backendSucceeded = false;

      try {
        const backendResponse = await apiService.getReviewsByUser(currentUserId);
        const backendReviews = Array.isArray(backendResponse)
          ? backendResponse
          : Array.isArray(backendResponse?.reviews)
            ? backendResponse.reviews
            : [];

        // 後端成功返回（即使是空陣列），優先使用後端資料
        backendSucceeded = true;
        backendReviews.forEach(review => {
          if (!review) return;
          normalizedBackendReviews.push({
            id: review.id,
            reviewerId: review.reviewer_id,
            reviewerName: review.reviewer_name,
            rating: review.rating !== undefined && review.rating !== null ? Number(review.rating) : review.rating,
            comment: review.comment,
            timestamp: review.timestamp,
            orderId: review.order_id,
            orderName: review.order_name,
            orderLocation: review.order_location,
            orderContact: review.order_contact,
            isFromPurchaser: normalizeIsFromPurchaser(review.is_from_purchaser),
            targetUserId: review.target_user_id ?? review.targetUserId ?? currentUserId,
          });
        });

        // 更新本地快取，維持其他功能相容性
        const cachedReviews = JSON.parse(await AsyncStorage.getItem('userReviews')) || {};
        cachedReviews[currentUserId] = normalizedBackendReviews;
        await AsyncStorage.setItem('userReviews', JSON.stringify(cachedReviews));
        
        console.log(`✅ 從後端載入 ${normalizedBackendReviews.length} 筆評價資料`);
      } catch (apiErr) {
        console.log('從後端載入評價資料失敗，改用本地資料:', apiErr?.message || apiErr);
        backendSucceeded = false;
      }

      let effectiveReviews = normalizedBackendReviews;

      if (!backendSucceeded) {
        const allReviews = JSON.parse(await AsyncStorage.getItem('userReviews')) || {};
        console.log('原始評價資料 (本地):', JSON.stringify(allReviews, null, 2));
        
        const receivedReviews = allReviews[currentUserId] || [];
        const sentReviews = [];
        Object.keys(allReviews).forEach(userId => {
          const userReviews = allReviews[userId] || [];
          userReviews.forEach(review => {
            if (review.reviewerId === currentUserId) {
              sentReviews.push(review);
            }
          });
        });
        
        const allUserReviews = [...receivedReviews, ...sentReviews];
        const uniqueReviews = [];
        const seenIds = new Set();
        
        allUserReviews.forEach(review => {
          if (review.id && !seenIds.has(review.id)) {
            seenIds.add(review.id);
            uniqueReviews.push(review);
          }
        });
        
        const normalizedLocalReviews = uniqueReviews.map(review => ({
          ...review,
          rating:
            review.rating !== undefined && review.rating !== null
              ? Number(review.rating)
              : review.rating,
          isFromPurchaser: normalizeIsFromPurchaser(
            review.isFromPurchaser ?? review.is_from_purchaser
          ),
          targetUserId: review.targetUserId ?? review.target_user_id ?? review.targetUser ?? review.target ?? currentUserId,
        }));
        effectiveReviews = normalizedLocalReviews;
      }
      
      const normalizedReviews = (effectiveReviews || []).map(review => ({
        ...review,
        rating:
          review.rating !== undefined && review.rating !== null
            ? Number(review.rating)
            : review.rating,
        isFromPurchaser: normalizeIsFromPurchaser(
          review.isFromPurchaser ?? review.is_from_purchaser
        ),
        targetUserId: review.targetUserId ?? review.target_user_id ?? currentUserId,
      }));
      const receivedReviewsOnly = normalizedReviews.filter(review => {
        const reviewerId = review.reviewerId ? String(review.reviewerId) : '';
        const targetUserId = review.targetUserId ? String(review.targetUserId) : '';
        const normalizedCurrentUserId = currentUserId ? String(currentUserId) : '';
        if (reviewerId && reviewerId === normalizedCurrentUserId) {
          return false;
        }
        if (targetUserId && normalizedCurrentUserId && targetUserId !== normalizedCurrentUserId) {
          return false;
        }
        return true;
      });
      const sortedReviews = receivedReviewsOnly.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setUserReviews(sortedReviews);
      
      // 計算各分類的統計數據
      const stats = calculateReviewStats(sortedReviews);
      setReviewStats(stats);
      
      console.log('評價統計:', stats);
      
      // 根據當前選中的子標籤篩選評價
      filterReviewsBySubTab(sortedReviews, reviewSubTab);
      
      console.log('=== 載入用戶評分完成 ===');
    } catch (error) {
      console.error('載入用戶評分失敗:', error);
    }
  };

  // 計算評價統計數據
  const calculateReviewStats = (reviews) => {
    const stats = {
      all: { rating: 0, count: 0 },
      fromBuyers: { rating: 0, count: 0 },
      fromSellers: { rating: 0, count: 0 }
    };

    const currentUserId = 'me';
    
    // 計算總體統計（所有收到的評價）
    if (reviews.length === 0) {
      console.log('沒有收到的評價，返回預設統計');
      return stats;
    }

    // 計算總體統計 - 只在ALL中計算平均星級
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    stats.all = {
      rating: totalRating / reviews.length,
      count: reviews.length
    };

    // 計算來自留言者（buyers）的評價 - 只計算筆數，不計算平均星級
    const buyerReviews = reviews.filter(review => !review.isFromPurchaser);
    stats.fromBuyers = {
      rating: 0, // 不計算平均星級
      count: buyerReviews.length
    };

    // 計算來自代購者（sellers）的評價 - 只計算筆數，不計算平均星級
    const sellerReviews = reviews.filter(review => review.isFromPurchaser);
    stats.fromSellers = {
      rating: 0, // 不計算平均星級
      count: sellerReviews.length
    };

    console.log('計算評價統計:', {
      totalReviews: reviews.length,
      allStats: stats.all,
      buyerReviews: buyerReviews.length,
      sellerReviews: sellerReviews.length,
      reviews: reviews
    });

    console.log('計算完成的統計:', stats);
    return stats;
  };

  // 根據子標籤篩選評價
  const filterReviewsBySubTab = (reviews, subTab) => {
    let filtered = [];
    
    switch (subTab) {
      case 'all':
        filtered = reviews;
        break;
      case 'fromBuyers':
        // 來自留言者的評價（收到的評價，且評價者不是代購者）
        filtered = reviews.filter(review => !review.isFromPurchaser);
        break;
      case 'fromSellers':
        // 來自代購者的評價（收到的評價，且評價者是代購者）
        filtered = reviews.filter(review => review.isFromPurchaser);
        break;
      default:
        filtered = reviews;
    }
    
    console.log('篩選評價:', {
      subTab,
      totalReviews: reviews.length,
      filteredCount: filtered.length,
      filteredReviews: filtered
    });
    
    setFilteredReviews(filtered);
  };

  // 處理子標籤切換
  const handleSubTabChange = (subTab) => {
    setReviewSubTab(subTab);
    filterReviewsBySubTab(userReviews, subTab);
  };

  // 獲取當前統計數據
  const getCurrentStats = () => {
    return reviewStats[reviewSubTab] || { rating: 0, count: 0 };
  };

  // 格式化時間
  const formatTime = (timestamp) => {
    if (!timestamp) return '時間不明';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}週前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}個月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  };




  const normalizeMimeType = (mimeType) => {
    if (!mimeType) return 'image/jpeg';
    if (mimeType === 'image/jpg') return 'image/jpeg';
    return mimeType;
  };

  const resolveImageUri = (value) => {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('data:image')) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return `${apiConfig.baseURL}${trimmed}`;
    }
    return trimmed;
  };

  const ensureDataUrlFromAsset = async (asset) => {
    const { uri, base64 } = asset;
    const mimeType = normalizeMimeType(asset.mimeType);

    if (base64) {
      return {
        dataUrl: `data:${mimeType};base64,${base64}`,
        mimeType,
      };
    }

    if (!uri) {
      throw new Error('無法取得圖片來源');
    }

    const base64Encoding =
      (FileSystem?.EncodingType && FileSystem.EncodingType.Base64) || 'base64';
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: base64Encoding,
    });

    return {
      dataUrl: `data:${mimeType};base64,${base64Data}`,
      mimeType,
    };
  };

  const getPickerMediaTypes = () => {
    const modern = ImagePicker?.MediaType;
    if (modern && typeof modern === 'object') {
      if (modern.IMAGE) return modern.IMAGE;
      if (modern.Images) return modern.Images;
      if (modern.IMAGES) return modern.IMAGES;
      if (modern.image) return modern.image;
      if (modern.images) return modern.images;
      if (modern.Photo) return modern.Photo;
      if (modern.photo) return modern.photo;
      const imageKey = Object.keys(modern).find(key => key.toLowerCase().includes('image'));
      if (imageKey) {
        return modern[imageKey];
      }
    }
    const legacy = ImagePicker?.MediaTypeOptions;
    if (legacy && typeof legacy === 'object') {
      if (legacy.Images !== undefined) return legacy.Images;
      if (legacy.images !== undefined) return legacy.images;
    }
    return undefined;
  };

  const updateProfilePhoto = async (imageUri, mimeType = 'image/jpeg', preparedImage = null) => {
    try {
      const resolvedUserId = await resolveCurrentUserId();
      if (!resolvedUserId) {
        Alert.alert('錯誤', '未能取得用戶資訊，請重新登入後再試');
        return;
      }

      let dataUrl = preparedImage?.dataUrl;
      let normalizedMimeType = preparedImage?.mimeType || normalizeMimeType(mimeType);

      if (!dataUrl) {
        const processed = await ensureDataUrlFromAsset({
          uri: imageUri,
          mimeType,
        });
        dataUrl = processed.dataUrl;
        normalizedMimeType = processed.mimeType;
      }

      const updatePayload = {};
      if (userData.username !== undefined && userData.username !== null) {
        updatePayload.name = userData.username;
      }
      if (userData.email !== undefined && userData.email !== null) {
        updatePayload.email = userData.email;
      }
      if (userData.phone !== undefined && userData.phone !== null) {
        updatePayload.phone = userData.phone;
      }
      if (userData.gender !== undefined && userData.gender !== null) {
        updatePayload.gender = userData.gender;
      }
      if (userData.location !== undefined && userData.location !== null) {
        updatePayload.city = userData.location;
      }
      if (userData.aboutMe !== undefined && userData.aboutMe !== null) {
        updatePayload.about_me = userData.aboutMe;
      }
      updatePayload.photo = dataUrl;

      let payloadString = '';
      try {
        payloadString = JSON.stringify(updatePayload);
      } catch (stringifyError) {
        console.error('序列化更新資料失敗:', stringifyError);
        throw new Error('準備上傳資料時發生錯誤，請稍後再試。');
      }

      let payloadBytes = null;
      try {
        if (typeof TextEncoder !== 'undefined') {
          payloadBytes = new TextEncoder().encode(payloadString);
        }
      } catch (encoderError) {
        console.warn('TextEncoder 不可用，改用字串長度估算:', encoderError);
      }

      const currentPayloadSize = payloadBytes ? payloadBytes.length : payloadString.length;
      const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024; // 4 MB
      if (currentPayloadSize > MAX_PAYLOAD_SIZE) {
        throw new Error('上傳的圖片檔案太大，請選擇較小的圖片。');
      }

      let updatedUser = null;
      try {
        updatedUser = await apiService.updateUser(resolvedUserId, updatePayload);
      } catch (apiError) {
        console.error('同步後端照片失敗:', apiError);
        Alert.alert('提示', '照片已更新於本機，但同步到伺服器時發生錯誤。');
      }

      const profileDataKey = getScopedStorageKey('profileData', resolvedUserId);
      const profileImageKey = getScopedStorageKey('profileImage', resolvedUserId);

      // 更新本地快取
      const existingProfileDataRaw = await AsyncStorage.getItem(profileDataKey);
      const existingProfileData = existingProfileDataRaw ? JSON.parse(existingProfileDataRaw) : {};
      let photoForStorage = dataUrl;
      let resolvedImageUri = resolveImageUri(dataUrl);

      if (updatedUser && typeof updatedUser === 'object') {
        const updatedPhotoValue = updatedUser.photo || updatedUser?.user?.photo;
        if (typeof updatedPhotoValue === 'string' && updatedPhotoValue.length > 0) {
          photoForStorage = updatedPhotoValue;
          resolvedImageUri = resolveImageUri(updatedPhotoValue);
        }
      }

      const mergedProfileData = {
        ...existingProfileData,
      };
      if (photoForStorage) {
        mergedProfileData.photo = photoForStorage;
      } else {
        delete mergedProfileData.photo;
      }
      await AsyncStorage.setItem(profileDataKey, JSON.stringify(mergedProfileData));
      if (photoForStorage) {
        await AsyncStorage.setItem(profileImageKey, photoForStorage);
      } else {
        await AsyncStorage.removeItem(profileImageKey);
      }

      setProfileImage(resolvedImageUri || dataUrl);
      Alert.alert('成功', '個人照片已更新');
    } catch (error) {
      console.error('更新個人照片發生錯誤:', error);
      Alert.alert('錯誤', '更新個人照片失敗: ' + (error.message || '未知錯誤'));
    }
  };

  const handleImageSelection = async (assets) => {
    if (!assets || assets.length === 0) {
      return;
    }
    const imageAsset = assets[0];
    const localUri = imageAsset.uri;
    const mimeType = imageAsset.mimeType || 'image/jpeg';

    if (localUri) {
      try {
        const processedImage = await ensureDataUrlFromAsset(imageAsset);
        setProfileImage(processedImage.dataUrl);
        await updateProfilePhoto(localUri, processedImage.mimeType, processedImage);
      } catch (processingError) {
        console.error('處理圖片時發生錯誤:', processingError);
        Alert.alert('錯誤', '無法處理選取的圖片，請改用其他圖片或稍後再試。');
      }
    }
  };

  // 選擇圖片
  const pickImage = async () => {
    try {
      // 檢查相簿權限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限', '需要相簿權限才能選擇圖片');
        return;
      }

      const mediaTypesOption = getPickerMediaTypes();
      const pickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      };
      if (mediaTypesOption) {
        pickerOptions.mediaTypes = mediaTypesOption;
      }
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleImageSelection(result.assets);
      }
    } catch (error) {
      console.error('選擇圖片錯誤:', error);
      Alert.alert('錯誤', '選擇圖片失敗: ' + error.message);
    }
  };

  // 拍照
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限', '需要相機權限才能拍照');
        return;
      }

      const mediaTypesOption = getPickerMediaTypes();
      const pickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      };
      if (mediaTypesOption) {
        pickerOptions.mediaTypes = mediaTypesOption;
      }
      const result = await ImagePicker.launchCameraAsync(pickerOptions);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleImageSelection(result.assets);
      }
    } catch (error) {
      console.error('拍照錯誤:', error);
      Alert.alert('錯誤', '拍照失敗: ' + error.message);
    }
  };

  // 顯示圖片選擇選項
  const showImageOptions = () => {
    Alert.alert(
      '選擇圖片',
      '請選擇圖片來源',
      [
        { text: '拍照', onPress: takePhoto },
        { text: '從相簿選擇', onPress: pickImage },
        { text: '取消', style: 'cancel' },
      ]
    );
  };

  // 開啟編輯模式
  const openEditMode = () => {
    setEditData({
      username: userData.username,
      location: userData.location,
    });
    setIsEditMode(true);
  };

  // 儲存編輯的資料
  const saveEditData = async () => {
    try {
      const newUserData = {
        ...userData,
        username: editData.username.trim(),
        location: editData.location.trim(),
      };
      
      if (!newUserData.username || !newUserData.location) {
        Alert.alert('錯誤', '請填寫所有欄位');
        return;
      }

      setUserData(newUserData);
      const resolvedUserId = await resolveCurrentUserId();
      const profileDataKey = getScopedStorageKey('profileData', resolvedUserId);
      await AsyncStorage.setItem(profileDataKey, JSON.stringify(newUserData));
      setIsEditMode(false);
      Alert.alert('成功', '個人資料已更新');
    } catch (error) {
      Alert.alert('錯誤', '儲存失敗');
    }
  };

  // 取消編輯
  const cancelEdit = () => {
    setIsEditMode(false);
    setEditData({
      username: userData.username,
      location: userData.location,
    });
  };

  // 渲染星星
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <Ionicons
            key={i}
            name="star"
            size={16}
            color="#FFD700"
          />
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <Ionicons
            key={i}
            name="star-half"
            size={16}
            color="#FFD700"
          />
        );
      } else {
        stars.push(
          <Ionicons
            key={i}
            name="star-outline"
            size={16}
            color="#D3D3D3"
          />
        );
      }
    }
    return stars;
  };

  // 渲染信譽積分等級
  const getCreditTier = (score) => {
    if (score >= 400) return { name: '咖皇', color: '#FFD700' };
    if (score >= 300) return { name: '咖王', color: '#8B4513' };
    if (score >= 200) return { name: '團咖', color: '#4169E1' };
    if (score >= 100) return { name: '買咖', color: '#FF8C00' };
    return { name: '掰咖', color: '#DC143C' };
  };

  // 獲取進度條顏色
  const getProgressColor = (score) => {
    if (score >= 300) return '#FFD700'; // 咖皇 - 金色
    if (score >= 200) return '#FF8C00'; // 咖王 - 橙色
    if (score >= 100) return '#FFD700'; // 團咖 - 黃色
    return '#4169E1'; // 買咖/掰咖 - 藍色
  };

  const progressColor = getProgressColor(userData.creditScore);

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>個人檔案</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* 用戶資料區域 */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={showImageOptions} style={styles.imageContainer}>
            {profileImage ? (
              <Image 
                source={{ uri: profileImage }} 
                style={styles.profileImage}
                onError={(error) => {
                  const errorMessage = error?.nativeEvent?.error || error?.message || '未知錯誤';
                  console.error('圖片載入錯誤:', errorMessage);
                  setProfileImage(null);
                }}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <FontAwesome5 name="user" size={40} color="#999" />
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={showImageOptions} style={styles.editPhotoButton}>
            <Text style={styles.editPhotoText}>編輯個人照片</Text>
          </TouchableOpacity>



          <Text style={styles.username}>{userData.username}</Text>
          
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color="#FF4444" />
            <Text style={styles.locationText}>{userData.location}</Text>
          </View>

        </View>

        {/* 主要標籤 */}
        <View style={styles.mainTabs}>
          <TouchableOpacity
            style={[styles.mainTab, activeTab === 'reviews' && styles.activeMainTab]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.mainTabText, activeTab === 'reviews' && styles.activeMainTabText]}>
              評價
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.mainTab, activeTab === 'credit' && styles.activeMainTab]}
            onPress={() => setActiveTab('credit')}
          >
            <Text style={[styles.mainTabText, activeTab === 'credit' && styles.activeMainTabText]}>
              信譽積分
            </Text>
          </TouchableOpacity>
        </View>

        {/* 評價頁面 */}
        {activeTab === 'reviews' && (
          <View style={styles.reviewsTab}>
            {/* 子標籤 */}
            <View style={styles.subTabs}>
              <TouchableOpacity 
                style={[styles.subTab, reviewSubTab === 'all' && styles.activeSubTab]}
                onPress={() => handleSubTabChange('all')}
              >
                <Text style={[styles.subTabText, reviewSubTab === 'all' && styles.activeSubTabText]}>
                  ALL ({reviewStats.all.count})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.subTab, reviewSubTab === 'fromBuyers' && styles.activeSubTab]}
                onPress={() => handleSubTabChange('fromBuyers')}
              >
                <Text style={[styles.subTabText, reviewSubTab === 'fromBuyers' && styles.activeSubTabText]}>
                  From Buyers ({reviewStats.fromBuyers.count})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.subTab, reviewSubTab === 'fromSellers' && styles.activeSubTab]}
                onPress={() => handleSubTabChange('fromSellers')}
              >
                <Text style={[styles.subTabText, reviewSubTab === 'fromSellers' && styles.activeSubTabText]}>
                  From Sellers ({reviewStats.fromSellers.count})
                </Text>
              </TouchableOpacity>
            </View>

            {/* 分類評分統計 */}
            <View style={styles.overallRating}>
              <View style={styles.overallRatingDisplay}>
                {/* 只在ALL分類中顯示平均星級 */}
                {reviewSubTab === 'all' && (
                  <>
                    <Text style={styles.overallRatingNumber}>
                      {getCurrentStats().rating.toFixed(1)}
                    </Text>
                    <View style={styles.overallStarsContainer}>
                      {renderStars(getCurrentStats().rating)}
                    </View>
                  </>
                )}
                <Text style={styles.overallReviewCount}>
                  {getCurrentStats().count} 則評價
                </Text>
                <Text style={styles.categoryLabel}>
                  {reviewSubTab === 'all' && '所有評價'}
                  {reviewSubTab === 'fromBuyers' && '來自留言者的評價'}
                  {reviewSubTab === 'fromSellers' && '來自代購者的評價'}
                </Text>
              </View>
            </View>

            {/* 排序選項和刷新按鈕 */}
            <View style={styles.sortContainer}>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={loadUserReviews}
              >
                <Ionicons name="refresh" size={16} color="#007BFF" />
                <Text style={styles.refreshButtonText}>刷新評價</Text>
              </TouchableOpacity>
              <Text style={styles.sortText}>Newest ∨</Text>
            </View>

            {/* 評價列表 */}
            <View style={styles.reviewsList}>
              {filteredReviews.length > 0 ? (
                filteredReviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewerInfo}>
                        <View style={styles.reviewerAvatar}>
                          <FontAwesome5 name="user" size={16} color="#666" />
                        </View>
                        <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                        {review.isFromPurchaser && (
                          <View style={styles.reviewerBadge}>
                            <Text style={styles.reviewerBadgeText}>代購者</Text>
                          </View>
                        )}
                        {!review.isFromPurchaser && (
                          <View style={styles.reviewerBadge}>
                            <Text style={styles.reviewerBadgeText}>留言者</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.reviewTime}>{formatTime(review.timestamp)}</Text>
                    </View>
                    <View style={styles.reviewStars}>
                      {renderStars(review.rating)}
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                    <Text style={styles.reviewOrder}>訂單：{review.orderName}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.noReviewsContainer}>
                  <FontAwesome5 name="comment-dots" size={48} color="#ccc" />
                  <Text style={styles.noReviewsText}>
                    {reviewSubTab === 'all' && '還沒有收到評價'}
                    {reviewSubTab === 'fromBuyers' && '還沒有收到留言者的評價'}
                    {reviewSubTab === 'fromSellers' && '還沒有收到代購者的評價'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 信譽積分頁面 */}
        {activeTab === 'credit' && (
          <View style={styles.creditTab}>
            {/* 信譽積分視覺化 */}
            <View style={styles.creditVisual}>
              <Text style={styles.creditLabel}>{getCreditTier(userData.creditScore).name}</Text>
              <View style={styles.creditScale}>
                {/* 三角形指示器 */}
                <View style={styles.triangleIndicator}>
                  <View style={[styles.trianglePointer, { 
                    left: `${Math.min(100, (userData.creditScore / 400) * 100)}%`,
                  }]}>
                    <Text style={[styles.triangleScoreText, { color: progressColor }]}>{userData.creditScore}</Text>
                    <View style={[styles.triangle, { borderTopColor: progressColor }]} />
                  </View>
                </View>
                
                <View style={styles.scaleBar}>
                  {/* 背景進度條 */}
                  <View style={styles.scaleBackground}>
                    <View style={[styles.scaleSegment, { backgroundColor: '#4169E1', width: '25%' }]} />
                    <View style={[styles.scaleSegment, { backgroundColor: '#FFD700', width: '25%' }]} />
                    <View style={[styles.scaleSegment, { backgroundColor: '#FF8C00', width: '25%' }]} />
                    <View style={[styles.scaleSegment, { backgroundColor: '#FFA500', width: '25%' }]} />
                  </View>
                </View>
                <View style={styles.scaleMarks}>
                  <Text style={styles.scaleMark}>0</Text>
                  <Text style={styles.scaleMark}>100</Text>
                  <Text style={styles.scaleMark}>200</Text>
                  <Text style={styles.scaleMark}>300</Text>
                  <Text style={styles.scaleMark}>400</Text>
                </View>
                <View style={styles.scaleIcons}>
                  <FontAwesome5 name="shoe-prints" size={16} color="#4169E1" style={styles.scaleIcon} />
                  <FontAwesome5 name="shoe-prints" size={16} color="#FFD700" style={styles.scaleIcon} />
                  <FontAwesome5 name="users" size={16} color="#FF8C00" style={styles.scaleIcon} />
                  <FontAwesome5 name="crown" size={16} color="#FFA500" style={styles.scaleIcon} />
                  <FontAwesome5 name="star" size={16} color="#FFD700" style={styles.scaleIcon} />
                </View>
              </View>
              <Text style={styles.currentScore}>
                當前信譽分數: <Text style={styles.scoreNumber}>{userData.creditScore}分</Text>
              </Text>
              <Text style={styles.progressPercentage}>
                進度: {Math.min(100, Math.round((userData.creditScore / 400) * 100))}% 
                {userData.creditScore < 400 ? ` (距離下一等級還需 ${400 - userData.creditScore} 分)` : ' (已達最高等級)'}
              </Text>
            </View>


                    {/* 分數紀錄 */}
        <View style={styles.scoreRecordSection}>
          <View style={styles.scoreRecordHeader}>
            <Text style={styles.scoreRecordTitle}>分數紀錄</Text>
            <View style={styles.rulesLinks}>
              <TouchableOpacity onPress={() => navigation.navigate('TierRules')}>
                <Text style={styles.tierRulesLink}>分級規則</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('CreditRules')}>
                <Text style={styles.creditRulesLink}>信譽積分規則</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 動態載入積分歷史 */}
          {scoreHistory.length > 0 ? (
            scoreHistory.slice(0, 5).map((item, index) => (
              <View key={item.id} style={styles.scoreRecordItem}>
                <View style={[
                  styles.recordContent,
                  item.type === 'positive' ? styles.positiveRecord : styles.negativeRecord
                ]}>
                  <Ionicons 
                    name={item.type === 'positive' ? 'time' : 'warning'} 
                    size={20} 
                    color={item.type === 'positive' ? '#FFD700' : '#FF4444'} 
                  />
                  <Text style={styles.recordText}>{item.action}</Text>
                  <Text style={[
                    styles.recordPoints,
                    item.type === 'positive' ? styles.positivePoints : styles.negativePoints
                  ]}>
                    {item.scoreChange >= 0 ? '+' : ''}{item.scoreChange}分
                  </Text>
                </View>
                <Text style={styles.recordTime}>{formatTime(item.timestamp)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.noRecordsContainer}>
              <Ionicons name="document-outline" size={48} color="#ccc" />
              <Text style={styles.noRecordsText}>還沒有積分變化記錄</Text>
            </View>
          )}

          {/* 刷新按鈕 */}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={loadScoreHistory}
          >
            <Ionicons name="refresh" size={16} color="#007BFF" />
            <Text style={styles.refreshButtonText}>刷新記錄</Text>
          </TouchableOpacity>
        </View>
          </View>
        )}
      </ScrollView>

      {/* 編輯個人資料的 Modal */}
      <Modal
        visible={isEditMode}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>編輯個人檔案</Text>
              <TouchableOpacity onPress={cancelEdit}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>用戶名稱</Text>
              <TextInput
                style={styles.textInput}
                value={editData.username}
                onChangeText={(text) => setEditData({ ...editData, username: text })}
                placeholder="請輸入用戶名稱"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>地區</Text>
              <TextInput
                style={styles.textInput}
                value={editData.location}
                onChangeText={(text) => setEditData({ ...editData, location: text })}
                placeholder="請輸入地區"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveEditData}>
                <Text style={styles.saveButtonText}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ResponsiveContainer>
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
  headerLeft: {
    width: 24,
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
  },
  imageContainer: {
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoButton: {
    marginBottom: 16,
  },
  editPhotoText: {
    color: '#007BFF',
    fontSize: 16,
    textDecorationLine: 'underline',
  },

  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#666',
  },
  ratingText: {
    fontSize: 16,
    color: '#333',
  },
  mainTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  activeMainTab: {
    backgroundColor: '#fff',
  },
  mainTabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeMainTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  reviewsTab: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  subTabs: {
    flexDirection: 'row',
    marginVertical: 16,
    flexWrap: 'wrap',
  },
  subTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    flex: 1,
    minWidth: 100,
  },
  activeSubTab: {
    backgroundColor: '#E0E0E0',
  },
  subTabText: {
    color: '#666',
    fontSize: 14,
  },
  activeSubTabText: {
    color: '#333',
    fontWeight: '500',
  },
  overallRating: {
    alignItems: 'center',
    marginBottom: 16,
  },
  overallRatingDisplay: {
    alignItems: 'center',
  },
  overallRatingNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  overallStarsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  overallReviewCount: {
    fontSize: 16,
    color: '#666',
  },
  categoryLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  overallRatingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sortText: {
    color: '#666',
    fontSize: 14,
  },
  reviewsList: {
    marginBottom: 24,
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginRight: 8,
  },
  reviewerBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reviewerBadgeText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
  },
  reviewTime: {
    fontSize: 12,
    color: '#999',
  },
  reviewStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyText: {
    marginLeft: 4,
    color: '#007BFF',
    fontSize: 14,
  },
  creditTab: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  creditVisual: {
    alignItems: 'center',
    marginVertical: 24,
  },
  creditLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  creditScale: {
    width: '100%',
    marginBottom: 16,
  },
  scaleBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  triangleIndicator: {
    position: 'relative',
    height: 30,
    marginBottom: 2,
  },
  trianglePointer: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    marginLeft: -10,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF8C00',
  },
  triangleScoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  scaleBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  scaleSegment: {
    height: '100%',
  },
  scaleMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scaleMark: {
    fontSize: 12,
    color: '#666',
  },
  scaleIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  scaleIcon: {
    marginHorizontal: 8,
  },
  currentScore: {
    fontSize: 16,
    color: '#333',
  },
  scoreNumber: {
    color: '#FF8C00',
    fontWeight: 'bold',
  },
  progressPercentage: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scoreRecordSection: {
    marginBottom: 24,
  },
  scoreRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreRecordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  rulesLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierRulesLink: {
    color: '#007BFF',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginRight: 16,
  },
  creditRulesLink: {
    color: '#FF8C00',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  scoreRecordItem: {
    marginBottom: 12,
  },
  recordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  positiveRecord: {
    backgroundColor: '#FFF8DC',
  },
  negativeRecord: {
    backgroundColor: '#FFE4E1',
  },
  recordText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  recordPoints: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  positivePoints: {
    color: '#4CAF50',
  },
  negativePoints: {
    color: '#F44336',
  },
  recordTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 40,
  },
  noRecordsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRecordsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    fontStyle: 'italic',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007BFF',
    alignSelf: 'center',
    marginTop: 16,
  },
  refreshButtonText: {
    color: '#007BFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 評價相關樣式
  reviewOrder: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  noReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noReviewsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

