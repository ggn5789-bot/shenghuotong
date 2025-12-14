<template>
  <div class="app">
    <header class="header">
      <h1>生活通 · 附近生活服务查询</h1>
      <div class="search-bar">
        <input
          v-model.trim="keyword"
          type="text"
          placeholder="请输入搜索关键字 (如: 美食)"
          @keyup.enter="handleSearch"
        />
        <button @click="handleSearch" :disabled="loading">
          {{ loading ? '搜索中...' : '搜索' }}
        </button>
      </div>
    </header>

    <div class="categories">
      <button
        v-for="c in categories"
        :key="c.value"
        :class="{ active: c.value === activeCategory }"
        @click="setCategory(c.value)"
      >
        {{ c.label }}
      </button>
    </div>

    <div class="recommendation">
      <button @click="handleRecommend">生活服务推荐</button>
    </div>

    <div v-if="history.length" class="history">
      <span class="history-label">历史记录：</span>
      <button
        v-for="h in history"
        :key="h"
        class="history-item"
        @click="selectHistory(h)"
      >
        {{ h }}
      </button>
      <button class="history-clear" @click="clearHistory">清空</button>
    </div>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <main class="main">
      <section class="map-wrapper">
        <div id="map" class="map"></div>
      </section>

      <section class="list-wrapper">
        <h2>搜索结果</h2>
        <p v-if="loading">正在搜索中，请稍候...</p>
        <p v-else-if="pois.length === 0">暂时没有结果，请尝试其他关键字或移动地图位置。</p>

        <ul v-else class="poi-list">
          <li
            v-for="poi in pois"
            :key="poi.id"
            class="poi-item"
            @click="focusPOI(poi)"
          >
            <div class="poi-name">{{ poi.name }}</div>
            <div class="poi-address">{{ poi.address || '地址未知' }}</div>
            <div class="poi-meta">
              <span>距离：{{ poi.distance }} m</span>
              <span v-if="poi.tel && typeof poi.tel === 'string'">电话：{{ poi.tel.split(';')[0] }}</span>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      keyword: '', // 输入框的值
      lng: 121.6, // 初始经度 (大连)
      lat: 38.9,  // 初始纬度
      radius: 3000, // 搜索半径
      loading: false,
      errorMsg: '',
      map: null,
      markers: [],
      userMarker: null, // 存储用户位置标记实例
      pois: [],
      history: [],
      maxHistory: 5,
      categories: [
        { label: '超市', value: '超市' },
        { label: '餐饮', value: '餐饮' },
        { label: '医院', value: '医院' },
        { label: '公交站', value: '公交站' }
      ],
      activeCategory: '',
    };
  },
  mounted() {
    this.loadHistory();
    this.initMap();
    this.locateUser(); // 尝试定位用户，并更新地图中心和标记
  },
  methods: {
    /** 初始化高德地图 */
    initMap() {
      if (!window.AMap) {
        this.errorMsg = '高德地图 SDK 未加载，请检查 index.html 配置';
        return;
      }

      // 创建地图实例
      this.map = new window.AMap.Map('map', {
        zoom: 13,
        center: [this.lng, this.lat],
        viewMode: '2D'
      });

      // 创建并存储用户位置标记，使用更明显的样式
      this.userMarker = new window.AMap.Marker({
        position: [this.lng, this.lat],
        title: '我的位置',
        content: '<div style="background:#409EFF;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 5px rgba(0, 0, 0, 0.3);"></div>',
        anchor: 'center',
        map: this.map
      });
    },

    /** 浏览器定位 */
    locateUser() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lng = pos.coords.longitude;
          this.lat = pos.coords.latitude;
          
          const newCenter = [this.lng, this.lat];

          if (this.map) {
            this.map.setCenter(newCenter);
            
            // 更新用户位置的 marker
            if (this.userMarker) {
              this.userMarker.setPosition(newCenter);
            }
          }
        },
        (err) => {
          console.warn('定位失败，使用默认坐标', err);
        }
      );
    },

    /** 搜索入口 */
    handleSearch() {
      if (!this.keyword) {
        this.errorMsg = '请输入搜索关键字';
        return;
      }
      this.activeCategory = ''; // 清除分类高亮
      this.searchPOI(); // 调用实际搜索方法
    },

    /** 点击“生活服务推荐” */
    handleRecommend() {
      this.keyword = '生活服务';
      this.searchPOI();
    },

    /** 点击分类 */
    setCategory(category) {
      this.keyword = category;
      this.activeCategory = category;
      this.searchPOI();
    },

    /** 点击历史记录 */
    selectHistory(kw) {
      this.keyword = kw;
      this.searchPOI();
    },

    /** 清空历史 */
    clearHistory() {
      this.history = [];
      localStorage.removeItem('shengtong_history');
    },

    /** 核心：调用后端 API */
    async searchPOI() {
      this.loading = true;
      this.errorMsg = '';
      this.saveHistory(this.keyword);

      try {
        // 构造参数，注意这里 key 必须叫 'keywords' 以匹配 api/search.js
        const params = new URLSearchParams({
          lng: this.lng,
          lat: this.lat,
          radius: this.radius,
          keywords: this.keyword
        });

        // 发送请求到 Vercel Serverless Function
        const resp = await fetch(`/api/search?${params.toString()}`);
        
        if (!resp.ok) {
           throw new Error(`HTTP error! status: ${resp.status}`);
        }

        const result = await resp.json();

        // 检查后端自定义状态码
        if (result.status !== 1) {
          this.errorMsg = result.info || '搜索服务出错';
          this.pois = [];
          this.clearMarkers();
          return;
        }

        // 解析数据：api/search.js 返回结构为 { status: 1, data: { status: '1', pois: [...] } }
        const amapData = result.data || {};
        
        if (amapData.pois && Array.isArray(amapData.pois)) {
          this.pois = amapData.pois;
          this.showMarkers(this.pois);
        } else {
          this.pois = [];
          this.clearMarkers();
        }

      } catch (err) {
        console.error(err);
        // 捕获 HTTP error status 500 等网络或服务器错误
        this.errorMsg = '网络请求失败：' + err.message; 
      } finally {
        this.loading = false;
      }
    },

    /** 在地图上显示标记 */
    showMarkers(pois) {
      if (!this.map) return;
      
      this.clearMarkers(); // 清除旧标记

      const bounds = new window.AMap.Bounds();
      
      pois.forEach((poi) => {
        if (!poi.location) return;
        const [lng, lat] = poi.location.split(',').map(Number);
        
        const marker = new window.AMap.Marker({
          position: [lng, lat],
          title: poi.name,
          map: this.map,
          extData: poi // 存入数据以便点击获取
        });

        // 绑定点击事件
        marker.on('click', () => {
          this.focusPOI(poi);
        });

        this.markers.push(marker);
        bounds.extend([lng, lat]);
      });

      // 自动调整视野以包含所有标记
      if (this.markers.length > 0) {
        this.map.setFitView(this.markers);
      }
    },

    /** 清除地图上的标记 */
    clearMarkers() {
      if (this.map && this.markers.length > 0) {
        this.map.remove(this.markers);
        this.markers = [];
      }
    },

    /** 列表/Marker 点击高亮 */
    focusPOI(poi) {
      if (!poi.location || !this.map) return;
      const [lng, lat] = poi.location.split(',').map(Number);
      
      this.map.setZoomAndCenter(17, [lng, lat]);
      
      // 可以添加信息窗体 (InfoWindow)
      const infoWindow = new window.AMap.InfoWindow({
        content: `<div style="padding:5px;"><b>${poi.name}</b><br/>${poi.address}</div>`,
        offset: new window.AMap.Pixel(0, -30)
      });
      infoWindow.open(this.map, [lng, lat]);
    },

    /** 历史记录管理 */
    saveHistory(val) {
      if (!val) return;
      const idx = this.history.indexOf(val);
      if (idx !== -1) this.history.splice(idx, 1);
      this.history.unshift(val);
      if (this.history.length > this.maxHistory) this.history.pop();
      localStorage.setItem('shengtong_history', JSON.stringify(this.history));
    },

    loadHistory() {
      const raw = localStorage.getItem('shengtong_history');
      if (raw) {
        try {
          this.history = JSON.parse(raw);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
};
</script>

<style scoped>
/* 样式部分保持不变，确保了布局的完整性 */
.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶部样式 */
.header {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background: #fff;
}
.header h1 {
  margin: 0 0 10px;
  font-size: 18px;
  color: #333;
}
.search-bar {
  display: flex;
  gap: 8px;
}
.search-bar input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.search-bar button {
  padding: 8px 16px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.search-bar button:disabled {
  background-color: #a0dcb6;
}

/* 分类与历史 */
.categories, .recommendation, .history {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.categories button, .recommendation button {
  padding: 4px 12px;
  border: 1px solid #42b983;
  background: white;
  color: #42b983;
  border-radius: 14px;
  font-size: 13px;
  cursor: pointer;
}
.categories button.active {
  background: #42b983;
  color: white;
}
.history {
  font-size: 12px;
  color: #666;
  border-bottom: 1px solid #f0f0f0;
}
.history-item {
  background: #f5f5f5;
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}
.history-clear {
  margin-left: auto;
  border: none;
  background: none;
  color: #999;
  cursor: pointer;

/* 错误信息 */
.error {
  color: red;
  padding: 0 16px;
  font-size: 12px;
}

/* 主体布局 */
.main {
  flex: 1;
  display: flex;
  overflow: hidden; /* 防止双滚动条 */
}

/* 地图 */
.map-wrapper {
  flex: 2;
  position: relative;
}
.map {
  width: 100%;
  height: 100%;
}

/* 列表 */
.list-wrapper {
  flex: 1;
  min-width: 300px;
  border-left: 1px solid #ddd;
  overflow-y: auto;
  padding: 10px;
  background: #fff;
}
.poi-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.poi-item {
  padding: 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}
.poi-item:hover {
  background-color: #f9f9f9;
}
.poi-name {
  font-weight: bold;
  font-size: 15px;
  margin-bottom: 4px;
}
.poi-address {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.poi-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
}
</style>
