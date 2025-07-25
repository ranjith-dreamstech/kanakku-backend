// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const { registerValidator, loginValidator } = require('../validators/authValidator');
const { dashboard } = require('../controllers/adminController');
const protect = require('../middleware/authMiddleware');

router.post('/register', registerValidator, register);  
router.post('/login', loginValidator, login);
router.post('/logout', logout);

module.exports = router;
