const express = require('express');
const router = express.Router();
const db = require('../index');

// GET all customers with search, sort, and pagination
router.get('/', (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const searchTerm = `%${search}%`;

  let sql = `
    SELECT * FROM customers 
    WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?
    ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
    LIMIT ? OFFSET ?
  `;

  let countSql = `
    SELECT COUNT(*) as total FROM customers 
    WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?
  `;

  db.all(sql, [searchTerm, searchTerm, searchTerm, parseInt(limit), offset], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    db.get(countSql, [searchTerm, searchTerm, searchTerm], (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        customers: rows,
        total: countResult.total,
        page: parseInt(page),
        totalPages: Math.ceil(countResult.total / limit)
      });
    });
  });
});

// GET single customer
router.get('/:id', (req, res) => {
  const { id } = req.params;

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

// POST create new customer
router.post('/', (req, res) => {
  const { first_name, last_name, phone_number } = req.body;

  if (!first_name || !last_name || !phone_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const sql = 'INSERT INTO customers (first_name, last_name, phone_number) VALUES (?, ?, ?)';
  const params = [first_name, last_name, phone_number];

  db.run(sql, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
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
  });
});

// PUT update customer
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone_number } = req.body;

  if (!first_name || !last_name || !phone_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const sql = `
    UPDATE customers 
    SET first_name = ?, last_name = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  const params = [first_name, last_name, phone_number, id];

  db.run(sql, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer updated successfully' });
  });
});

// DELETE customer
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM customers WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  });
});

module.exports = router;