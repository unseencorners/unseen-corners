const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const { MongoClient, ObjectId } = require('mongodb');

const PORT = 3000;

// MongoDB connection URI
const MONGODB_URI = 'mongodb+srv://Harini:Harini%40123@sharedcluster.c5jw4tz.mongodb.net/auth_system?retryWrites=true&w=majority&appName=SharedCluster';
const DB_NAME = 'auth_system';
const COLLECTION_NAME = 'bookings';

// MongoDB client
let db, bookingsCollection;

// Initialize MongoDB connection
async function connectToDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    db = client.db(DB_NAME);
    bookingsCollection = db.collection(COLLECTION_NAME);
    
    // Create index for better query performance
    await bookingsCollection.createIndex({ email: 1 });
    await bookingsCollection.createIndex({ createdAt: -1 });
    
    return client;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Serve static frontend file
function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      let ext = path.extname(filePath);
      let type =
        ext === '.html' ? 'text/html' :
        ext === '.css' ? 'text/css' :
        ext === '.js' ? 'text/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    }
  });
}

// Save booking to MongoDB
async function saveBooking(bookingData) {
  try {
    const result = await bookingsCollection.insertOne({
      ...bookingData,
      createdAt: new Date()
    });
    return result;
  } catch (error) {
    console.error('Error saving booking:', error);
    throw error;
  }
}

// Get all bookings (optional - for admin purposes)
async function getAllBookings() {
  try {
    const bookings = await bookingsCollection.find({}).sort({ createdAt: -1 }).toArray();
    return bookings;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve frontend file
  if (req.method === 'GET') {
    if (req.url === '/' || req.url === '/index.html') {
      serveFile(path.join(__dirname, 'blank3.html'), res);
    } 
    // API endpoint to get all bookings (optional)
    else if (req.url === '/api/bookings') {
      try {
        const bookings = await getAllBookings();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(bookings));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch bookings' }));
      }
    }
    else {
      const filePath = path.join(__dirname, req.url);
      serveFile(filePath, res);
    }
  }

  // Handle form submission (POST)
  else if (req.method === 'POST' && req.url === '/submit-booking') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Parse form data
        const formData = querystring.parse(body);

        // Validate required fields
        const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'package', 'departureDate'];
        for (const field of requiredFields) {
          if (!formData[field] || formData[field].trim() === '') {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <h2>❌ Validation Error</h2>
              <p>Field "${field}" is required.</p>
              <a href="/">Back to Home</a>
            `);
            return;
          }
        }

        // Create booking object
        const booking = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address ? formData.address.trim() : '',
          city: formData.city ? formData.city.trim() : '',
          country: formData.country ? formData.country.trim() : '',
          package: formData.package,
          departureDate: formData.departureDate,
          returnDate: formData.returnDate || '',
          travelers: parseInt(formData.travelers) || 1,
          specialRequests: formData.specialRequests ? formData.specialRequests.trim() : '',
          status: 'pending' // Add status field
        };

        // Save to MongoDB
        const result = await saveBooking(booking);

        // Respond to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Booking Confirmation</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 5px; }
              .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="success">
              <h2>✅ Booking Received!</h2>
              <p>Thank you, <strong>${booking.firstName}</strong>! Your booking has been saved successfully.</p>
              <p><strong>Booking ID:</strong> ${result.insertedId}</p>
              <p>We'll contact you at ${booking.email} to confirm your booking details.</p>
            </div>
            <br>
            <a href="/" class="btn">Back to Home</a>
          </body>
          </html>
        `);

      } catch (error) {
        console.error('Error processing booking:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <h2>❌ Server Error</h2>
          <p>Sorry, there was an error processing your booking. Please try again.</p>
          <a href="/">Back to Home</a>
        `);
      }
    });
  }

  // Handle unknown routes
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

// Start server after database connection
async function startServer() {
  try {
    await connectToDatabase();
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📊 MongoDB connected: ${DB_NAME}.${COLLECTION_NAME}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
startServer();