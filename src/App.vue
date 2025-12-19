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
      <span class="section-label">快捷搜索：</span>
      <button
        v-for="c in categories"
        :key="c.value"
        :class="{ active: c.value === activeCategory }"
        @click="setCategory(c.value)"
      >
        {{ c.label }}
      </button>
    </div>

    <div class="recommendation-groups">
      <span class="section-label">精选专栏 (2km内)：</span>
      <div class="group-buttons">
        <button 
          v-for="group in recommendGroups" 
          :key="group.label"
          class="rec-btn"
          @click="handleSpecialRecommend(group)"
        >
          <span class="rec-icon">{{ group.icon }}</span>
          {{ group.label }}
        </button>
      </div>
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
        <div class="radius-tip">当前搜索范围: {{ radius }}米</div>
      </section>

      <section class="list-wrapper">
        <h2>搜索结果 <span v-if="pois.length">({{ pois.length }})</span></h2>
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
            <div class="poi-type" v-if="poi.type">{{ poi.type.split(';')[0] }}</div>
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
      lng: 121.593478, 
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
      
      // 推荐专栏数据
      recommendGroups: [
        { 
          label: '休闲娱乐', 
          value: 'KTV|网吧|健身房|运动馆|电影院', 
          icon: '🎮',
          radius: 2000 
        },
        { 
          label: '饮食美食', 
          value: '超市|餐厅|奶茶店|小吃|火锅', 
          icon: '🍔',
          radius: 2000 
        },
        { 
          label: '个人护理', 
          value: '理发店|洗浴中心|美容院|足疗按摩', 
          icon: '💇',
          radius: 2000 
        },
        { 
          label: '医疗健康', 
          value: '综合医院|药店|诊所|社区卫生服务中心', 
          icon: '💊',
          radius: 2000 
        }
      ]
    };
  },
  mounted() {
    this.loadHistory();
    setTimeout(() => {
        this.initMap();
        this.locateUser();
    }, 100);
  },
  methods: {
    initMap() {
      if (!window.AMap) {
        this.errorMsg = '高德地图 SDK 未加载，请检查网络或 Key 配置';
        return;
      }
      if (this.map) this.map.destroy();

      this.map = new window.AMap.Map('map', {
        zoom: 14,
        center: [this.lng, this.lat],
        viewMode: '3D', 
        pitch: 0, 
        resizeEnable: true, 
        mapStyle: 'amap://styles/normal', 
        features: ['bg', 'road', 'building', 'point'] 
      });

      this.userMarker = new window.AMap.Marker({
        position: [this.lng, this.lat],
        title: '我的位置',
        content: '<div style="background:#409EFF;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
        anchor: 'center',
        map: this.map,
        zIndex: 999 
      });
      
      window.AMap.plugin(['AMap.ToolBar', 'AMap.Scale'], () => {
        this.map.addControl(new window.AMap.ToolBar());
        this.map.addControl(new window.AMap.Scale());
      });
    },

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
        }
      );
    },

    /** 搜索按钮点击 */
    handleSearch() {
      if (!this.keyword) {
        this.errorMsg = '请输入搜索关键字';
        return;
      }
      this.activeCategory = ''; 
      this.radius = 3000; 
      this.searchPOI(); 
    },

    /** 快捷分类点击 */
    setCategory(category) {
      this.keyword = category;
      this.activeCategory = category;
      this.radius = 3000; 
      this.searchPOI();
    },

    /** 处理专栏推荐搜索 (不改变输入框) */
    handleSpecialRecommend(group) {
      // 1. 设置专栏特定半径
      this.radius = group.radius;
      // 2. 清除快捷分类高亮
      this.activeCategory = '';      
      // 3. 直接把词传给搜索函数 
      this.searchPOI(group.value);
    },

    selectHistory(kw) {
      this.keyword = kw;
      this.radius = 3000; 
      this.searchPOI();
    },

    clearHistory() {
      this.history = [];
      localStorage.removeItem('shengtong_history');
    },

    // overrideKeywords: 如果传了这个参数，就用这个参数搜；否则搜输入框里的值
    async searchPOI(overrideKeywords = null) {
      // 确定实际要搜索的词
      const actualKeywords = (typeof overrideKeywords === 'string' && overrideKeywords) 
                             ? overrideKeywords 
                             : this.keyword;

      if (!actualKeywords) {
          this.errorMsg = '请输入搜索关键字';
          return;
      }

      this.loading = true;
      this.errorMsg = '';
      
      // 历史记录逻辑：只记录非组合词
      if (actualKeywords.indexOf('|') === -1) {
         this.saveHistory(actualKeywords);
      }

      try {
        const params = new URLSearchParams({
          lng: this.lng,
          lat: this.lat,
          radius: this.radius, 
          keywords: actualKeywords // ✨ 使用计算出的 actualKeywords
        });

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
    },
    
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
        try { this.history = JSON.parse(raw); } catch (e) {}
      }
    }
  }
};
</script>

<style scoped>
/* 样式保持不变 */
.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
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
  white-space: nowrap;
}
.section-label {
  font-size: 13px;
  font-weight: bold;
  color: #555;
  margin-right: 8px;
  align-self: center;
}
.categories, .recommendation-groups, .history {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.categories button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  background: #f8f8f8;
  color: #666;
  border-radius: 14px;
  font-size: 13px;
  cursor: pointer;
}
.categories button.active {
  background: #42b983;
  color: white;
  border-color: #42b983;
}
.group-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rec-btn {
  padding: 6px 12px;
  border: none;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1565c0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}
.rec-btn:hover {
  background: linear-gradient(135deg, #bbdefb, #90caf9);
  transform: translateY(-1px);
}
.rec-btn:nth-child(2) { background: linear-gradient(135deg, #fff3e0, #ffe0b2); color: #e65100; }
.rec-btn:nth-child(3) { background: linear-gradient(135deg, #f3e5f5, #e1bee7); color: #6a1b9a; }
.rec-btn:nth-child(4) { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); color: #2e7d32; }
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
.error {
  color: red;
  padding: 0 16px;
  font-size: 12px;
}
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.map-wrapper {
  flex: 2;
  position: relative;
  background: #f0f0f0;
}
.map {
  width: 100%;
  height: 100%;
}
.radius-tip {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  z-index: 100;
}
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
.poi-type {
  font-size: 12px;
  color: #409EFF;
  margin-top: 4px;
}
</style>