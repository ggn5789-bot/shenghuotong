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
      keyword: '',
      lng: 121.593478, // 使用一个更精确的大连坐标
      lat: 38.94871,
      radius: 3000,
      loading: false,
      errorMsg: '',
      map: null,
      markers: [],
      userMarker: null,
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
    // 延迟一点加载地图，确保容器已渲染
    setTimeout(() => {
        this.initMap();
        this.locateUser();
    }, 100);
  },
  methods: {
    /** 初始化高德地图 */
    initMap() {
      if (!window.AMap) {
        this.errorMsg = '高德地图 SDK 未加载，请检查网络或 Key 配置';
        return;
      }

      // 销毁旧地图实例（如果存在）
      if (this.map) this.map.destroy();

      // ✨ 关键修改：使用 3D 视图模式，这在 Vercel 等环境中渲染更稳定
      this.map = new window.AMap.Map('map', {
        zoom: 14,
        center: [this.lng, this.lat],
        viewMode: '3D',  // 修改为 3D
        pitch: 0,        // 俯仰角 0，看起来像 2D
        resizeEnable: true, // 允许自动适应容器大小
        mapStyle: 'amap://styles/normal', // 强制指定标准样式
        features: ['bg', 'road', 'building', 'point'] // 强制显示背景、道路、建筑
      });

      // 创建用户位置标记
      this.userMarker = new window.AMap.Marker({
        position: [this.lng, this.lat],
        title: '我的位置',
        content: '<div style="background:#409EFF;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
        anchor: 'center',
        map: this.map,
        zIndex: 999 // 确保在最上层
      });
      
      // 添加比例尺和缩放工具（可选，有助于调试地图是否活着）
      window.AMap.plugin(['AMap.ToolBar', 'AMap.Scale'], () => {
        this.map.addControl(new window.AMap.ToolBar());
        this.map.addControl(new window.AMap.Scale());
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
            if (this.userMarker) {
              this.userMarker.setPosition(newCenter);
            }
          }
        },
        (err) => {
          console.warn('定位失败/被拒绝，保持默认坐标', err);
          // 不报错，静默失败，避免打扰用户
        }
      );
    },

    handleSearch() {
      if (!this.keyword) {
        this.errorMsg = '请输入搜索关键字';
        return;
      }
      this.activeCategory = ''; 
      this.searchPOI(); 
    },

    handleRecommend() {
      this.keyword = '生活服务';
      this.searchPOI();
    },

    setCategory(category) {
      this.keyword = category;
      this.activeCategory = category;
      this.searchPOI();
    },

    selectHistory(kw) {
      this.keyword = kw;
      this.searchPOI();
    },

    clearHistory() {
      this.history = [];
      localStorage.removeItem('shengtong_history');
    },

    async searchPOI() {
      this.loading = true;
      this.errorMsg = '';
      this.saveHistory(this.keyword);

      try {
        const params = new URLSearchParams({
          lng: this.lng,
          lat: this.lat,
          radius: this.radius,
          keywords: this.keyword
        });

        // 调用后端
        const resp = await fetch(`/api/search?${params.toString()}`);
        if (!resp.ok) throw new Error(`Status: ${resp.status}`);

        const result = await resp.json();

        if (result.status !== 1) {
          this.errorMsg = result.info || '搜索服务出错';
          this.pois = [];
          this.clearMarkers();
          return;
        }

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
        this.errorMsg = '网络请求失败，请检查网络'; 
      } finally {
        this.loading = false;
      }
    },

    showMarkers(pois) {
      if (!this.map) return;
      this.clearMarkers();

      const bounds = new window.AMap.Bounds();
      
      pois.forEach((poi) => {
        if (!poi.location) return;
        const [lng, lat] = poi.location.split(',').map(Number);
        
        const marker = new window.AMap.Marker({
          position: [lng, lat],
          title: poi.name,
          map: this.map,
          extData: poi 
        });

        marker.on('click', () => {
          this.focusPOI(poi);
        });

        this.markers.push(marker);
        bounds.extend([lng, lat]);
      });

      if (this.markers.length > 0) {
        this.map.setFitView(this.markers);
      }
    },

    clearMarkers() {
      if (this.map && this.markers.length > 0) {
        this.map.remove(this.markers);
        this.markers = [];
      }
    },

    focusPOI(poi) {
      if (!poi.location || !this.map) return;
      const [lng, lat] = poi.location.split(',').map(Number);
      
      this.map.setZoomAndCenter(17, [lng, lat]);
      
      const infoWindow = new window.AMap.InfoWindow({
        content: `<div style="padding:5px;font-size:13px;"><b>${poi.name}</b><br/>${poi.address}</div>`,
        offset: new window.AMap.Pixel(0, -30)
      });
      infoWindow.open(this.map, [lng, lat]);
    }
    
    // ... loadHistory 和 saveHistory 保持不变 ...
    ,saveHistory(val) {
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
        try { this.history = JSON.parse(raw); } catch (e) {}
      }
    }
  }
};
</script>

<style scoped>
/* 样式保持不变，但为了保险，请确认 map 的高度 */
.map-wrapper {
  flex: 2;
  position: relative;
  background: #f0f0f0; /* 添加一个背景色，防止地图加载慢时全白 */
}
.map {
  width: 100%;
  height: 100%;
  min-height: 400px; /* 增加最小高度防止塌陷 */
}
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
}

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