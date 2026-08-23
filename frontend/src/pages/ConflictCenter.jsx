import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchGlobalConflictCenter
} from '../lib/api';

/**
 * SpecTrust AI - Conflict Center
 *
 * Purpose:
 * Central command center for specification conflicts
 * detected across the product catalog.
 *
 * Displays:
 * - Genuine conflicts
 * - Severity
 * - Product
 * - Conflicting source values
 * - Recommended specification
 * - Arbitration confidence
 * - Human verification status
 *
 * This component consumes the existing backend data model.
 */

// ============================================================
// Helpers
// ============================================================

function normalizeSeverity(severity) {
  const value = String(
    severity || ''
  ).toUpperCase();

  if (
    value === 'CRITICAL' ||
    value === 'SAFETY_CRITICAL'
  ) {
    return 'CRITICAL';
  }

  if (
    value === 'HIGH' ||
    value === 'COMPATIBILITY_RISK'
  ) {
    return 'HIGH';
  }

  if (
    value === 'MEDIUM' ||
    value === 'LOW' ||
    value === 'COSMETIC'
  ) {
    return value === 'MEDIUM'
      ? 'MEDIUM'
      : 'LOW';
  }

  return 'UNKNOWN';
}

function parseClaimIds(value) {
  if (Array.isArray(value)) {
    return value
      .map(Number)
      .filter(Number.isFinite);
  }

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return [];
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? [value]
      : [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed =
        JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed
          .map(Number)
          .filter(Number.isFinite);
      }

      if (
        typeof parsed === 'number' &&
        Number.isFinite(parsed)
      ) {
        return [parsed];
      }
    } catch {
      // Legacy fallback.
    }

    return trimmed
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map(item =>
        Number(String(item).trim())
      )
      .filter(Number.isFinite);
  }

  return [];
}

// ============================================================
// Severity UI
// ============================================================

