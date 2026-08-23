import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchProducts,
  fetchTrustScore,
  fetchGlobalConflictCenter
} from '../lib/api';
import { Link } from 'react-router-dom';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [trustScores, setTrustScores] = useState({});
  const [conflicts, setConflicts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ============================================================
  // LOAD DASHBOARD DATA
  // ============================================================

  const loadDashboard = async () => {
    try {
      setError('');

      // --------------------------------------------------------
      // Products
      // --------------------------------------------------------

      const productsData = await fetchProducts();

      const productList = Array.isArray(productsData?.products)
        ? productsData.products
        : Array.isArray(productsData)
          ? productsData
          : [];

      setProducts(productList);

      // --------------------------------------------------------
      // Trust scores
      // --------------------------------------------------------

      const scoreResults = await Promise.all(
        productList.map(async (product) => {
          try {
            const data = await fetchTrustScore(product.id);

            const score =
              data?.product_trust_score ??
              data?.trust_score?.product_trust_score ??
              data?.score ??
              null;

            return {
              id: product.id,
              score:
                score !== null
                  ? Number(score)
                  : null
            };
          } catch (err) {
            console.warn(
              `[DASHBOARD] Trust score failed for ${product.id}:`,
              err
            );

            return {
              id: product.id,
              score: null
            };
          }
        })
      );

      const scoreMap = {};

      scoreResults.forEach((item) => {
        scoreMap[item.id] = item.score;
      });

      setTrustScores(scoreMap);

      // --------------------------------------------------------
      // Global conflicts
      // --------------------------------------------------------

      try {
        const conflictData =
          await fetchGlobalConflictCenter();

        setConflicts(
          Array.isArray(conflictData?.conflicts)
            ? conflictData.conflicts
            : []
        );
      } catch (err) {
        console.warn(
          '[DASHBOARD] Conflict loading failed:',
          err
        );

        setConflicts([]);
      }

    } catch (err) {
      console.error(
        '[DASHBOARD] Failed to load:',
        err
      );

      setError(
        err?.message ||
        'Unable to load dashboard data.'
      );
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await loadDashboard();
      setLoading(false);
    };

    initialize();
  }, []);

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  // ============================================================
  // DASHBOARD METRICS
  // ============================================================

  const metrics = useMemo(() => {
    const validScores = Object.values(trustScores).filter(
      (score) =>
        typeof score === 'number' &&
        !Number.isNaN(score)
    );

    const averageTrust =
      validScores.length > 0
        ? validScores.reduce(
            (sum, score) => sum + score,
            0
          ) / validScores.length
        : 0;

    const criticalConflicts =
      conflicts.filter((conflict) => {
        const severity = String(
          conflict?.severity || ''
        ).toUpperCase();

        return (
          severity === 'CRITICAL' ||
          severity === 'SAFETY_CRITICAL'
        );
      }).length;

    const highRiskConflicts =
      conflicts.filter((conflict) => {
        const severity = String(
          conflict?.severity || ''
        ).toUpperCase();

        return (
          severity === 'HIGH' ||
          severity === 'COMPATIBILITY_RISK'
        );
      }).length;

    const affectedProducts =
      new Set(
        conflicts.map(
          (conflict) => conflict.product_id
        )
      ).size;

    const highTrust =
      validScores.filter(
        (score) => score >= 85
      ).length;

    const mediumTrust =
      validScores.filter(
        (score) =>
          score >= 60 &&
          score < 85
      ).length;

    const lowTrust =
      validScores.filter(
        (score) => score < 60
      ).length;

    return {
      averageTrust,
      criticalConflicts,
      highRiskConflicts,
      affectedProducts,
      highTrust,
      mediumTrust,
      lowTrust
    };
  }, [trustScores, conflicts]);

  // ============================================================
  // TRUST SCORE HELPERS
  // ============================================================

  const getTrustLabel = (score) => {
    if (score === null || score === undefined) {
      return 'NO DATA';
    }

    if (score >= 85) {
      return 'HIGH TRUST';
    }

    if (score >= 60) {
      return 'REVIEW';
    }

    return 'DO NOT RELY';
  };

  const getTrustClasses = (score) => {
    if (score === null || score === undefined) {
      return {
        card:
          'bg-slate-800/60 border-slate-700',
        score:
          'text-slate-400',
        badge:
          'bg-slate-800 text-slate-400 border-slate-700'
      };
    }

    if (score >= 85) {
      return {
        card:
          'bg-emerald-950/25 border-emerald-500/30',
        score:
          'text-emerald-300',
        badge:
          'bg-emerald-950 text-emerald-300 border-emerald-500/30'
      };
    }

    if (score >= 60) {
      return {
        card:
          'bg-amber-950/25 border-amber-500/30',
        score:
          'text-amber-300',
        badge:
          'bg-amber-950 text-amber-300 border-amber-500/30'
      };
    }

    return {
      card:
        'bg-rose-950/30 border-rose-500/40',
      score:
        'text-rose-300',
      badge:
        'bg-rose-950 text-rose-300 border-rose-500/40'
    };
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">

          <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />

          <p className="mt-5 text-white font-semibold">
            Building SpecTrust Command Center...
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Loading products, trust scores and conflict intelligence.
          </p>

        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">

        <div className="max-w-4xl mx-auto bg-rose-950/40 border border-rose-500/40 rounded-2xl p-8">

          <p className="text-xs uppercase tracking-widest font-bold text-rose-400">
            Dashboard Error
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white">
            Unable to load Command Center
          </h1>

          <p className="mt-3 text-sm text-rose-200">
            {error}
          </p>

          <button
            onClick={handleRefresh}
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold"
          >
            Retry
          </button>

        </div>

      </div>
    );
  }

  // ============================================================
  // MAIN DASHBOARD
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">

        {/* ======================================================
            HERO
        ======================================================= */}

        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            <div>

              <div className="flex items-center gap-3 mb-3">

                <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-500/40" />

                <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                  SpecTrust Command Center
                </span>

              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Product Trust Intelligence
              </h1>

              <p className="mt-3 text-sm text-slate-400 max-w-3xl">
                Know which industrial product specifications
                you can actually trust across manufacturer,
                PIM and web sources.
              </p>

            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {refreshing
                ? 'Refreshing...'
                : '↻ Refresh Dashboard'}
            </button>

          </div>

        </section>

        {/* ======================================================
            KPI CARDS
        ======================================================= */}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Products */}

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">

            <p className="text-xs uppercase tracking-wider text-slate-500">
              Products Analyzed
            </p>

            <p className="mt-2 text-3xl font-extrabold text-white">
              {products.length}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Across the catalog
            </p>

          </div>

          {/* Average Trust */}

          <div className="bg-cyan-950/25 border border-cyan-500/30 rounded-2xl p-5">

            <p className="text-xs uppercase tracking-wider text-cyan-400">
              Average Trust
            </p>

            <p className="mt-2 text-3xl font-extrabold text-cyan-300">
              {metrics.averageTrust.toFixed(1)}%
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Catalog-wide trust score
            </p>

          </div>

          {/* Critical */}

          <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-5">

            <p className="text-xs uppercase tracking-wider text-rose-400">
              Critical Conflicts
            </p>

            <p className="mt-2 text-3xl font-extrabold text-rose-300">
              {metrics.criticalConflicts}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Require human verification
            </p>

          </div>

          {/* Affected */}

          <div className="bg-amber-950/25 border border-amber-500/30 rounded-2xl p-5">

            <p className="text-xs uppercase tracking-wider text-amber-400">
              Products At Risk
            </p>

            <p className="mt-2 text-3xl font-extrabold text-amber-300">
              {metrics.affectedProducts}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              With genuine conflicts
            </p>

          </div>

        </section>

        {/* ======================================================
            TRUST DISTRIBUTION
        ======================================================= */}

        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>

              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                Trust Distribution
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                Catalog Health
              </h2>

            </div>

            <div className="flex flex-wrap gap-3 text-xs">

              <span className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                High Trust: {metrics.highTrust}
              </span>

              <span className="px-3 py-1.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-500/30">
                Review: {metrics.mediumTrust}
              </span>

              <span className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-500/30">
                Low Trust: {metrics.lowTrust}
              </span>

            </div>

          </div>

        </section>

        {/* ======================================================
            TRUST SCORE HEATMAP
        ======================================================= */}

        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">

          <div className="p-6 border-b border-slate-800">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>

                <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                  Catalog-Wide Intelligence
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Trust Score Heatmap
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Every product is scored from its extracted
                  evidence, source consistency and conflict severity.
                </p>

              </div>

              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">

                <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  ≥ 85 Trusted
                </span>

                <span className="px-2 py-1 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                  60–84 Review
                </span>

                <span className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-500/30">
                  &lt; 60 Risk
                </span>

              </div>

            </div>

          </div>

          {products.length === 0 ? (

            <div className="p-10 text-center text-slate-500">
              No products available.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-950/60">

                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">

                    <th className="px-6 py-4">
                      Product
                    </th>

                    <th className="px-6 py-4">
                      Category
                    </th>

                    <th className="px-6 py-4">
                      Trust Score
                    </th>

                    <th className="px-6 py-4">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-800">

                  {products.map((product) => {

                    const score =
                      trustScores[product.id];

                    const trust =
                      getTrustClasses(score);

                    return (

                      <tr
                        key={product.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >

                        <td className="px-6 py-4">

                          <div className="font-bold text-white">
                            {product.name ||
                              product.product_name ||
                              product.id}
                          </div>

                          <div className="mt-1 text-xs font-mono text-cyan-400">
                            {product.id}
                          </div>

                        </td>

                        <td className="px-6 py-4 text-slate-400">

                          {product.category ||
                            product.product_category ||
                            'Industrial'}

                        </td>

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-3">

                            <div
                              className={`w-14 h-14 rounded-xl border flex items-center justify-center ${trust.card}`}
                            >

                              <span
                                className={`text-lg font-extrabold ${trust.score}`}
                              >
                                {score !== null &&
                                score !== undefined
                                  ? Math.round(score)
                                  : '—'}
                              </span>

                            </div>

                            <span className="text-xs text-slate-500">
                              /100
                            </span>

                          </div>

                        </td>

                        <td className="px-6 py-4">

                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${trust.badge}`}
                          >
                            {getTrustLabel(score)}
                          </span>

                        </td>

                        <td className="px-6 py-4 text-right">

                          <Link
                            to={`/products/${product.id}`}
                            className="inline-block px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold"
                          >
                            Analyze →
                          </Link>

                        </td>

                      </tr>

                    );
                  })}

                </tbody>

              </table>

            </div>

          )}

        </section>

        {/* ======================================================
            HIGH RISK CONFLICTS
        ======================================================= */}

        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">

          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>

              <p className="text-xs uppercase tracking-widest text-rose-400 font-bold">
                Attention Required
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                High-Risk Conflicts
              </h2>

            </div>

            <Link
              to="/conflicts"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 font-semibold"
            >
              Open Conflict Center →
            </Link>

          </div>

          <div className="p-5 space-y-3">

            {conflicts.length === 0 ? (

              <div className="p-6 text-center text-sm text-slate-500">
                No genuine conflicts detected.
              </div>

            ) : (

              conflicts
                .slice(0, 5)
                .map((conflict) => {

                  const severity =
                    String(
                      conflict?.severity || ''
                    ).toUpperCase();

                  const critical =
                    severity === 'CRITICAL' ||
                    severity === 'SAFETY_CRITICAL';

                  return (

                    <div
                      key={conflict.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border ${
                        critical
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-amber-950/20 border-amber-500/30'
                      }`}
                    >

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="font-bold text-white font-mono">
                            {String(
                              conflict.attribute ||
                              'Unknown'
                            ).replace(
                              /_/g,
                              ' '
                            )}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              critical
                                ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                                : 'bg-amber-950 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {severity}
                          </span>

                        </div>

                        <p className="mt-1 text-xs text-slate-500">

                          Product:{' '}

                          <span className="font-mono text-cyan-400">
                            {conflict.product_id}
                          </span>

                        </p>

                      </div>

                      <Link
                        to={`/products/${conflict.product_id}`}
                        className="shrink-0 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200"
                      >
                        Investigate
                      </Link>

                    </div>

                  );
                })

            )}

          </div>

        </section>

        {/* ======================================================
            PIPELINE EXPLANATION
        ======================================================= */}

        <section className="bg-cyan-950/20 border border-cyan-500/30 rounded-2xl p-6">

          <div className="flex gap-4">

            <div className="w-11 h-11 shrink-0 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-lg">
              AI
            </div>

            <div>

              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-200">
                How SpecTrust Builds Trust
              </h3>

              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Source evidence → claim extraction → unit and
                semantic normalization → conflict detection →
                severity classification → arbitration →
                explainable trust score → human verification
                for safety-critical conflicts.
              </p>

            </div>

          </div>

        </section>

      </div>

    </div>
  );
}