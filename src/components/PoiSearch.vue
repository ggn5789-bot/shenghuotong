<template>
    <div class="poi-search">
      <input
        v-model="query"
        type="text"
        placeholder="搜索周边商店或服务"
        @keyup.enter="search"
        />
      <button @click="search">搜索</button>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        query: '' // 搜索的关键词
      };
    },
    methods: {
      search() {
        if (this.query) {
          this.$emit('search', this.query); // 通过事件传递搜索关键词给父组件
        } else {
          alert('请输入搜索关键词');
        }
      }
    }
  };
  </script>
  
  <style scoped>
  .poi-search {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 10;
    padding: 10px;
    background-color: rgba(255, 255, 255, 0.7);
    border-radius: 5px;
  }
  
  input {
    padding: 5px;
    font-size: 16px;
  }
  
  button {
    padding: 5px 10px;
    margin-left: 10px;
    font-size: 16px;
    cursor: pointer;
  }
  </style>
  