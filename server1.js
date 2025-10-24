// server.js
const http = require('http');
const url = require('url');
const data = require('./data');

const PORT = 5000;

const server = http.createServer((req, res) => {
  // Enable CORS manually for frontend access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  // ✅ Handle search API
  if (path === '/api/search' && req.method === 'GET') {
    const query = parsedUrl.query.q ? parsedUrl.query.q.toLowerCase() : '';

    if (!query) {
      res.writeHead(200);
      return res.end(JSON.stringify([]));
    }

    const results = data.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );

    res.writeHead(200);
    res.end(JSON.stringify(results));
  } 
  else {
    // Handle other routes
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Route not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
