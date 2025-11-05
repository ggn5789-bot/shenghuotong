<template>
  <div id="app">
    <div id="map-container" style="height: 100vh;"></div>
    <PoiSearch @search="searchPOI"></PoiSearch>
  </div>
</template>


<script>
// 引入 POI 搜索组件
import PoiSearch from './components/PoiSearch.vue';
import axios from 'axios';

export default {
  name: 'App',
  components: {
    PoiSearch
  },
  data() {
    return {
      map: null,
       markers: [] 
    };
  },
  mounted() {
    this.initializeMap();
  },
  methods: {
    // 初始化地图
    initializeMap() {
      this.map = new AMap.Map('map-container', {
        zoom: 12, // 默认缩放级别
        center: [116.397428, 39.90923] // 默认中心为北京
      });

      // 获取用户当前位置
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
          const { latitude, longitude } = position.coords;
          this.map.setCenter([longitude, latitude]);
          new AMap.Marker({
            position: [longitude, latitude],
            map: this.map
          });
        });
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    },
    // 处理 POI 搜索结果
    async searchPOI(query) {
  try {
    // 1) 获取当前地图中心经纬度
    const c = this.map.getCenter(); 

    // 2) 清理上一次搜索产生的标记
    if (this.markers.length) {
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];
    }

    // 3) 调用在 Vercel 上的 Serverless 接口
    const { data } = await axios.get('/api/search', {
      params: { query, longitude: c.lng, latitude: c.lat }
    });

    // 4) 渲染返回的 POI
    const pois = data?.pois || [];
    pois.forEach(poi => {
      const [lng, lat] = (poi.location || '').split(',').map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        const marker = new AMap.Marker({
          position: [lng, lat],
          title: poi.name,
          map: this.map
        });
        this.markers.push(marker);
      }
    });

    // 5) 自动缩放到合适视野
    if (this.markers.length) {
      this.map.setFitView(this.markers);
    }
  } catch (err) {
    console.error(err);
    alert('搜索失败，请稍后重试');
       }
     }
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
<
