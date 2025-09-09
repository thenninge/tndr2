const express = require('express');
const fetch = require('node-fetch');

const app = express();

app.get('/tiles/:layer/:z/:x/:y.png', async (req, res) => {
  const { layer, z, x, y } = req.params;
  const url = `https://opencache.statkart.no/gatekeeper/gk/gk.open_wmts?layer=${layer}&style=default&tilematrixset=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send('Tile not found');
      return;
    }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'image/png');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Proxy error');
  }
});

app.listen(4000, () => console.log('Proxy running on http://localhost:4000'));
