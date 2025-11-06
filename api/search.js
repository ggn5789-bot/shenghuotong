// api/search.js
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const { query, longitude, latitude } = req.query;
    const key = process.env.AMAP_KEY; // 在 Vercel 环境变量里配置
    if (!key) return res.status(500).json({ error: 'Missing AMAP_KEY' });

    const url =
      `https://restapi.amap.com/v3/place/around` +
      `?location=${longitude},${latitude}` +
      `&keywords=${encodeURIComponent(query || '')}` +
      `&key=${key}`;

    const r = await axios.get(url, { timeout: 8000 });
    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal Error' });
  }
}
