import { PUBLIC_BACKEND_URL } from '$env/static/public';

export async function calculateRoute(start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
  const response = await fetch(`${PUBLIC_BACKEND_URL}/api/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end })
  });
  if (!response.ok) throw new Error('Failed to calculate route');
  return response.json();
}

export async function fetchTraffic(bbox: string) {
  const response = await fetch(`${PUBLIC_BACKEND_URL}/api/traffic?bbox=${bbox}`);
  if (!response.ok) throw new Error('Failed to fetch traffic data');
  return response.json();
}

export async function fetchRoadAttributes(lat: number, lng: number) {
  const response = await fetch(`${PUBLIC_BACKEND_URL}/api/road-attributes?lat=${lat}&lon=${lng}`);
  if (!response.ok) throw new Error('Failed to fetch road attributes');
  return response.json();
}
