/* global Response */

import { airport } from '../src/airport.js'
import { toCity } from '../src/city.js'
import { toIP } from '../src/network.js'

import countries from '../data/countries.json'
import airports from '../data/airports.json'

export const config = { runtime: 'edge' }



export default {

  async fetch (request) {

    const isDev = process.env.ENVIRONMENT === 'development'
    
    const cloudflare = path =>
      fetch(`https://api.cloudflare.com/client/v4/radar/entities/${path}`, {
        headers: { authorization: process.env.CLOUDFLARE_AUTHORIZATION }
      }).then(res => res.json())
    
    const getAddress = isDev
      ? () => '99.129.219.232'
      : headers => headers.get('cf-connecting-ip')
    
    const getIpCountry = isDev ? () => 'US' : headers => headers.get('cf-ipcountry')
    
    const getIpCity = isDev
      ? () => 'Los Angeles'
      : headers => headers.get('cf-ipcity')
    
    const HEADERS = { 'access-control-allow-origin': '*' }

    const searchParams = new URLSearchParams(request.url.split('?')[1])
    const { pathname } = new URL(request.url)

    if (pathname === '/countries') {
      const filter = (() => {
        let value = searchParams.get('alpha2')
        if (value) return { key: 'alpha2', value }
        value = searchParams.get('alpha3')
        if (value) return { key: 'alpha3', value }
        return { key: 'numeric', value: searchParams.get('numeric') }
      })()

      const result = filter
        ? countries.find(({ country }) => country[filter.key] === filter.value)
        : countries
      return Response.json(result, { headers: HEADERS })
    }

    if (pathname === '/airports') {
      return Response.json(airports, { headers: HEADERS })
    }

    const { headers } = request
    const countryAlpha2 = getIpCountry(headers)
    console.log('Country code from IP:', countryAlpha2)

    const findCountry = countries.find(({ country }) => {
      return country.alpha2 === countryAlpha2
    })

    if (!findCountry) {
      console.error(`No country found for alpha2 code: ${countryAlpha2}`)
      return Response.json(
        {
          error: 'Country not found',
          message: `Unable to find country information for code: ${countryAlpha2}`,
          code: 'COUNTRY_NOT_FOUND'
        },
        {
          status: 404,
          headers: HEADERS
        }
      )
    }

    const {
      country,
      continent,
      capitals,
      callingCodes,
      currencies,
      eeaMember,
      euMember,
      languages,
      tlds
    } = findCountry

    const address = getAddress(headers)

    const coordinates = {
      latitude: headers.get('cf-iplatitude'),
      longitude: headers.get('cf-iplongitude')
    }

    const payload = {
      ip: toIP(address),
      city: toCity({
        name: getIpCity(headers),
        postalCode: headers.get('cf-postal-code') ?? null,
        metroCode: headers.get('cf-metro-code') ?? null
      }),
      country,
      continent,
      capitals,
      currencies,
      callingCodes,
      eeaMember,
      euMember,
      languages,
      tlds,
      airport: airport(coordinates, airports),
      coordinates,
      timezone: headers.get('cf-timezone')
    }

    if (searchParams.get('headers') !== null) {
      payload.headers = Object.fromEntries(request.headers)
    }

    if (searchParams.get('asn') !== null) {
      payload.asn = await cloudflare(`asns/ip?ip=${address}`)
        .then(body => body.result.asn)
        .then(asn => ({
          id: asn.asn,
          name: asn.aka || asn.name,
          company: asn.nameLong || null,
          website: asn.website || null,
          country: { name: asn.countryName, alpha2: asn.country },
          users: asn.estimatedUsers?.estimatedUsers,
          more: `https://radar.cloudflare.com/quality/as${asn.asn}`
        }))
    }

    if (!request.headers.get('accept').includes('text/html')) {
      return Response.json(payload, { headers: HEADERS })
    }

    return new Response(
      `<!DOCTYPE html><html lang="en">
  <head>
    <title>Geolocation</title>
    <meta property="og:description" content="Get detailed information about the incoming request based on the IP address." >
    <meta property="og:image" content="https://cdn.jsdelivr.net/gh/microlinkhq/geolocation/design/share.png" >
    <meta name="color-scheme" content="light dark">
    <meta charset="utf-8">
    <style>
      :root {
        --color: #000000;
        --background-color: #ffffff;
        --sh-class: #000000;
        --sh-identifier: #000000;
        --sh-sign: rgba(0, 0, 0, 0.5);
        --sh-string: #000000;
        --sh-keyword: #000000;
        --sh-comment: #000000;
        --sh-jsxliterals: #000000;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --color: #ffffff;
          --background-color: #000000;
          --sh-class: #ffffff;
          --sh-identifier: #ffffff;
          --sh-sign: rgba(255, 255, 255, 0.5);
          --sh-string: #ffffff;
          --sh-keyword: #ffffff;
          --sh-comment: #ffffff;
          --sh-jsxliterals: #ffffff;
        }
      }

      body {
        background: var(--background-color);
      }

      code {
        font-size: 2vmin;
        font-family: "Operator Mono", "Fira Code", "SF Mono", "Roboto Mono", Menlo,
          monospace;
        line-height: 1.5;
      }

      .github-corner svg {
        fill: var(--color);
        color: var(--background-color);
      }

      .github-corner:hover .octo-arm {
        animation: octocat-wave 560ms ease-in-out;
      }

      @keyframes octocat-wave {

        0%,
        100% {
          transform: rotate(0);
        }

        20%,
        60% {
          transform: rotate(-25deg);
        }

        40%,
        80% {
          transform: rotate(10deg);
        }
      }
    </style>
  </head>
  <body>
    <pre>
<code>${JSON.stringify(payload, null, 2)}</code>
    </pre>
   
    <script type="module">
      import {
        highlight
      } from 'https://esm.sh/sugar-high'
      const el = document.querySelector('pre > code')
      el.innerHTML = highlight(el.innerText)
    </script>
  </body>
</html>`,
      {
        headers: {
          'content-type': 'text/html;charset=UTF-8'
        }
      }
    )
  }
}
