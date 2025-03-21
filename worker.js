export default {
  async fetch(request) {
    const headers = request.headers
    const cf = request.cf // Cloudflare-specific properties

    const payload = {
      ip: headers.get('cf-connecting-ip'),
      country: {
        code: cf.country,
        name: cf.country_name,
      },
      city: {
        name: cf.city,
        postalCode: cf.postalCode,
        latitude: cf.latitude,
        longitude: cf.longitude
      },
      continent: {
        code: cf.continent,
        name: cf.continent_name
      },
      timezone: cf.timezone,
      region: {
        code: cf.region_code,
        name: cf.region
      },
      asn: cf.asn,
      asOrganization: cf.asOrganization,
      // Optional detailed info if requested
      details: headers.get('accept').includes('text/html') ? {
        colo: cf.colo,
        metroCode: cf.metroCode,
        isEUCountry: cf.isEUCountry,
        tlsCipher: cf.tlsCipher,
        tlsVersion: cf.tlsVersion,
        httpProtocol: cf.httpProtocol
      } : undefined
    }

    // Return JSON by default
    if (!headers.get('accept').includes('text/html')) {
      return Response.json(payload, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      })
    }

    // Return HTML view if requested
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Geolocation Info</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.5;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    pre {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #fff; }
      pre { background: #2d2d2d; }
    }
  </style>
</head>
<body>
  <h1>Geolocation Information</h1>
  <pre><code>${JSON.stringify(payload, null, 2)}</code></pre>
</body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-cache'
        }
      }
    )
  }
} 