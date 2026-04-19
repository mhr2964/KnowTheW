const express = require('express');
const router = express.Router();

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from the API' });
});

router.get('/status', (req, res) => {
  res.json({ status: 'ok', app: 'KnowTheW' });
});

module.exports = router;
