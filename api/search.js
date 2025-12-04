// my-vue-project/api/search.js

// Vercel Node.js Serverless Function
module.exports = async (req, res) => {
  try {
    const { keywords, lng, lat, radius = 2000, category } = req.query || {};

    if (!keywords || !lng || !lat) {
      return res.status(400).json({
        status: 0,
        info: '缺少必要参数：keywords / lng / lat',
      });
    }

    const location = `${lng},${lat}`;

    const params = new URLSearchParams({
      key: process.env.AMAP_KEY || '',
      location,
      keywords,
      radius: String(radius),
      output: 'JSON',
    });

    if (category) {
      params.set('types', category);
    }

    const url =
      'https://restapi.amap.com/v3/place/around?' + params.toString();

    // Node 18+ 自带 fetch
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== '1') {
      // 高德返回错误，不要让函数直接崩溃，返回错误信息即可
      return res.status(500).json({
        status: 0,
        info: data.info || '高德接口返回错误',
        raw: data,
      });
    }

    // 一切正常
    return res.status(200).json({
      status: 1,
      data,
    });
  } catch (err) {
    console.error('API /api/search error:', err);
    return res.status(500).json({
      status: 0,
      info: '服务器内部错误：' + err.message,
    });
  }
};
