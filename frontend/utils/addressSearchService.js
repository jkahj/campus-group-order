// 地址搜尋服務
// 使用 Google Places API 進行地址搜尋

class AddressSearchService {
  constructor() {
    // 這裡需要設定您的 Google Places API Key
    // 請在 Google Cloud Console 中啟用 Places API 並取得 API Key
    this.apiKey = 'YOUR_GOOGLE_PLACES_API_KEY'; // 請替換為實際的 API Key
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
  }

  // 搜尋特定商店在指定地區的地址
  async searchStoreAddresses(storeName, location) {
    if (!storeName || !location) {
      return [];
    }

    try {
      // 使用 Text Search API 搜尋
      const query = `${storeName} ${location}`;
      const url = `${this.baseUrl}/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}&language=zh-TW&region=TW`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results) {
        return data.results.map(place => ({
          id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          rating: place.rating || 0,
          priceLevel: place.price_level || 0,
          location: place.geometry?.location,
          types: place.types || []
        }));
      } else {
        console.warn('地址搜尋失敗:', data.status);
        return [];
      }
    } catch (error) {
      console.error('地址搜尋錯誤:', error);
      return [];
    }
  }

  // 取得地點詳細資訊
  async getPlaceDetails(placeId) {
    try {
      const url = `${this.baseUrl}/details/json?place_id=${placeId}&key=${this.apiKey}&language=zh-TW&fields=name,formatted_address,geometry,rating,price_level,opening_hours`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        return {
          id: data.result.place_id,
          name: data.result.name,
          address: data.result.formatted_address,
          rating: data.result.rating || 0,
          priceLevel: data.result.price_level || 0,
          location: data.result.geometry?.location,
          openingHours: data.result.opening_hours
        };
      }
      return null;
    } catch (error) {
      console.error('取得地點詳細資訊錯誤:', error);
      return null;
    }
  }

  // 模擬搜尋結果（當沒有 API Key 時使用）
  getMockSearchResults(storeName, location) {
    const mockResults = {
      '好市多': [
        {
          id: 'mock_1',
          name: '好市多 台南店',
          address: '台南市北區文賢路1200號',
          rating: 4.2,
          priceLevel: 2,
          location: { lat: 23.0089, lng: 120.2069 }
        },
        {
          id: 'mock_2',
          name: '好市多 台南中華店',
          address: '台南市東區中華東路三段360號',
          rating: 4.1,
          priceLevel: 2,
          location: { lat: 22.9999, lng: 120.2333 }
        }
      ],
      '家樂福': [
        {
          id: 'mock_3',
          name: '家樂福 台南安平店',
          address: '台南市安平區中華西路二段36號',
          rating: 4.0,
          priceLevel: 1,
          location: { lat: 22.9967, lng: 120.1833 }
        }
      ],
      '全聯': [
        {
          id: 'mock_4',
          name: '全聯福利中心 台南成功店',
          address: '台南市東區成功路68號',
          rating: 3.8,
          priceLevel: 1,
          location: { lat: 22.9877, lng: 120.2133 }
        }
      ]
    };

    // 根據商店名稱和地點篩選結果
    const storeResults = mockResults[storeName] || [];
    return storeResults.filter(result => 
      result.address.includes(location) || 
      result.name.includes(location)
    );
  }

  // 主要搜尋方法
  async search(storeName, location) {
    // 如果沒有設定 API Key，使用模擬資料
    if (this.apiKey === 'YOUR_GOOGLE_PLACES_API_KEY') {
      console.log('使用模擬搜尋結果');
      return this.getMockSearchResults(storeName, location);
    }

    return await this.searchStoreAddresses(storeName, location);
  }
}

// 建立單例實例
const addressSearchService = new AddressSearchService();

export default addressSearchService;



