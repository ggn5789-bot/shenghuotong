<template>
  <div class="app">
    <!-- 顶部搜索栏 -->
    <header class="header">
      <h1>生活通 · 附近生活服务查询</h1>
      <div class="search-bar">
        <input
          v-model.trim="keyword"
          type="text"
          placeholder="请输入搜索关键字"
          @keyup.enter="handleSearch"
        />
        <button @click="handleSearch" :disabled="loading">
          {{ loading ? '搜索中...' : '搜索' }}
        </button>
      </div>
    </header>

    <!-- 分类快捷按钮 -->
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

    <!-- 搜索历史 -->
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

    <!-- 错误提示 -->
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <!-- 主体区域：左地图 + 右列表 -->
    <main class="main">
      <section class="map-wrapper">
        <div id="map" class="map"></div>
      </section>

      <section class="list-wrapper">
        <h2>搜索结果</h2>
        <p v-if="loading">正在搜索中，请稍候...</p>
        <p v-else-if="pois.length === 0">暂时没有结果，请尝试其他关键字。</p>

        <ul v-else class="poi-list">
          <li
            v-for="poi in pois"
            :key="poi.name + poi.location"
            class="poi-item"
            @click="focusPOI(poi)"
          >
            <div class="poi-name">{{ poi.name }}</div>
            <div class="poi-address">{{ poi.address || '地址未知' }}</div>
            <div class="poi-meta">
              <span>距离：{{ poi.distance }} m</span>
              <span v-if="poi.rating">评分：{{ poi.rating }}</span>
              <span v-if="poi.location">坐标：{{ poi.location }}</span>
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
      keyword: '', // 搜索关键字
      lng: 121.6, // 初始经度
      lat: 38.9,  // 初始纬度
      radius: 2000, // 搜索半径
      loading: false, // 加载状态
      errorMsg: '', // 错误消息
      map: null, // 地图实例
      markers: [], // 地图标记
      pois: [], // 搜索结果
      history: [], // 搜索历史
      maxHistory: 5, // 最大历史记录数
      categories: [
        { label: '超市', value: '超市' },
        { label: '餐饮', value: '餐饮' },
        { label: '医院', value: '医院' },
        { label: '公交站', value: '公交站' }
      ], // 分类快捷按钮
      activeCategory: '', // 当前选中的分类
    };
  },
  mounted() {
    this.loadHistory();
    this.initMap();
    this.locateUser();
  },
  methods: {
    /** 初始化高德地图 */
    initMap() {
      if (!window.AMap) {
        this.errorMsg = '高德地图 SDK 加载失败，请检查 index.html 中的 script 引用';
        return;
      }

      this.map = new window.AMap.Map('map', {
        zoom: 14,
        center: [this.lng, this.lat]
      });

      // 标记当前位置
      new window.AMap.Marker({
        position: [this.lng, this.lat],
        title: '当前位置',
        map: this.map
      });
    },

    /** 尝试浏览器定位，更新中心点 */
    locateUser() {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lng = pos.coords.longitude;
          this.lat = pos.coords.latitude;
          if (this.map) {
            this.map.setCenter([this.lng, this.lat]);
          }
        },
        (err) => {
          console.warn('定位失败，使用默认坐标', err);
        }
      );
    },

    /** 点击搜索按钮或回车 */
    handleSearch() {
      if (!this.keyword) {
        this.errorMsg = '请输入搜索关键字';
        return;
      }
      this.errorMsg = '';
      this.activeCategory = '';
      this.searchPOI();
    },

    /** 设置分类关键字并搜索 */
    setCategory(category) {
      this.keyword = category;
      this.activeCategory = category;
      this.errorMsg = '';
      this.searchPOI();
    },

    /** 选择历史记录 */
    selectHistory(kw) {
      this.keyword = kw;
      this.errorMsg = '';
      this.searchPOI();
    },

    /** 清空历史 */
    clearHistory() {
      this.history = [];
      localStorage.removeItem('shengtong_history');
    },

    /** 调用后端 /api/search */
    async searchPOI() {
      this.loading = true;

      try {
        const params = new URLSearchParams({
          keywords: this.keyword,
          lng: this.lng,
          lat: this.lat,
          radius: this.radius
        });

        const resp = await fetch(`/api/search?${params.toString()}`);
        const result = await resp.json();

        if (result.status !== 1) {
          this.errorMsg = result.info || '搜索失败，请稍后重试';
          this.pois = [];
          this.clearMarkers();
          return;
        }

        this.pois = Array.isArray(result.data) ? result.data : [];
        this.errorMsg = '';

        // 保存历史记录
        this.saveHistory(this.keyword);

        // 更新地图标记
        this.showMarkers(this.pois);
      } catch (err) {
        console.error(err);
        this.errorMsg = '网络异常：' + err.message;
      } finally {
        this.loading = false;
      }
    },

    /** 清除旧的 Marker */
    clearMarkers() {
      if (!this.markers || !this.markers.length) return;
      this.markers.forEach((m) => m.setMap(null));
      this.markers = [];
    },

    /** 在地图上展示 marker */
    showMarkers(pois) {
      if (!this.map || !Array.isArray(pois)) return;  // 确保 pois 是数组

      this.clearMarkers();

      const bounds = new window.AMap.Bounds();

      pois.forEach((poi) => {
        if (!poi.location) return;
        const [lng, lat] = poi.location.split(',').map(Number);
        if (Number.isNaN(lng) || Number.isNaN(lat)) return;

        const marker = new window.AMap.Marker({
          position: [lng, lat],
          title: poi.name,
          map: this.map
        });

        this.markers.push(marker);
        bounds.extend([lng, lat]);
      });

      if (this.markers.length) {
        this.map.setFitView(this.markers);
      }
    },

    /** 列表点击，地图居中放大 */
    focusPOI(poi) {
      if (!poi.location || !this.map) return;
      const [lng, lat] = poi.location.split(',').map(Number);
      if (Number.isNaN(lng) || Number.isNaN(lat)) return;

      this.map.setZoom(17);
      this.map.setCenter([lng, lat]);
    },

    /** 保存搜索历史 */
    saveHistory(keyword) {
      const kw = keyword.trim();
      if (!kw) return;

      const existsIndex = this.history.indexOf(kw);
      if (existsIndex !== -1) {
        // 存在就提前
        this.history.splice(existsIndex, 1);
      }
      this.history.unshift(kw);
      if (this.history.length > this.maxHistory) {
        this.history = this.history.slice(0, this.maxHistory);
      }

      localStorage.setItem('shengtong_history', JSON.stringify(this.history));
    },

    /** 加载历史 */
    loadHistory() {
      try {
        const raw = localStorage.getItem('shengtong_history');
        if (raw) {
          this.history = JSON.parse(raw);
        }
      } catch (e) {
        console.warn('读取历史记录失败', e);
      }
    }
  }
};
</script>

