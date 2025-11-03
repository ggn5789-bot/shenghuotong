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
      map: null
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
    searchPOI(query) {
      const userLocation = this.map.getCenter(); // 获取当前地图中心的经纬度
      const url = `https://restapi.amap.com/v3/place/around?location=${userLocation.lng},${userLocation.lat}&keywords=${query}&key=YOUR_GAODE_API_KEY`;

      axios.get(url).then(response => {
        const pois = response.data.pois;
        pois.forEach(poi => {
          new AMap.Marker({
            position: [poi.location.lng, poi.location.lat],
            title: poi.name,
            map: this.map,
          });
        });
      });
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
