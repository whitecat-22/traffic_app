import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Honoの型定義。wrangler.tomlで設定した環境変数の型を定義します。
type Bindings = {
  HERE_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Svelteフロントエンド (localhost:5173) からのアクセスを許可するCORS設定
app.use('/api/*', cors({
  origin: 'http://localhost:5173',
  allowHeaders: ['Content-Type'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}))

/**
 * APIエンドポイント 1: ルート検索
 * /api/route
 * Body: { start: { lat, lng }, end: { lat, lng } }
 */
app.post('/api/route', async (c) => {
  const { start, end } = await c.req.json<{
    start: { lat: number, lng: number },
    end: { lat: number, lng: number }
  }>();

  if (!start || !end) {
    return c.json({ error: 'Start and end points are required' }, 400)
  }

  const apiKey = c.env.HERE_API_KEY;
  const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&return=polyline,summary,actions,instructions&apiKey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  return c.json(data);
})

/**
 * APIエンドポイント 2: リアルタイム交通情報
 * /api/traffic
 * Query: ?bbox=西経,南緯,東経,北緯 (例: ?bbox=139.9,35.7,140.1,35.8)
 */
app.get('/api/traffic', async (c) => {
  const bbox = c.req.query('bbox');
  if (!bbox) {
    return c.json({ error: 'Bounding box (bbox) is required' }, 400);
  }

  const apiKey = c.env.HERE_API_KEY;
  // HERE Traffic API v7 の Flow エンドポイント
  const url = `https://data.traffic.hereapi.com/v7/flow?in=bbox:${bbox}&locationReferencing=shape&apiKey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();
  return c.json(data);
});


/**
 * APIエンドポイント 3: 道路プロファイル情報
 * /api/road-attributes
 * Query: ?lat=緯度&lon=経度
 */
app.get('/api/road-attributes', async (c) => {
  const lat = c.req.query('lat');
  const lon = c.req.query('lon');

  if (!lat || !lon) {
    return c.json({ error: 'Latitude and Longitude are required' }, 400);
  }

  const apiKey = c.env.HERE_API_KEY;
  // HERE Map Attributes API (TCS) - Road Roughness の例
  const layers = 'ROAD_GEOM_FC1,SPEED_LIMITS_FC1,TRUCK_SPEED_LIMITS_FC1,LINK_ATTRIBUTE_FC1,SLOPES_FC1'
  const url = `https://tcs.hereapi.com/v2/col/attributes?layer_ids=${layers}&coordinates=${lat},${lon}&apikey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    return c.json({ error: 'Failed to fetch road attributes' }, response.status);
  }
  const data = await response.json();
  return c.json(data);
});

export default app
