import React from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import Navbar from './components/Navbar';

import Home from './pages/Home';
import ProductList from './pages/ProductList';
import ProductAnalysis from './pages/ProductAnalysis';
import ConflictCenter from './pages/ConflictCenter';
import ReviewQueue from './pages/ReviewQueue';

export default function App() {
  return (
    <Router>

      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">

        <Navbar />

        <main>

          <Routes>

            {/* ==================================================
                DASHBOARD
            ================================================== */}

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/dashboard"
              element={<Home />}
            />

            {/* ==================================================
                PRODUCT CATALOG
            ================================================== */}

            <Route
              path="/products"
              element={<ProductList />}
            />

            {/* ==================================================
                PRODUCT ANALYSIS
            ================================================== */}

            <Route
              path="/products/:id"
              element={<ProductAnalysis />}
            />

            {/* ==================================================
                CONFLICT CENTER
            ================================================== */}

            <Route
              path="/conflicts"
              element={<ConflictCenter />}
            />

            {/* ==================================================
                HUMAN REVIEW QUEUE
            ================================================== */}

            <Route
              path="/review"
              element={<ReviewQueue />}
            />

            {/* ==================================================
                FALLBACK
            ================================================== */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>

        </main>

      </div>

    </Router>
  );
}