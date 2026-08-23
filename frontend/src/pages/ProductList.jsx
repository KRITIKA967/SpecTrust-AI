import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../lib/api';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const getDemoBadge = (id) => {
    if (id === 'ST-001') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5 animate-pulse"></span>
          Critical Conflict Demo
        </span>
      );
    }
    if (id === 'ST-011') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5"></span>
          Semantic Equivalence Demo
        </span>
      );
    }
    if (id === 'ST-017') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
          Clean Control Demo
        </span>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden shadow-xl shadow-cyan-950/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Industrial Product Trust Catalog
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Automated multi-source product specification verification and contradiction detection for industrial supply chains.
        </p>

        {/* Quick Demo Shortcuts */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Hackathon Demos:</span>
          <Link
            to="/products/ST-001"
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-200 hover:border-rose-400 text-xs font-medium transition-all"
          >
            <span className="font-bold mr-1.5">ST-001:</span> Solenoid Valve (Voltage Mismatch)
          </Link>
          <Link
            to="/products/ST-011"
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 hover:border-cyan-400 text-xs font-medium transition-all"
          >
            <span className="font-bold mr-1.5">ST-011:</span> Pressure Transmitter (bar/MPa/kPa)
          </Link>
          <Link
            to="/products/ST-017"
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 hover:border-emerald-400 text-xs font-medium transition-all"
          >
            <span className="font-bold mr-1.5">ST-017:</span> Cable Gland (Clean Control)
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-3"></div>
          <span>Loading products catalog...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-rose-950/50 border border-rose-500/40 p-6 rounded-xl text-rose-200 text-sm">
          <p className="font-semibold mb-1">Failed to connect to SpecTrust API</p>
          <p className="text-xs text-rose-300/80">{error}</p>
        </div>
      )}

      {/* Product List Table */}
      {!loading && !error && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              All Seeded Products ({products.length})
            </h2>
            <span className="text-xs text-slate-400">3 Sources per Product</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">ID</th>
                  <th className="py-3.5 px-6">Product Name</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-4 px-6 font-mono text-cyan-400 font-medium">
                      {prod.id}
                    </td>
                    <td className="py-4 px-6 font-medium text-white group-hover:text-cyan-300 transition-colors">
                      <div className="flex items-center space-x-3">
                        <span>{prod.name}</span>
                        {getDemoBadge(prod.id)}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                        {prod.category || 'industrial'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        to={`/products/${prod.id}`}
                        className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/80 hover:border-cyan-400 transition-all shadow-sm"
                      >
                        Analyze Product &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
