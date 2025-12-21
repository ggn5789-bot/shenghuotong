// src/api/search.js
const API_BASE_URL = 'https://shenghuotong.vercel.app';

/**
 * 向后端发起 POI 搜索请求
 * @param {Object} params - 包含 { keywords, lng, lat, radius, category }
 * @returns {Promise}
 */
export async function searchPOI(params) {
  // 2. 构建查询参数
  const queryParams = new URLSearchParams();
  
  // 必须参数
  if (params.keywords) queryParams.append('keywords', params.keywords);
  if (params.lng) queryParams.append('lng', params.lng);
  if (params.lat) queryParams.append('lat', params.lat);
  
  // 可选参数
  if (params.radius) queryParams.append('radius', params.radius);
  if (params.category) queryParams.append('category', params.category);

  const url = `${API_BASE_URL}/api/search?${queryParams.toString()}`;

  try {
    console.log('正在请求后端:', url); // 方便调试

    // 4. 发起 HTTP 请求
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 5. 检查网络状态
    if (!response.ok) {
      throw new Error(`网络请求失败，状态码: ${response.status}`);
    }

    // 6. 解析 JSON
    const result = await response.json();
    return result;

  } catch (error) {
    console.error('API 请求出错:', error);
    throw error; // 继续抛出错误，让组件去处理显示
  }
}