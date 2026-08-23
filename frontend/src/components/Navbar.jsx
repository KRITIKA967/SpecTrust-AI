import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }

    if (path === '/products') {
      return (
        location.pathname === '/products' ||
        location.pathname.startsWith('/products/')
      );
    }

    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between h-16">

          {/* ==================================================
              LOGO
          ================================================== */}

          <Link
            to="/"
            className="flex items-center space-x-3 group"
          >

            <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 transition-colors shadow-sm shadow-cyan-900/30">

              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>

            </div>

            <div>

              <span className="text-lg font-bold text-white tracking-tight">
                SpecTrust{' '}
                <span className="text-cyan-400">
                  AI
                </span>
              </span>

              <span className="hidden sm:inline-block ml-2 text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Hackathon MVP
              </span>

            </div>

          </Link>


          {/* ==================================================
              MAIN NAVIGATION
              Dashboard → Products → Conflict Center → Review
          ================================================== */}

          <nav className="flex items-center space-x-1 sm:space-x-3 text-sm font-medium">

            {/* ==================================================
                DASHBOARD
            ================================================== */}

            <Link
              to="/"
              className={`px-3.5 py-2 rounded-lg transition-colors ${
                isActive('/')
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Dashboard
            </Link>


            {/* ==================================================
                PRODUCTS
            ================================================== */}

            <Link
              to="/products"
              className={`px-3.5 py-2 rounded-lg transition-colors ${
                isActive('/products')
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Products
            </Link>


            {/* ==================================================
                CONFLICT CENTER
            ================================================== */}

            <Link
              to="/conflicts"
              className={`px-3.5 py-2 rounded-lg transition-colors ${
                isActive('/conflicts')
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>Conflict Center</span>

                <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                  LIVE
                </span>
              </span>
            </Link>


            {/* ==================================================
                REVIEW QUEUE
            ================================================== */}

            <Link
              to="/review"
              className={`px-3.5 py-2 rounded-lg transition-colors ${
                isActive('/review')
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-1.5">

                <span>
                  Review Queue
                </span>

                <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                  LIVE
                </span>

              </span>
            </Link>

          </nav>

        </div>

      </div>

    </header>
  );
}