<template>
  <div id="app">
    <div id="map-container" style="height: 100vh;"></div>
    <!-- 搜索框组件：输入后回车/点击会触发 @search 事件 -->
    <PoiSearch @search="searchPOI" />
  </div>
</template>

<script>
/* global AMap */
import PoiSearch from './components/PoiSearch.vue'
import axios from 'axios'

export default {
  name: 'App',
  components: { PoiSearch },
  data () {
    return {
      map: null,
      markers: []
    }
  },
  mounted () {
    this.initMap()
  },
  methods: {
    initMap () {
      this.map = new AMap.Map('map-container', {
        zoom: 12,
        center: [116.397428, 39.90923] // 默认北京
      })

      // 浏览器定位
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { longitude, latitude } = pos.coords
          this.map.setCenter([longitude, latitude])
          new AMap.Marker({
            position: [longitude, latitude],
            map: this.map
          })
        })
      }
    },

    async searchPOI (query) {
      // 清理上一次的标记
      if (this.markers.length) {
        this.markers.forEach(m => m.setMap(null))
        this.markers = []
      }

      // 取当前地图中心经纬度
      const c = this.map.getCenter()
      const url = `/api/search?keywords=${encodeURIComponent(query)}&lng=${c.lng}&lat=${c.lat}`

      const { data } = await axios.get(url)
      if (data && Array.isArray(data.pois)) {
        data.pois.forEach(poi => {
          if (!poi.location) return
          const [lng, lat] = poi.location.split(',').map(Number)
          const m = new AMap.Marker({ position: [lng, lat], map: this.map })
          this.markers.push(m)
        })
      }
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  margin-top: 0;
}
</style>
