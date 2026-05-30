import * as https from 'https';

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Easy-Blinds-Backend/1.0', // Nominatim requires a user agent
      },
      timeout: 3000,
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

function getFallbackCoordinates(address: string): [number, number] {
  const normalized = address.toLowerCase();
  
  // Known coordinates for common UAE and Kerala/Malappuram spots.
  // Coordinates are stored in GeoJSON order: [longitude, latitude].
  const db: Record<string, [number, number]> = {
    'perinthalmanna': [76.2260, 10.9765],
    'malappuram': [76.0711, 11.0510],
    'manjeri': [76.1197, 11.1202],
    'nilambur': [76.2389, 11.2794],
    'tirur': [75.9221, 10.9146],
    'kottakkal': [76.0058, 10.9996],
    'kondotty': [75.9656, 11.1444],
    'karipur': [75.9553, 11.1368],
    'edappal': [76.0106, 10.7847],
    'ponnani': [75.9259, 10.7677],
    'valanchery': [76.0730, 10.8892],
    'vengara': [75.9894, 11.0516],
    'chemmad': [75.9367, 11.0437],
    'areekode': [76.0504, 11.2302],
    'kerala': [76.2711, 10.8505],
    'marina': [55.1403, 25.0784],
    'jbr': [55.1328, 25.0763],
    'downtown': [55.2744, 25.1972],
    'mall of the emirates': [55.2008, 25.1181],
    'dubai mall': [55.2784, 25.1973],
    'jumeirah': [55.2304, 25.1768],
    'al barsha': [55.1947, 25.0975],
    'deira': [55.3214, 25.2632],
    'bur dubai': [55.2974, 25.2442],
    'business bay': [55.2708, 25.1833],
    'palm jumeirah': [55.1353, 25.1124],
    'jlt': [55.1432, 25.0744],
    'meydan': [55.3054, 25.1632],
    'silicon oasis': [55.3854, 25.1232],
    'sports city': [55.2184, 25.0332],
    'motor city': [55.2334, 25.0452],
    'arabian ranches': [55.2734, 25.0532],
    'mudon': [55.2934, 25.0232],
    'damac hills': [55.2534, 25.0132],
    'mirdif': [55.4134, 25.2132],
    'abu dhabi': [54.3773, 24.4539],
    'sharjah': [55.4121, 25.3573],
    'dubai': [55.2708, 25.2048],
  };

  for (const [key, coords] of Object.entries(db)) {
    if (normalized.includes(key)) {
      // Add a tiny random offset so overlapping jobs don't stack directly on top of each other
      const offsetLng = (Math.random() - 0.5) * 0.008;
      const offsetLat = (Math.random() - 0.5) * 0.008;
      return [coords[0] + offsetLng, coords[1] + offsetLat];
    }
  }

  const keralaIndicators = ['kerala', 'india', 'malappuram', 'perinthalmanna', 'manjeri', 'nilambur', 'tirur', 'kottakkal', 'kondotty'];
  const useKeralaFallback = keralaIndicators.some((term) => normalized.includes(term));

  // Generic fallback: Generate deterministic coords within the detected operating region based on the hash of the address.
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const latMin = useKeralaFallback ? 10.68 : 25.05;
  const latMax = useKeralaFallback ? 11.62 : 25.25;
  const lngMin = useKeralaFallback ? 75.75 : 55.12;
  const lngMax = useKeralaFallback ? 76.58 : 55.38;

  const latRange = latMax - latMin;
  const lngRange = lngMax - lngMin;

  const detLat = latMin + Math.abs((hash % 1000) / 1000) * latRange;
  const detLng = lngMin + Math.abs(((hash >> 3) % 1000) / 1000) * lngRange;

  return [detLng, detLat];
}

export async function geocodeAddress(address: string): Promise<[number, number]> {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    return [55.2708, 25.2048]; // default to Dubai center
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await httpsGet(url);
    const data = JSON.parse(response);
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return [lon, lat]; // GeoJSON format: [longitude, latitude]
      }
    }
  } catch (error) {
    console.warn(`Geocoding failed for address "${address}", using fallback. Error:`, error.message);
  }
  
  return getFallbackCoordinates(address);
}