<style scoped>
.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, 'Noto Sans', sans-serif;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}

.header h1 {
  margin: 0 0 8px;
  font-size: 20px;
}

.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.search-bar input {
  flex: 1;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.search-bar button {
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  background-color: #42b983;
  color: #fff;
  cursor: pointer;
}

.search-bar button:disabled {
  opacity: 0.7;
  cursor: default;
}

.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.categories button {
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid #42b983;
  background: #fff;
  color: #42b983;
  cursor: pointer;
  font-size: 12px;
}

.categories button.active {
  background: #42b983;
  color: #fff;
}

.history {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.history-label {
  color: #666;
}

.history-item {
  border: none;
  background: #f0f0f0;
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
}

.history-clear {
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
}

.error {
  color: #e74c3c;
  margin-top: 4px;
}

.main {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 左地图 */
.map-wrapper {
  flex: 2;
}

.map {
  width: 100%;
  height: 100%;
}

/* 右列表 */
.list-wrapper {
  flex: 1;
  border-left: 1px solid #eee;
  padding: 8px;
  overflow-y: auto;
}

.list-wrapper h2 {
  margin-top: 0;
  font-size: 16px;
}

.poi-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.poi-item {
  padding: 8px 4px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.poi-item:hover {
  background: #f9f9f9;
}

.poi-name {
  font-weight: bold;
  margin-bottom: 2px;
}

.poi-address {
  font-size: 12px;
  color: #666;
}

.poi-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  justify-content: space-between;
}
</style>
