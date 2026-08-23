const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const healthRoute = require('./routes/health');
const productsRoute = require('./routes/products');
const db = require('../db/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRoute);
app.use('/api/products', productsRoute);

// Root fallback
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to SpecTrust AI API',
        health: '/api/health',
        products: '/api/products'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 SpecTrust AI Backend server running at http://localhost:${PORT}`);
    console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    console.log(`📦 Products API URL: http://localhost:${PORT}/api/products`);
});
