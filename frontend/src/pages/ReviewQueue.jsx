import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchGlobalConflictCenter,
  fetchResolutions
} from '../lib/api';

/**
 * SpecTrust AI - Human Review Queue
 *
 * Purpose:
 * Centralized human-in-the-loop review queue for
 * high-risk specification conflicts.
 *
 * Demo behavior:
 * - Loads genuine conflicts from the catalog.
 * - Keeps only CRITICAL / HIGH risk conflicts.
 * - Retrieves the AI arbitration recommendation.
 * - Allows human reviewer to Approve / Reject / Reset.
 * - Persists review decisions in localStorage.
 */

const STORAGE_KEY = 'spectrust-review-decisions';

export default function ReviewQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [decisions, setDecisions] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  // ==========================================================
  // Load saved decisions
  // ==========================================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        setDecisions(parsed);
      }
    } catch (err) {
      console.warn(
        '[REVIEW QUEUE] Could not load saved decisions:',
        err
      );
    }
  }, []);

  // ==========================================================
  // Save decisions
  // ==========================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(decisions)
      );
    } catch (err) {
      console.warn(
        '[REVIEW QUEUE] Could not save decisions:',
        err
      );
    }
  }, [decisions]);

  // ==========================================================
  // Load queue
  // ==========================================================

  const loadQueue = async () => {
    try {
      setError(null);

      const conflictData =
        await fetchGlobalConflictCenter();

      const conflicts = Array.isArray(
        conflictData?.conflicts
      )
        ? conflictData.conflicts
        : [];

      // ------------------------------------------------------
      // Only genuine high-risk conflicts enter review queue.
      // ------------------------------------------------------

      const highRiskConflicts = conflicts.filter(
        conflict => {
          const status = String(
            conflict?.status || ''
          ).toUpperCase();

          const severity = String(
            conflict?.severity || ''
          ).toUpperCase();

          return (
            status === 'GENUINE_CONFLICT' &&
            (
              severity === 'CRITICAL' ||
              severity === 'HIGH' ||
              severity === 'SAFETY_CRITICAL' ||
              severity === 'COMPATIBILITY_RISK'
            )
          );
        }
      );

      // ------------------------------------------------------
      // Retrieve arbitration recommendation for every item.
      // ------------------------------------------------------

      const enriched = await Promise.all(
        highRiskConflicts.map(
          async conflict => {
            let resolution = null;

            try {
              const resolutionData =
                await fetchResolutions(
                  conflict.product_id
                );

              const resolutions =
                Array.isArray(
                  resolutionData?.resolutions
                )
                  ? resolutionData.resolutions
                  : [];

              resolution =
                resolutions.find(
                  item =>
                    Number(item.conflict_id) ===
                    Number(conflict.id)
                ) || null;
            } catch (err) {
              console.warn(
                `[REVIEW QUEUE] Could not fetch resolution for conflict ${conflict.id}:`,
                err
              );
            }

            return {
              ...conflict,
              resolution
            };
          }
        )
      );

      // Critical items first.
      enriched.sort((a, b) => {
        const rank = severity => {
          const value = String(
            severity || ''
          ).toUpperCase();

          if (
            value === 'CRITICAL' ||
            value === 'SAFETY_CRITICAL'
          ) {
            return 0;
          }

          if (
            value === 'HIGH' ||
            value === 'COMPATIBILITY_RISK'
          ) {
            return 1;
          }

          return 2;
        };

        return (
          rank(a.severity) -
          rank(b.severity)
        );
      });

      setItems(enriched);

      // Automatically open the first critical item.
      if (
        enriched.length > 0 &&
        expandedId === null
      ) {
        const firstCritical =
          enriched.find(item => {
            const severity = String(
              item.severity || ''
            ).toUpperCase();

            return (
              severity === 'CRITICAL' ||
              severity === 'SAFETY_CRITICAL'
            );
          });

        if (firstCritical) {
          setExpandedId(firstCritical.id);
        }
      }
    } catch (err) {
      console.error(
        '[REVIEW QUEUE] Failed to load:',
        err
      );

      setError(
        err?.message ||
        'Failed to load review queue.'
      );
    }
  };

  // ==========================================================
  // Initial load
  // ==========================================================

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);

      await loadQueue();

      setLoading(false);
    };

    initialize();
  }, []);

  // ==========================================================
  // Refresh
  // ==========================================================

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadQueue();

    setRefreshing(false);
  };

  // ==========================================================
  // Reviewer decision
  // ==========================================================

  const handleDecision = (
    conflictId,
    decision
  ) => {
    setDecisions(previous => ({
      ...previous,
      [conflictId]: {
        decision,
        decided_at:
          new Date().toISOString()
      }
    }));
  };

  // ==========================================================
  // Reset decision
  // ==========================================================

  const handleReset = conflictId => {
    setDecisions(previous => {
      const next = {
        ...previous
      };

      delete next[conflictId];

      return next;
    });
  };

  // ==========================================================
  // Metrics
  // ==========================================================

  const metrics = useMemo(() => {
    const total = items.length;

    const critical = items.filter(
      item => {
        const severity = String(
          item.severity || ''
        ).toUpperCase();

        return (
          severity === 'CRITICAL' ||
          severity === 'SAFETY_CRITICAL'
        );
      }
    ).length;

    const approved = items.filter(
      item =>
        decisions[item.id]?.decision ===
        'APPROVED'
    ).length;

    const rejected = items.filter(
      item =>
        decisions[item.id]?.decision ===
        'REJECTED'
    ).length;

    const pending =
      total -
      approved -
      rejected;

    return {
      total,
      critical,
      approved,
      rejected,
      pending
    };
  }, [items, decisions]);

  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">

        <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />

        <p className="mt-5 text-slate-300 font-semibold">
          Loading Human Review Queue...
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Collecting high-risk conflicts and AI recommendations.
        </p>

      </div>
    );
  }

  // ==========================================================
  // Error
  // ==========================================================

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">

        <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-8">

          <h2 className="text-xl font-bold text-rose-200">
            Review Queue Error
          </h2>

          <p className="mt-2 text-sm text-rose-300">
            {error}
          </p>

          <button
            onClick={handleRefresh}
            className="mt-6 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
          >
            Try Again
          </button>

        </div>

      </div>
    );
  }

  // ==========================================================
  // Render
  // ==========================================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          <div>

            <div className="flex items-center gap-3 mb-3">

              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-lg shadow-amber-500/30" />

              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Human Verification Layer
              </span>

            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Review Queue
            </h1>

            <p className="mt-3 text-sm text-slate-400 max-w-3xl">
              AI has identified high-risk specification
              conflicts that require human verification
              before the final specification can be trusted.
            </p>

          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {refreshing
              ? 'Refreshing...'
              : '↻ Refresh Queue'}
          </button>

        </div>

      </div>

      {/* =====================================================
          METRICS
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">

          <p className="text-xs uppercase tracking-wider text-slate-500">
            Total Reviews
          </p>

          <p className="mt-2 text-3xl font-extrabold text-white">
            {metrics.total}
          </p>

        </div>

        <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-5">

          <p className="text-xs uppercase tracking-wider text-rose-400">
            Critical
          </p>

          <p className="mt-2 text-3xl font-extrabold text-rose-300">
            {metrics.critical}
          </p>

        </div>

        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-5">

          <p className="text-xs uppercase tracking-wider text-amber-400">
            Pending
          </p>

          <p className="mt-2 text-3xl font-extrabold text-amber-300">
            {metrics.pending}
          </p>

        </div>

        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5">

          <p className="text-xs uppercase tracking-wider text-emerald-400">
            Approved
          </p>

          <p className="mt-2 text-3xl font-extrabold text-emerald-300">
            {metrics.approved}
          </p>

        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">

          <p className="text-xs uppercase tracking-wider text-slate-500">
            Rejected
          </p>

          <p className="mt-2 text-3xl font-extrabold text-slate-300">
            {metrics.rejected}
          </p>

        </div>

      </div>

      {/* =====================================================
          HUMAN-IN-THE-LOOP EXPLANATION
      ====================================================== */}

      <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-6">

        <div className="flex gap-4">

          <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-lg">
            ✓
          </div>

          <div>

            <h3 className="text-sm font-bold text-cyan-200 uppercase tracking-wider">
              Human-in-the-Loop Safety
            </h3>

            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              SpecTrust AI does not blindly automate
              safety-critical decisions. The AI recommends
              a specification using source authority,
              recency and evidence, while critical
              conflicts remain visible for human verification.
            </p>

          </div>

        </div>

      </div>

      {/* =====================================================
          EMPTY STATE
      ====================================================== */}

      {items.length === 0 && (

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-12 text-center">

          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl">
            ✓
          </div>

          <h2 className="mt-5 text-xl font-bold text-white">
            No High-Risk Reviews
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            There are currently no critical or high-risk
            specification conflicts requiring human review.
          </p>

          <Link
            to="/conflicts"
            className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold"
          >
            Open Conflict Center
          </Link>

        </div>
      )}

      {/* =====================================================
          REVIEW ITEMS
      ====================================================== */}

      <div className="space-y-5">

        {items.map(item => {

          const severity =
            String(
              item.severity || ''
            ).toUpperCase();

          const isCritical =
            severity === 'CRITICAL' ||
            severity === 'SAFETY_CRITICAL';

          const decision =
            decisions[item.id];

          const resolution =
            item.resolution;

          const expanded =
            expandedId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-slate-900/90 rounded-2xl overflow-hidden shadow-xl ${
                isCritical
                  ? 'border border-rose-500/40'
                  : 'border border-amber-500/30'
              }`}
            >

              {/* =================================================
                  ITEM HEADER
              ================================================== */}

              <div className="p-6">

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                  <div className="flex items-start gap-4">

                    <div
                      className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-lg ${
                        isCritical
                          ? 'bg-rose-950 border border-rose-500/40 text-rose-300'
                          : 'bg-amber-950 border border-amber-500/40 text-amber-300'
                      }`}
                    >
                      !
                    </div>

                    <div>

                      <div className="flex flex-wrap items-center gap-3">

                        <h2 className="text-xl font-extrabold text-white font-mono">
                          {String(
                            item.attribute ||
                            'Unknown'
                          ).replace(
                            /_/g,
                            ' '
                          )}
                        </h2>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isCritical
                              ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                              : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {severity}
                        </span>

                        {decision && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                              decision.decision ===
                              'APPROVED'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-950 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {decision.decision}
                          </span>
                        )}

                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">

                        <span>
                          Product:{' '}
                          <strong className="text-cyan-300">
                            {item.product_id}
                          </strong>
                        </span>

                        <span>
                          Claims:{' '}
                          <strong className="text-slate-200">
                            {Array.isArray(
                              item.claim_ids
                            )
                              ? item.claim_ids.length
                              : '—'}
                          </strong>
                        </span>

                        <span>
                          Status:{' '}
                          <strong className="text-rose-300">
                            {item.status}
                          </strong>
                        </span>

                      </div>

                    </div>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    <button
                      onClick={() =>
                        setExpandedId(
                          expanded
                            ? null
                            : item.id
                        )
                      }
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      {expanded
                        ? 'Hide Evidence'
                        : 'View Evidence'}
                    </button>

                    <Link
                      to={`/products/${item.product_id}`}
                      className="px-4 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"
                    >
                      Open Product
                    </Link>

                  </div>

                </div>

              </div>

              {/* =================================================
                  EVIDENCE
              ================================================== */}

              {expanded && (

                <div className="border-t border-slate-800 bg-slate-950/50 p-6 space-y-5">

                  {/* AI recommendation */}

                  <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-5">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                      <div>

                        <p className="text-xs uppercase tracking-wider font-bold text-cyan-400">
                          AI Recommended Specification
                        </p>

                        <p className="mt-2 text-2xl font-extrabold font-mono text-cyan-200">
                          {resolution?.resolved_value ??
                            '--'}{' '}
                          {resolution?.resolved_unit ||
                            ''}
                        </p>

                      </div>

                      {resolution?.confidence !==
                        undefined &&
                        resolution?.confidence !==
                          null && (

                          <div className="text-right">

                            <p className="text-xs text-slate-500">
                              Arbitration Confidence
                            </p>

                            <p className="text-2xl font-extrabold text-white">
                              {Number(
                                resolution.confidence
                              ).toFixed(1)}
                              %
                            </p>

                          </div>

                        )}

                    </div>

                    {resolution?.source_id_chosen && (

                      <div className="mt-4">

                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-950 border border-cyan-500/20 text-xs font-mono text-cyan-300">
                          Selected Source: {resolution.source_id_chosen}
                        </span>

                      </div>

                    )}

                    {resolution?.explanation && (

                      <div className="mt-4 pt-4 border-t border-cyan-500/20">

                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                          Explainable Recommendation
                        </p>

                        <p className="text-sm text-slate-300 leading-relaxed">
                          {resolution.explanation}
                        </p>

                      </div>

                    )}

                  </div>

                  {/* Conflict rationale */}

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">

                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
                      Conflict Evidence
                    </p>

                    <p className="text-sm text-slate-300 leading-relaxed">
                      {item.rationale_text ||
                        'No additional rationale available.'}
                    </p>

                  </div>

                  {/* Safety warning */}

                  {isCritical && (

                    <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-5">

                      <div className="flex gap-3">

                        <div className="text-rose-300 text-xl">
                          ⚠
                        </div>

                        <div>

                          <p className="text-sm font-bold text-rose-200">
                            Human verification required
                          </p>

                          <p className="mt-1 text-xs text-rose-300/80 leading-relaxed">
                            This conflict is classified as
                            critical. The AI recommendation
                            must not silently become the final
                            engineering specification.
                          </p>

                        </div>

                      </div>

                    </div>

                  )}

                  {/* Review action */}

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

                      <div>

                        <p className="text-sm font-bold text-white">
                          Human Verification Decision
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Accept or reject the AI recommendation
                          for this review.
                        </p>

                      </div>

                      <div className="flex flex-wrap gap-3">

                        <button
                          onClick={() =>
                            handleDecision(
                              item.id,
                              'APPROVED'
                            )
                          }
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                        >
                          ✓ Approve
                        </button>

                        <button
                          onClick={() =>
                            handleDecision(
                              item.id,
                              'REJECTED'
                            )
                          }
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors"
                        >
                          ✕ Reject
                        </button>

                        {decision && (

                          <button
                            onClick={() =>
                              handleReset(
                                item.id
                              )
                            }
                            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold"
                          >
                            Reset
                          </button>

                        )}

                      </div>

                    </div>

                    {decision && (

                      <div
                        className={`mt-4 px-4 py-3 rounded-lg text-xs ${
                          decision.decision ===
                          'APPROVED'
                            ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/50 border border-rose-500/30 text-rose-300'
                        }`}
                      >
                        Reviewer decision:{' '}
                        <strong>
                          {decision.decision}
                        </strong>

                        {' • '}

                        {new Date(
                          decision.decided_at
                        ).toLocaleString()}

                      </div>

                    )}

                  </div>

                </div>

              )}

            </div>
          );
        })}

      </div>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">

        <div className="flex gap-4">

          <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-950 border border-violet-500/30 flex items-center justify-center text-violet-300">
            AI
          </div>

          <div>

            <h3 className="text-sm font-bold text-white">
              Why this matters
            </h3>

            <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-4xl">
              SpecTrust AI separates automated evidence
              analysis from final human accountability.
              This prevents a high-confidence AI recommendation
              from silently becoming an unsafe engineering
              decision.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}