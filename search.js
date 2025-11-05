// api/search.js
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const { query = '', longitude, latitude } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ error: 'Missing longitude or latitude' });
    }

    const key = process.env.AMAP_KEY; // 到 Vercel 环境变量里配置
    if (!key) return res.status(500).json({ error: 'Missing AMAP_KEY' });

    const url =
      `https://restapi.amap.com/v3/place/around` +
      `?location=${longitude},${latitude}` +
      `&keywords=${encodeURIComponent(query)}` +
      `&key=${key}`;

    const r = await axios.get(url, { timeout: 8000 });
    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal Error' });
  }
}
