import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { HomeScreen, NotificationScreen, HistoryScreen, CreateOrderScreen, ProfileScreen } from './screens';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const DummyScreen = ({ title }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20 }}>{title}</Text>
  </View>
);

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  // 載入未讀通知數量
  const loadUnreadCount = async () => {
    try {
      const inbox = await AsyncStorage.getItem('inbox');
      if (inbox) {
        const notifications = JSON.parse(inbox);
        const unread = notifications.filter(n => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('載入未讀通知數量失敗:', error);
    }
  };

  // 組件掛載時載入未讀數量
  useEffect(() => {
    loadUnreadCount();
    
    // 設置定時器，每5秒檢查一次未讀數量
    const interval = setInterval(loadUnreadCount, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // 監聽導航參數變化，當通知頁面獲得焦點時更新未讀數量
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUnreadCount();
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Ionicons name="home" size={size} color={color} />;
          if (route.name === 'Orders') return <MaterialIcons name="list-alt" size={size} color={color} />;
          if (route.name === 'Create') return <Ionicons name="add-circle-outline" size={size} color={color} />;
          if (route.name === 'Notify') return <Ionicons name="notifications-outline" size={size} color={color} />;
          if (route.name === 'Profile') return <FontAwesome5 name="user-alt" size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007BFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首頁' }} />
      <Tab.Screen name="Orders" component={HistoryScreen} options={{ title: '訂單' }} />
      <Tab.Screen name="Create" component={CreateOrderScreen} options={{ title: '發起' }} />
      <Tab.Screen 
        name="Notify" 
        component={NotificationScreen} 
        options={{ 
          title: '通知',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#e53935',
            color: '#fff',
            fontSize: 12,
            minWidth: 18,
            height: 18,
            borderRadius: 9
          }
        }} 
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '個人' }} />
    </Tab.Navigator>
  );
}
