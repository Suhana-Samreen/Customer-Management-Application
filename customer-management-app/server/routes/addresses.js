const express = require('express');
const router = express.Router();
const db = require('../index');

// GET all addresses for a customer
router.get('/customer/:customerId', (req, res) => {
  const { customerId } = req.params;

  db.all('SELECT * FROM addresses WHERE customer_id = ?', [customerId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// POST create new address
router.post('/', (req, res) => {
  const { customer_id, address_details, city, state, pin_code } = req.body;

  if (!customer_id || !address_details || !city || !state || !pin_code) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const sql = `
    INSERT INTO addresses (customer_id, address_details, city, state, pin_code) 
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [customer_id, address_details, city, state, pin_code];

  db.run(sql, params, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      id: this.lastID,
      customer_id,
      address_details,
      city,
      state,
      pin_code,
      message: 'Address created successfully'
    });
  });
});

// PUT update address
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { address_details, city, state, pin_code } = req.body;

  if (!address_details || !city || !state || !pin_code) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const sql = `
    UPDATE addresses 
    SET address_details = ?, city = ?, state = ?, pin_code = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  const params = [address_details, city, state, pin_code, id];

  db.run(sql, params, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    res.json({ message: 'Address updated successfully' });
  });
});

// DELETE address
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM addresses WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    res.json({ message: 'Address deleted successfully' });
  });
});

module.exports = router;