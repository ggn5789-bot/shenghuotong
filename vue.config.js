module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // backend 地址
        changeOrigin: true
      }
    }
  }
}