function SeverityBadge({ severity }) {
  const normalized =
    normalizeSeverity(severity);

  if (normalized === 'CRITICAL') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-950 text-rose-300 border border-rose-500/40">
        🔴 CRITICAL
      </span>
    );
  }

  if (normalized === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-orange-950 text-orange-300 border border-orange-500/40">
        🟠 HIGH
      </span>
    );
  }

  if (normalized === 'MEDIUM') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-950 text-amber-300 border border-amber-500/40">
        🟡 MEDIUM
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-800 text-slate-400 border border-slate-700">
      ⚪ {normalized}
    </span>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function ConflictCenter() {

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [conflicts, setConflicts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [severityFilter, setSeverityFilter] =
    useState('ALL');

  const [expandedConflict, setExpandedConflict] =
    useState(null);

  // ----------------------------------------------------------
  // Load conflicts
  // ----------------------------------------------------------

  const loadConflicts = async () => {
    try {
      setLoading(true);
      setError(null);

      const data =
        await fetchGlobalConflictCenter();

      setConflicts(
        Array.isArray(data?.conflicts)
          ? data.conflicts
          : []
      );

    } catch (err) {
      console.error(
        '[CONFLICT CENTER]',
        err
      );

      setError(
        err?.message ||
        'Failed to load conflict data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  // ----------------------------------------------------------
  // Metrics
  // ----------------------------------------------------------

  const metrics = useMemo(() => {

    const critical =
      conflicts.filter(
        conflict =>
          normalizeSeverity(
            conflict.severity
          ) === 'CRITICAL'
      ).length;

    const high =
      conflicts.filter(
        conflict =>
          normalizeSeverity(
            conflict.severity
          ) === 'HIGH'
      ).length;

    const humanReview =
      conflicts.filter(
        conflict =>
          String(
            conflict.reviewer_status ||
            ''
          ).toUpperCase() ===
          'PENDING_REVIEW'
      ).length;

    const products =
      new Set(
        conflicts
          .map(
            conflict =>
              conflict.product_id
          )
          .filter(Boolean)
      ).size;

    return {
      total: conflicts.length,
      critical,
      high,
      humanReview,
      products
    };

  }, [conflicts]);

  // ----------------------------------------------------------
  // Filtering
  // ----------------------------------------------------------

  const filteredConflicts =
    useMemo(() => {

      if (
        severityFilter === 'ALL'
      ) {
        return conflicts;
      }

      return conflicts.filter(
        conflict =>
          normalizeSeverity(
            conflict.severity
          ) === severityFilter
      );

    }, [
      conflicts,
      severityFilter
    ]);

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">

        <div className="w-12 h-12 mx-auto border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />

        <p className="mt-5 text-sm text-slate-400">
          Loading SpecTrust Conflict Center...
        </p>

      </div>
    );
  }

  // ----------------------------------------------------------
  // Error
  // ----------------------------------------------------------

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">

        <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-8">

          <h2 className="text-xl font-bold text-rose-300">
            Conflict Center Error
          </h2>

          <p className="mt-3 text-sm text-rose-200">
            {error}
          </p>

          <button
            onClick={loadConflicts}
            className="mt-6 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm"
          >
            Retry
          </button>

        </div>

      </div>
    );
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div>

            <div className="flex items-center gap-3 mb-3">

              <span className="w-3 h-3 rounded-full bg-rose-400 animate-pulse" />

              <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
                SpecTrust Command Center
              </span>

            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Conflict Center
            </h1>

            <p className="mt-3 max-w-3xl text-sm text-slate-400 leading-relaxed">
              Centralized view of genuine specification
              conflicts detected across manufacturer,
              distributor and web sources.
            </p>

          </div>

          <button
            onClick={loadConflicts}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-slate-200"
          >
            ↻ Refresh Analysis
          </button>

        </div>

      </div>

      {/* ======================================================
          KPI CARDS
      ======================================================= */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Total */}

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">

          <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
            Genuine Conflicts
          </p>

          <p className="mt-3 text-4xl font-extrabold text-white">
            {metrics.total}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Requiring investigation
          </p>

        </div>

        {/* Critical */}

        <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-6">

          <p className="text-xs uppercase tracking-wider font-bold text-rose-400">
            Critical
          </p>

          <p className="mt-3 text-4xl font-extrabold text-rose-300">
            {metrics.critical}
          </p>

          <p className="mt-2 text-xs text-rose-400/70">
            Safety-sensitive conflicts
          </p>

        </div>

        {/* High */}

        <div className="bg-orange-950/30 border border-orange-500/30 rounded-2xl p-6">

          <p className="text-xs uppercase tracking-wider font-bold text-orange-400">
            High Risk
          </p>

          <p className="mt-3 text-4xl font-extrabold text-orange-300">
            {metrics.high}
          </p>

          <p className="mt-2 text-xs text-orange-400/70">
            Compatibility / operational risk
          </p>

        </div>

        {/* Products */}

        <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-6">

          <p className="text-xs uppercase tracking-wider font-bold text-cyan-400">
            Products Affected
          </p>

          <p className="mt-3 text-4xl font-extrabold text-cyan-300">
            {metrics.products}
          </p>

          <p className="mt-2 text-xs text-cyan-400/70">
            Across the catalog
          </p>

        </div>

      </div>

      {/* ======================================================
          FILTER BAR
      ======================================================= */}

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div>

            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Active Investigation Queue
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredConflicts.length} of {conflicts.length} conflicts
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            {[
              'ALL',
              'CRITICAL',
              'HIGH',
              'MEDIUM',
              'LOW'
            ].map(filter => (

              <button
                key={filter}
                onClick={() =>
                  setSeverityFilter(filter)
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  severityFilter === filter
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {filter}
              </button>

            ))}

          </div>

        </div>

      </div>

      {/* ======================================================
          EMPTY STATE
      ======================================================= */}

      {filteredConflicts.length === 0 && (

        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-12 text-center">

          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl">
            ✓
          </div>

          <h2 className="mt-5 text-xl font-bold text-emerald-300">
            No Genuine Conflicts
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            SpecTrust currently has no conflicts
            matching this filter.
          </p>

        </div>

      )}

      {/* ======================================================
          CONFLICT LIST
      ======================================================= */}

      <div className="space-y-5">

        {filteredConflicts.map(
          (conflict, index) => {

            const isExpanded =
              expandedConflict ===
              conflict.id;

            const claimIds =
              parseClaimIds(
                conflict.claim_ids
              );

            return (
              <div
                key={
                  conflict.id ||
                  `${conflict.product_id}-${index}`
                }
                className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-lg ${
                  normalizeSeverity(
                    conflict.severity
                  ) === 'CRITICAL'
                    ? 'border-rose-500/40'
                    : 'border-slate-800'
                }`}
              >

                {/* ------------------------------------------
                    Conflict header
                ------------------------------------------- */}

                <button
                  onClick={() =>
                    setExpandedConflict(
                      isExpanded
                        ? null
                        : conflict.id
                    )
                  }
                  className="w-full text-left p-6 hover:bg-slate-800/20 transition"
                >

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                    <div className="flex items-start gap-4">

                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border ${
                        normalizeSeverity(
                          conflict.severity
                        ) === 'CRITICAL'
                          ? 'bg-rose-950 border-rose-500/30'
                          : 'bg-slate-950 border-slate-800'
                      }`}>
                        ⚠
                      </div>

                      <div>

                        <div className="flex flex-wrap items-center gap-3">

                          <h3 className="text-lg font-extrabold text-white font-mono">
                            {String(
                              conflict.attribute ||
                              'Unknown Attribute'
                            ).replace(
                              /_/g,
                              ' '
                            )}
                          </h3>

                          <SeverityBadge
                            severity={
                              conflict.severity
                            }
                          />

                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">

                          <span>
                            Product:{' '}
                            <strong className="text-cyan-400">
                              {conflict.product_id ||
                                'Unknown'}
                            </strong>
                          </span>

                          <span>
                            Claims:{' '}
                            <strong className="text-slate-300">
                              {claimIds.length}
                            </strong>
                          </span>

                          <span>
                            Status:{' '}
                            <strong className="text-rose-300">
                              GENUINE CONFLICT
                            </strong>
                          </span>

                        </div>

                      </div>

                    </div>

                    <span className="text-xs font-mono text-slate-500">
                      {isExpanded
                        ? '▲ Hide Details'
                        : '▼ Investigate'}
                    </span>

                  </div>

                </button>

                {/* ------------------------------------------
                    Expanded investigation
                ------------------------------------------- */}

                {isExpanded && (

                  <div className="border-t border-slate-800 p-6 space-y-6">

                    {/* Product */}

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-950 border border-slate-800 rounded-xl p-5">

                      <div>

                        <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                          Affected Product
                        </p>

                        <p className="mt-2 text-lg font-bold text-white">
                          {conflict.product_name ||
                            conflict.product_id ||
                            'Unknown Product'}
                        </p>

                        {conflict.product_category && (
                          <p className="mt-1 text-xs text-slate-500">
                            {conflict.product_category}
                          </p>
                        )}

                      </div>

                      {conflict.product_id && (
                        <Link
                          to={`/products/${encodeURIComponent(
                            conflict.product_id
                          )}`}
                          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold text-center"
                        >
                          Open Product Analysis →
                        </Link>
                      )}

                    </div>

                    {/* Evidence */}

                    <div>

                      <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">
                        Conflict Evidence
                      </p>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">

                        <p className="text-sm text-slate-300 leading-relaxed">
                          {conflict.rationale_text ||
                            'Cross-source disagreement detected. Review the source records and arbitration recommendation.'}
                        </p>

                      </div>

                    </div>

                    {/* Resolution */}

                    <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-5">

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                        <div>

                          <p className="text-xs uppercase tracking-wider text-cyan-400 font-bold">
                            AI Arbitration
                          </p>

                          <p className="mt-2 text-sm font-semibold text-white">
                            Resolution details are available
                            in the product analysis view.
                          </p>

                        </div>

                        {conflict.product_id && (
                          <Link
                            to={`/products/${encodeURIComponent(
                              conflict.product_id
                            )}`}
                            className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                          >
                            View recommendation →
                          </Link>
                        )}

                      </div>

                    </div>

                    {/* Human Review */}

                    {normalizeSeverity(
                      conflict.severity
                    ) === 'CRITICAL' && (

                      <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-5">

                        <div className="flex items-start gap-3">

                          <span className="text-xl">
                            ⚠
                          </span>

                          <div>

                            <p className="text-sm font-bold text-amber-300">
                              Human Verification Required
                            </p>

                            <p className="mt-1 text-xs text-amber-200/70 leading-relaxed">
                              This conflict is safety-sensitive.
                              The AI recommendation should be
                              reviewed by an authorized human
                              before being treated as authoritative.
                            </p>

                          </div>

                        </div>

                      </div>

                    )}

                  </div>

                )}

              </div>
            );
          }
        )}

      </div>

      {/* ======================================================
          FOOTER INSIGHT
      ======================================================= */}

      {conflicts.length > 0 && (

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">

          <div className="flex items-start gap-4">

            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center">
              🧠
            </div>

            <div>

              <h3 className="text-sm font-bold text-white">
                Why SpecTrust Matters
              </h3>

              <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-4xl">
                SpecTrust does not simply compare text.
                It extracts technical claims, normalizes
                representations, identifies genuine
                disagreements, weighs source authority and
                recency, and produces an explainable
                recommendation while preserving a human
                verification path for high-risk decisions.
              </p>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}