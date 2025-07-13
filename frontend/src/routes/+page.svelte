<script lang="ts">
  import { onMount } from 'svelte';
  import pkg from 'maplibre-gl';
  const { Map } = pkg;
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { calculateRoute, fetchTraffic, fetchRoadAttributes } from '$lib/api';
  import { routeStore, roadProfileStore } from '$lib/stores';

  let mapContainer: HTMLElement;
  let map: Map;

  // HERE APIキー（Map Tile表示にのみクライアントサイドで使用）
  const HERE_API_KEY = 'YOUR_HERE_API_KEY'; // バックエンドと同じキーを入力

  // 入力フォーム用の変数
  let startPoint = '35.681, 139.767'; // 東京駅
  let endPoint = '35.658, 139.745';   // 東京タワー

  onMount(() => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: `https://api.here.com/styles/berlin/style.json?apikey=${HERE_API_KEY}`,
      center: [139.767, 35.681],
      zoom: 12
    });

    map.on('load', () => {
      // 交通情報用のソースとレイヤーを追加
      map.addSource('traffic', {
        type: 'vector',
        tiles: [`https://data.traffic.hereapi.com/v7/flow.vector.mvt?apiKey=${HERE_API_KEY}&in=tile:{z},{x},{y}`]
      });
      map.addLayer({
        id: 'traffic-flow',
        type: 'line',
        source: 'traffic',
        'source-layer': 'flow',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 3,
          'line-color': [
            'match',
            ['get', 'jamFactor'],
            [0,1,2,3], '#4CAF50', // Free flow
            [4,5,6], '#FFC107',   // Slow
            [7,8,9], '#F44336',   // Jam
            '#212121'             // Closed/Unknown
          ]
        }
      });

      // ルート表示用の空のソースとレイヤーを追加
      map.addSource('route', { type: 'geojson', data: null });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1976D2', 'line-width': 6 }
      });
    });

    // 地図上でクリックされた場所の道路情報を取得
    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat;
      try {
        const attributes = await fetchRoadAttributes(lat, lng);
        roadProfileStore.set(attributes);
      } catch (error) {
        console.error(error);
        roadProfileStore.set({ error: '情報を取得できませんでした。' });
      }
    });

    return () => map.remove();
  });

  // routeStoreが更新されたら地図上のルートも更新
  routeStore.subscribe(newRoute => {
    if (map && newRoute && newRoute.routes && newRoute.routes.length > 0) {
      const routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: polylineToGeoJSON(newRoute.routes[0].sections[0].polyline)
      };
      const source = map.getSource('route') as maplibregl.GeoJSONSource;
      source.setData(routeGeoJSON);
      map.fitBounds(source.getBounds(), { padding: 50 });
    }
  });

  // ルート検索を実行する関数
  async function handleSearch() {
    try {
      const [startLat, startLng] = startPoint.split(',').map(Number);
      const [endLat, endLng] = endPoint.split(',').map(Number);
      const routeData = await calculateRoute({ lat: startLat, lng: startLng }, { lat: endLat, lng: endLng });
      routeStore.set(routeData);
    } catch (error) {
      console.error(error);
      alert('ルートの検索に失敗しました。');
    }
  }

  /**
   * HEREのFlexible PolylineをGeoJSON LineStringに変換するヘルパー関数
   */
  function polylineToGeoJSON(encoded: string): { type: 'LineString'; coordinates: number[][] } {
    // This is a simplified decoder. For production, use a robust library.
    const arr = [];
    let lat = 0, lon = 0;
    const parts = encoded.split('');
    let index = 0;

    while (index < parts.length) {
      let byte, shift = 0, result = 0;
      do {
        byte = parts[index++].charCodeAt(0) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;

      do {
        byte = parts[index++].charCodeAt(0) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlon = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lon += dlon;

      arr.push([lon * 1e-5, lat * 1e-5]);
    }
    return { type: 'LineString', coordinates: arr };
  }
</script>

<main>
  <div class="map-container" bind:this={mapContainer}></div>

  <div class="panel control-panel">
    <h2>ルート検索</h2>
    <div class="form-group">
      <label for="start">出発地 (緯度,経度)</label>
      <input id="start" type="text" bind:value={startPoint} />
    </div>
    <div class="form-group">
      <label for="end">目的地 (緯度,経度)</label>
      <input id="end" type="text" bind:value={endPoint} />
    </div>
    <button on:click={handleSearch}>検索</button>
  </div>

  <div class="panel profile-panel">
    <h2>道路プロファイル</h2>
    {#if $roadProfileStore}
      {#if $roadProfileStore.error}
        <p>{$roadProfileStore.error}</p>
      {:else if $roadProfileStore?.layers?.length > 0}
        <pre>{JSON.stringify($roadProfileStore.layers, null, 2)}</pre>
      {:else}
        <p>地図をクリックして道路情報を表示</p>
      {/if}
    {:else}
      <p>地図をクリックして道路情報を表示</p>
    {/if}
  </div>
</main>

<style>
  main {
    position: relative;
    width: 100vw;
    height: 100vh;
  }
  .map-container {
    width: 100%;
    height: 100%;
  }
  .panel {
    position: absolute;
    top: 10px;
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10;
    max-height: 80vh;
    overflow-y: auto;
  }
  .control-panel { left: 10px; width: 300px; }
  .profile-panel { right: 10px; width: 350px; }
  .form-group { margin-bottom: 10px; }
  label { display: block; margin-bottom: 5px; }
  input { width: 100%; padding: 8px; box-sizing: border-box; }
  button { width: 100%; padding: 10px; background-color: #1976D2; color: white; border: none; border-radius: 4px; cursor: pointer; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
</style>
