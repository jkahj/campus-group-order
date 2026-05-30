import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function TierRulesScreen({ navigation }) {
  const tiers = [
    {
      name: '掰咖',
      icon: 'user-times',
      scoreRange: '(0-99)',
      privileges: [
        '可發起公開代購',
        '可查看發起代購',
      ],
      restrictions: ['暫無懲罰項目'],
      color: '#DC143C',
      iconColor: '#DC143C',
    },
    {
      name: '買咖',
      icon: 'shopping-bag',
      scoreRange: '(100-199)',
      privileges: [
        '可加入公開團購',
        '可發起小型團購',
        '獲得小型團購資格',
        '管理團購主頁',
      ],
      restrictions: [],
      color: '#FF8C00',
      iconColor: '#FF8C00',
    },
    {
      name: '團咖',
      icon: 'users',
      scoreRange: '(200-299)',
      privileges: [
        '可申請商品團購',
        '獲得專案團購權限',
        '可發起專案團購',
        '定期舉辦團購活動',
      ],
      restrictions: [],
      color: '#4169E1',
      iconColor: '#4169E1',
    },
    {
      name: '咖王',
      icon: 'crown',
      scoreRange: '(300-399)',
      privileges: [
        '可設立私人團 (邀請制)',
        '平台專屬小幫手',
        '每月專屬抽獎資格',
        '擁有專屬客服專員',
      ],
      restrictions: [],
      color: '#8B4513',
      iconColor: '#8B4513',
    },
    {
      name: '咖皇',
      icon: 'star',
      scoreRange: '400 up',
      privileges: [
        '平台專屬代購機制',
        '專屬客服專員',
        '每月專屬抽獎資格',
        '優先預約新功能',
        '私人活動專屬',
      ],
      restrictions: [],
      color: '#FFD700',
      iconColor: '#FFD700',
    },
  ];

  const renderTierRow = (tier, index) => (
    <View key={index} style={styles.tierRow}>
      {/* 分級 */}
      <View style={styles.tierColumn}>
        <View style={[styles.tierIcon, { backgroundColor: tier.color + '20' }]}>
          <FontAwesome5 
            name={tier.icon} 
            size={20} 
            color={tier.iconColor} 
          />
        </View>
        <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
      </View>

      {/* 分數範圍 */}
      <View style={styles.scoreColumn}>
        <Text style={styles.scoreRange}>{tier.scoreRange}</Text>
      </View>

      {/* 權限特權 */}
      <View style={styles.privilegesColumn}>
        {tier.privileges.map((privilege, idx) => (
          <View key={`privilege-${tier.name}-${idx}`} style={styles.privilegeItem}>
            <View style={[styles.bulletPoint, { backgroundColor: tier.color }]} />
            <Text style={styles.privilegeText}>{privilege}</Text>
          </View>
        ))}
      </View>

      {/* 限制懲罰 */}
      <View style={styles.restrictionsColumn}>
        {tier.restrictions.length > 0 ? (
          tier.restrictions.map((restriction, idx) => (
            <View key={`restriction-${tier.name}-${idx}`} style={styles.restrictionItem}>
              <Ionicons name="warning" size={16} color="#FFA500" />
              <Text style={styles.restrictionText}>{restriction}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noRestrictions}>無限制</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>分級規則</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 表格標題 */}
        <View style={styles.tableHeader}>
          <View style={[styles.headerColumn, { flex: 1 }]}>
            <Text style={styles.headerText}>分級</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 1 }]}>
            <Text style={styles.headerText}>分數範圍</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 2 }]}>
            <Text style={styles.headerText}>權限特權</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 1 }]}>
            <Text style={styles.headerText}>限制懲罰</Text>
          </View>
        </View>

        {/* 分級內容 */}
        {tiers.map((tier, index) => (
          <View key={`tier-${tier.name}-${index}`}>
            {renderTierRow(tier, index)}
          </View>
        ))}

        {/* 說明文字 */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>分級說明</Text>
          <Text style={styles.infoText}>
            信譽積分系統根據用戶在平台上的行為表現進行評分，包括準時取貨、準時送達、評價質量等。
            積分越高，享有的權限和特權越多，能夠參與更高級的團購活動。
          </Text>
        </View>
      </ScrollView>
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
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  headerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flex: 1,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    minHeight: 120,
    alignItems: 'stretch',
  },
  tierColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tierIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  scoreRange: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  privilegesColumn: {
    flex: 2,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  privilegeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    flexShrink: 0,
  },
  privilegeText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
  },
  restrictionsColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  restrictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'center',
  },
  restrictionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    textAlign: 'center',
  },
  noRestrictions: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

