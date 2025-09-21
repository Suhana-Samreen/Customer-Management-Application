const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:3000',
      'https://*.github.dev',
      'https://*.app.github.dev'
    ];
    if (allowedOrigins.some(allowed => origin.includes(allowed.replace('*.', '')))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database initialization
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    address_details TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
  )`);

  // Insert sample data
  db.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
    if (row && row.count === 0) {
      console.log('Inserting sample data...');
      const sampleCustomers = [
        ['John', 'Doe', '123-456-7890'],
        ['Jane', 'Smith', '098-765-4321'],
        ['Bob', 'Johnson', '555-123-4567']
      ];
      
      sampleCustomers.forEach(([first, last, phone]) => {
        db.run(`INSERT INTO customers (first_name, last_name, phone_number) 
                VALUES (?, ?, ?)`, [first, last, phone]);
      });
    }
  });
});

//  HEALTH CHECK ENDPOINT - Test this first
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/health',
      '/api/customers',
      '/api/customers/:id',
      '/api/test'
    ]
  });
});

//  SIMPLE TEST ENDPOINT
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Test successful!',
    data: { test: 'working', time: new Date().toISOString() }
  });
});

//  GET ALL CUSTOMERS (Fixed version)
app.get('/api/customers', (req, res) => {
  console.log(' GET /api/customers called with query:', req.query);
  
  const { page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
  const offset = (page - 1) * limit;
  const searchTerm = `%${search}%`;

  // Simple query for testing
  const sql = `
    SELECT * FROM customers 
    WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) as total FROM customers 
    WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?
  `;

  console.log('Executing SQL with params:', [searchTerm, searchTerm, searchTerm, parseInt(limit), offset]);

  db.all(sql, [searchTerm, searchTerm, searchTerm, parseInt(limit), offset], (err, rows) => {
    if (err) {
      console.error(' Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    db.get(countSql, [searchTerm, searchTerm, searchTerm], (err, countResult) => {
      if (err) {
        console.error(' Count error:', err);
        return res.status(500).json({ error: 'Count error', details: err.message });
      }

      console.log(' Successfully fetched', rows.length, 'customers');
      res.json({
        customers: rows,
        total: countResult.total,
        page: parseInt(page),
        totalPages: Math.ceil(countResult.total / limit),
        message: 'Success'
      });
    });
  });
});

//  GET SINGLE CUSTOMER
app.get('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  console.log('📦 GET /api/customers/', id);

  db.get('SELECT * FROM customers WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(row);
  });
});

//  CREATE CUSTOMER
app.post('/api/customers', (req, res) => {
  console.log('📦 POST /api/customers with data:', req.body);
  
  const { first_name, last_name, phone_number } = req.body;

  if (!first_name || !last_name || !phone_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.run(
    'INSERT INTO customers (first_name, last_name, phone_number) VALUES (?, ?, ?)',
    [first_name, last_name, phone_number],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Phone number already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        first_name,
        last_name,
        phone_number,
        message: 'Customer created successfully'
      });
    }
  );
});

//  404 HANDLER 
app.use('/api/*', (req, res) => {
  console.log(' 404 - Endpoint not found:', req.originalUrl);
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/test',
      'GET /api/customers',
      'GET /api/customers/:id',
      'POST /api/customers'
    ]
  });
});

//  ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(' Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ✅ START SERVER
app.listen(PORT, () => {
  console.log(` Server started successfully!');
  console.log(` Port: ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(` Customers API: http://localhost:${PORT}/api/customers`);
  console.log(' Ready to accept requests...');
});
