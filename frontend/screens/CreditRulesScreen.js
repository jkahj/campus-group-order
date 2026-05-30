import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CREDIT_RULES, TIER_DEFINITIONS } from '../utils/creditScoreManager';

export default function CreditRulesScreen() {
  const navigation = useNavigation();

  // 渲染積分規則項目
  const renderRuleItem = (icon, title, points, description, color = '#333') => (
    <View style={styles.ruleItem}>
      <View style={styles.ruleIcon}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.ruleContent}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleDescription}>{description}</Text>
      </View>
      <View style={styles.rulePoints}>
        <Text style={[
          styles.pointsText,
          { color: points >= 0 ? '#4CAF50' : '#F44336' }
        ]}>
          {points >= 0 ? '+' : ''}{points}分
        </Text>
      </View>
    </View>
  );

  // 渲染等級說明
  const renderTierItem = (tierName, tierInfo) => (
    <View style={styles.tierItem}>
      <View style={styles.tierHeader}>
        <Ionicons name={tierInfo.icon} size={32} color={tierInfo.color} />
        <Text style={[styles.tierName, { color: tierInfo.color }]}>{tierName}</Text>
      </View>
      <View style={styles.tierRange}>
        <Text style={styles.tierRangeText}>
          {tierInfo.minScore} - {tierInfo.maxScore} 分
        </Text>
      </View>
      <View style={styles.tierBenefits}>
        <Text style={styles.tierBenefitsTitle}>等級特權：</Text>
        {tierName === '掰咖' && (
          <Text style={styles.tierBenefitText}>• 基本代購功能</Text>
        )}
        {tierName === '買咖' && (
          <>
            <Text style={styles.tierBenefitText}>• 可發起代購</Text>
            <Text style={styles.tierBenefitText}>• 優先顯示</Text>
          </>
        )}
        {tierName === '團咖' && (
          <>
            <Text style={styles.tierBenefitText}>• 可發起團購</Text>
            <Text style={styles.tierBenefitText}>• 特殊標籤</Text>
            <Text style={styles.tierBenefitText}>• 推薦優先</Text>
          </>
        )}
        {tierName === '咖王' && (
          <>
            <Text style={styles.tierBenefitText}>• 所有功能解鎖</Text>
            <Text style={styles.tierBenefitText}>• VIP 標籤</Text>
            <Text style={styles.tierBenefitText}>• 客服優先</Text>
          </>
        )}
        {tierName === '咖皇' && (
          <>
            <Text style={styles.tierBenefitText}>• 最高等級特權</Text>
            <Text style={styles.tierBenefitText}>• 專屬客服</Text>
            <Text style={styles.tierBenefitText}>• 特殊活動優先</Text>
          </>
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
        <Text style={styles.headerTitle}>信譽積分規則</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* 積分系統介紹 */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>信譽積分系統</Text>
          <Text style={styles.introDescription}>
            信譽積分是衡量用戶在代購平台表現的重要指標。通過良好的行為獲得積分，提升等級，享受更多特權。
          </Text>
        </View>

        {/* 發起代購者積分規則 */}
        <View style={styles.rulesSection}>
          <Text style={styles.sectionTitle}>發起代購者積分規則</Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>訂單完成相關</Text>
            {renderRuleItem('checkmark-circle', '訂單完成', CREDIT_RULES.initiator.orderCompleted, '成功完成代購訂單')}
            {renderRuleItem('close-circle', '訂單未完成', CREDIT_RULES.initiator.orderIncomplete, '未能完成代購訂單')}
            {renderRuleItem('close-circle', '訂單取消', CREDIT_RULES.initiator.orderCancelled, '主動取消代購訂單')}
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>送達時間相關</Text>
            {renderRuleItem('time', '準時送達', CREDIT_RULES.initiator.onTimeDelivery, '在約定時間內送達')}
            {renderRuleItem('time-outline', '延遲送達', CREDIT_RULES.initiator.lateDelivery, '超過約定時間送達')}
            {renderRuleItem('warning', '嚴重延遲', CREDIT_RULES.initiator.veryLateDelivery, '嚴重超過約定時間')}
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>溝通品質</Text>
            {renderRuleItem('chatbubble', '良好溝通', CREDIT_RULES.initiator.goodCommunication, '與參與者保持良好溝通')}
            {renderRuleItem('chatbubble-outline', '溝通不良', CREDIT_RULES.initiator.poorCommunication, '溝通不及時或不清晰')}
            {renderRuleItem('close-circle', '無溝通', CREDIT_RULES.initiator.noCommunication, '完全沒有與參與者溝通')}
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>服務品質</Text>
            {renderRuleItem('star', '優質服務', CREDIT_RULES.initiator.excellentService, '提供超出預期的優質服務')}
            {renderRuleItem('thumbs-up', '良好服務', CREDIT_RULES.initiator.goodService, '提供符合預期的良好服務')}
            {renderRuleItem('thumbs-down', '服務不佳', CREDIT_RULES.initiator.poorService, '服務品質低於預期')}
          </View>
        </View>

        {/* 參與者積分規則 */}
        <View style={styles.rulesSection}>
          <Text style={styles.sectionTitle}>參與者積分規則</Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>取貨相關</Text>
            {renderRuleItem('checkmark-circle', '準時取貨', CREDIT_RULES.participant.onTimePickup, '在約定時間內取貨')}
            {renderRuleItem('time-outline', '延遲取貨', CREDIT_RULES.participant.latePickup, '超過約定時間取貨')}
            {renderRuleItem('close-circle', '未取貨', CREDIT_RULES.participant.noPickup, '完全沒有取貨')}
            {renderRuleItem('arrow-up-circle', '提前取貨', CREDIT_RULES.participant.earlyPickup, '提前取貨，方便代購者')}
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>評價相關</Text>
            {renderRuleItem('star', '極佳評價', CREDIT_RULES.participant.excellentFeedback, '給予代購者極佳評價')}
            {renderRuleItem('thumbs-up', '好評', CREDIT_RULES.participant.goodFeedback, '給予代購者好評')}
            {renderRuleItem('thumbs-down', '差評', CREDIT_RULES.participant.badFeedback, '給予代購者差評')}
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>參與度</Text>
            {renderRuleItem('people', '積極參與', CREDIT_RULES.participant.activeParticipation, '積極參與代購活動')}
            {renderRuleItem('chatbubble', '有幫助留言', CREDIT_RULES.participant.helpfulComment, '發表有幫助的留言')}
            {renderRuleItem('close-circle', '垃圾留言', CREDIT_RULES.participant.spamComment, '發表無意義或垃圾留言')}
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>付款相關</Text>
            {renderRuleItem('card', '準時付款', CREDIT_RULES.participant.onTimePayment, '在約定時間內付款')}
            {renderRuleItem('time-outline', '延遲付款', CREDIT_RULES.participant.latePayment, '超過約定時間付款')}
            {renderRuleItem('close-circle', '未付款', CREDIT_RULES.participant.noPayment, '完全沒有付款')}
          </View>
        </View>

        {/* 特殊獎勵規則 */}
        <View style={styles.rulesSection}>
          <Text style={styles.sectionTitle}>特殊獎勵規則</Text>
          
          {renderRuleItem('star', '首次代購', CREDIT_RULES.special.firstOrder, '完成人生第一次代購', '#FFD700')}
          {renderRuleItem('trophy', '里程碑訂單', CREDIT_RULES.special.milestoneOrder, '完成第10、50、100單等里程碑', '#FFD700')}
          {renderRuleItem('leaf', '季節性獎勵', CREDIT_RULES.special.seasonalBonus, '在特定季節完成代購', '#FFD700')}
          {renderRuleItem('people', '推薦新用戶', CREDIT_RULES.special.referralBonus, '成功推薦新用戶註冊', '#FFD700')}
          {renderRuleItem('heart', '社區貢獻', CREDIT_RULES.special.communityContribution, '為社區做出特殊貢獻', '#FFD700')}
        </View>

        {/* 等級說明 */}
        <View style={styles.rulesSection}>
          <Text style={styles.sectionTitle}>等級說明</Text>
          
          {Object.entries(TIER_DEFINITIONS).map(([tierName, tierInfo]) => 
            renderTierItem(tierName, tierInfo)
          )}
        </View>

        {/* 注意事項 */}
        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>注意事項</Text>
          <Text style={styles.noticeText}>• 積分不會低於0分</Text>
          <Text style={styles.noticeText}>• 惡意刷分會被扣除積分</Text>
          <Text style={styles.noticeText}>• 等級提升後不會降級（除非積分低於門檻）</Text>
          <Text style={styles.noticeText}>• 系統會定期審核積分變化</Text>
          <Text style={styles.noticeText}>• 如有疑問請聯繫客服</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  introSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f90',
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  introDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  rulesSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  subsection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ruleIcon: {
    marginRight: 16,
    width: 24,
  },
  ruleContent: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ruleDescription: {
    fontSize: 14,
    color: '#666',
  },
  rulePoints: {
    marginLeft: 16,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tierItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  tierRange: {
    marginBottom: 12,
  },
  tierRangeText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  tierBenefits: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  tierBenefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tierBenefitText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    marginLeft: 8,
  },
  noticeSection: {
    backgroundColor: '#fff3cd',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
    lineHeight: 20,
  },
});

