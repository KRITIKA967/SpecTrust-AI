import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import {
  fetchProductDetails,
  runFullPipeline
} from '../lib/api';

/**
 * ============================================================
 * SpecTrust AI - Product Analysis
 * ============================================================
 *
 * UX FLOW
 *
 * Product opened
 *      ↓
 * Product information + source provenance
 *      ↓
 * NOT ANALYZED
 *      ↓
 * User clicks "Analyze Product"
 *      ↓
 * Analysis animation
 *      ↓
 * Backend:
 *   Extraction
 *      ↓
 *   Conflict Detection
 *      ↓
 *   Arbitration
 *      ↓
 *   Trust Score
 *      ↓
 * Results displayed
 *
 * IMPORTANT:
 *
 * This component does NOT automatically load old analysis
 * results from the database.
 *
 * The backend /analyze endpoint is the source of truth for
 * the current analysis run.
 * ============================================================
 */

export default function ProductAnalysis() {
  const { id } = useParams();

  // ==========================================================
  // STATE
  // ==========================================================

  const [product, setProduct] = useState(null);

  const [claims, setClaims] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [resolutions, setResolutions] = useState([]);

  const [trustScore, setTrustScore] = useState(null);
  const [trustAttributes, setTrustAttributes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const [analysisStage, setAnalysisStage] = useState(
    'Preparing analysis...'
  );

  const [analysisProgress, setAnalysisProgress] = useState(0);

  const [error, setError] = useState(null);

  const [expandedSource, setExpandedSource] = useState(null);

  // ==========================================================
  // CANONICAL ATTRIBUTE MAPPING
  // ==========================================================

  /**
   * Keep this mapping aligned with backend conflictDetector.js.
   *
   * Example:
   *
   * coil_voltage
   *      ↓
   * voltage
   *
   * operating_pressure
   *      ↓
   * measuring_range
   */
  const canonicalizeAttribute = (attribute) => {
    const value = String(attribute || '')
      .trim()
      .toLowerCase();

    const mappings = {
      // ------------------------------------------------------
      // VOLTAGE
      // ------------------------------------------------------

      voltage: 'voltage',
      'coil voltage': 'voltage',
      coil_voltage: 'voltage',
      'rated voltage': 'voltage',
      rated_voltage: 'voltage',
      'operating voltage': 'voltage',
      operating_voltage: 'voltage',
      'supply voltage': 'voltage',
      supply_voltage: 'voltage',

      // ------------------------------------------------------
      // PRESSURE / RANGE
      // ------------------------------------------------------

      'measuring range': 'measuring_range',
      measuring_range: 'measuring_range',

      'pressure range': 'measuring_range',
      pressure_range: 'measuring_range',

      'operating pressure': 'measuring_range',
      operating_pressure: 'measuring_range',

      'max pressure': 'measuring_range',
      max_pressure: 'measuring_range',

      range: 'measuring_range',

      // ------------------------------------------------------
      // RESPONSE TIME
      // ------------------------------------------------------

      'response time': 'response_time',
      response_time: 'response_time',

      'switching response': 'response_time',
      switching_response: 'response_time',

      response: 'response_time',

      // ------------------------------------------------------
      // TEMPERATURE
      // ------------------------------------------------------

      'temperature range': 'operating_temperature',
      temperature_range: 'operating_temperature',

      'operating temperature': 'operating_temperature',
      operating_temperature: 'operating_temperature',

      'ambient temperature': 'operating_temperature',
      ambient_temperature: 'operating_temperature',

      'temp range': 'operating_temperature',
      temp_range: 'operating_temperature',

      // ------------------------------------------------------
      // THREAD
      // ------------------------------------------------------

      thread: 'thread',

      'thread size': 'thread',
      thread_size: 'thread',

      'thread specification': 'thread',
      thread_specification: 'thread',

      'process connection': 'thread',
      process_connection: 'thread',

      'port connection': 'thread',
      port_connection: 'thread',

      // ------------------------------------------------------
      // CONNECTOR
      // ------------------------------------------------------

      connector: 'connector',

      'electrical connector': 'connector',
      electrical_connector: 'connector',

      'connection type': 'connector',
      connection_type: 'connector',

      // ------------------------------------------------------
      // OTHER
      // ------------------------------------------------------

      'clamping range': 'clamping_range',
      clamping_range: 'clamping_range',

      'ingress protection': 'ingress_protection',
      ingress_protection: 'ingress_protection',

      accuracy: 'accuracy',

      'orifice size': 'orifice_size',
      orifice_size: 'orifice_size'
    };

    return (
      mappings[value] ||
      value.replace(/\s+/g, '_')
    );
  };

  // ==========================================================
  // SAFE CLAIM ID PARSER
  // ==========================================================

  /**
   * NEVER allow malformed JSON from backend data to crash
   * the React component.
   *
   * Supports:
   *
   * [1,2,3]
   * "1,2,3"
   * 1
   * [1,2,3]
   * null
   */
  const parseClaimIds = (value) => {
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

    if (typeof value !== 'string') {
      return [];
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    // Proper JSON
    try {
      const parsed = JSON.parse(trimmed);

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
      // Ignore and use legacy parser below.
    }

    // Legacy comma-separated format
    return trimmed
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map(value =>
        Number(String(value).trim())
      )
      .filter(Number.isFinite);
  };

  // ==========================================================
  // INITIAL PRODUCT LOAD
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const initializePage = async () => {
      try {
        setLoading(true);
        setError(null);

        const productData =
          await fetchProductDetails(id);

        if (!mounted) {
          return;
        }

        setProduct(productData);

        // ----------------------------------------------------
        // VERY IMPORTANT
        //
        // Old analysis results are deliberately not loaded.
        // ----------------------------------------------------

        setClaims([]);
        setConflicts([]);
        setResolutions([]);

        setTrustScore(null);
        setTrustAttributes([]);

        setAnalysisComplete(false);
        setAnalyzing(false);

        setAnalysisProgress(0);

        setAnalysisStage(
          'Ready to analyze.'
        );

      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          '[PRODUCT PAGE] Failed to load product:',
          err
        );

        setError(
          err?.message ||
          'Failed to load product.'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializePage();

    return () => {
      mounted = false;
    };
  }, [id]);

  // ==========================================================
  // ANALYZE PRODUCT
  // ==========================================================

  const handleAnalyzeProduct = async () => {
    if (analyzing) {
      return;
    }

    try {
      setError(null);

      setAnalyzing(true);
      setAnalysisComplete(false);

      // ------------------------------------------------------
      // Clear old visible analysis
      // ------------------------------------------------------

      setClaims([]);
      setConflicts([]);
      setResolutions([]);

      setTrustScore(null);
      setTrustAttributes([]);

      // ------------------------------------------------------
      // STAGE 1
      // ------------------------------------------------------

      setAnalysisProgress(15);

      setAnalysisStage(
        'Extracting technical specifications from all sources...'
      );

      await new Promise(resolve =>
        setTimeout(resolve, 700)
      );

      // ------------------------------------------------------
      // STAGE 2
      // ------------------------------------------------------

      setAnalysisProgress(30);

      setAnalysisStage(
        'Normalizing units and technical attributes...'
      );

      await new Promise(resolve =>
        setTimeout(resolve, 700)
      );

      // ------------------------------------------------------
      // STAGE 3
      // ------------------------------------------------------

      setAnalysisProgress(50);

      setAnalysisStage(
        'Comparing specifications across sources...'
      );

      await new Promise(resolve =>
        setTimeout(resolve, 700)
      );

      // ------------------------------------------------------
      // STAGE 4
      // ------------------------------------------------------

      setAnalysisProgress(70);

      setAnalysisStage(
        'Detecting genuine specification conflicts...'
      );

      await new Promise(resolve =>
        setTimeout(resolve, 700)
      );

      // ------------------------------------------------------
      // STAGE 5
      // ------------------------------------------------------

      setAnalysisProgress(85);

      setAnalysisStage(
        'Running explainable arbitration and trust scoring...'
      );

      // ------------------------------------------------------
      // IMPORTANT
      //
      // Current backend uses:
      //
      // POST /api/products/:id/analyze
      //
      // It performs:
      //
      // Extraction
      // Conflict Detection
      // Arbitration
      // Trust Score
      // ------------------------------------------------------

      const result =
        await runFullPipeline(id);

      // ------------------------------------------------------
      // Validate backend response
      // ------------------------------------------------------

      if (!result?.success) {
        throw new Error(
          result?.error ||
          'Product analysis failed.'
        );
      }

      // ------------------------------------------------------
      // Extract backend results
      // ------------------------------------------------------

      const extractedClaims =
        Array.isArray(
          result?.extraction?.claims
        )
          ? result.extraction.claims
          : [];

      const detectedConflicts =
        Array.isArray(
          result?.conflict_detection?.conflicts
        )
          ? result.conflict_detection.conflicts
          : [];

      const generatedResolutions =
        Array.isArray(
          result?.arbitration?.resolutions
        )
          ? result.arbitration.resolutions
          : [];

      const backendTrustScore =
        result?.trust_score
          ?.product_trust_score;

      const backendAttributeScores =
        Array.isArray(
          result?.trust_score?.attributes
        )
          ? result.trust_score.attributes
          : [];

      // ------------------------------------------------------
      // Store results
      // ------------------------------------------------------

      setClaims(extractedClaims);

      setConflicts(detectedConflicts);

      setResolutions(generatedResolutions);

      if (
        typeof backendTrustScore === 'number'
      ) {
        setTrustScore(backendTrustScore);
      } else {
        setTrustScore(null);
      }

      setTrustAttributes(
        backendAttributeScores
      );

      // ------------------------------------------------------
      // Final transition
      // ------------------------------------------------------

      setAnalysisProgress(100);

      setAnalysisStage(
        'Analysis complete.'
      );

      await new Promise(resolve =>
        setTimeout(resolve, 500)
      );

      setAnalysisComplete(true);

      setAnalyzing(false);

    } catch (err) {
      console.error(
        '[PRODUCT PAGE] Analysis failed:',
        err
      );

      setError(
        err?.message ||
        'Failed to analyze product.'
      );

      setAnalyzing(false);

      setAnalysisComplete(false);

      setAnalysisProgress(0);

      setAnalysisStage(
        'Analysis failed.'
      );
    }
  };

  // ==========================================================
  // GENUINE CONFLICTS
  // ==========================================================

  const genuineConflicts = useMemo(() => {
    if (!analysisComplete) {
      return [];
    }

    return conflicts.filter(
      conflict =>
        String(
          conflict?.status || ''
        ).toUpperCase() ===
        'GENUINE_CONFLICT'
    );
  }, [
    conflicts,
    analysisComplete
  ]);

  // ==========================================================
  // CONFLICT METRICS
  // ==========================================================

  const criticalCount =
    genuineConflicts.filter(
      conflict =>
        String(
          conflict?.severity || ''
        ).toUpperCase() ===
        'CRITICAL'
    ).length;

  const totalConflicts =
    genuineConflicts.length;

  // ==========================================================
  // OVERALL STATUS
  // ==========================================================

  const overallStatus = useMemo(() => {
    if (!analysisComplete) {
      return {
        label: 'NOT ANALYZED',
        color:
          'bg-slate-800 text-slate-400 border-slate-700'
      };
    }

    if (criticalCount > 0) {
      return {
        label: 'CRITICAL REVIEW',
        color:
          'bg-rose-950/80 text-rose-300 border-rose-500/40'
      };
    }

    if (totalConflicts > 0) {
      return {
        label: 'NEEDS REVIEW',
        color:
          'bg-amber-950/80 text-amber-300 border-amber-500/40'
      };
    }

    return {
      label: 'TRUSTED',
      color:
        'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
    };
  }, [
    analysisComplete,
    criticalCount,
    totalConflicts
  ]);

  // ==========================================================
  // GROUP CLAIMS
  // ==========================================================

  const groupedClaims = useMemo(() => {
    const grouped = {};

    claims.forEach(claim => {
      const canonical =
        canonicalizeAttribute(
          claim?.attribute
        );

      if (!grouped[canonical]) {
        grouped[canonical] = [];
      }

      grouped[canonical].push(claim);
    });

    return grouped;
  }, [claims]);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const formatValue = (
    value,
    unit = ''
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return '-';
    }

    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  const findSourceClaim = (
    claimList,
    sourceType
  ) => {
    return (
      claimList.find(claim =>
        String(
          claim?.source_id || ''
        )
          .toUpperCase()
          .includes(sourceType)
      ) || null
    );
  };

  const findConflictForAttribute = (
    attribute
  ) => {
    const canonical =
      canonicalizeAttribute(attribute);

    return (
      conflicts.find(
        conflict =>
          canonicalizeAttribute(
            conflict?.attribute
          ) === canonical
      ) || null
    );
  };

  const findResolutionForConflict = (
    conflictId
  ) => {
    return (
      resolutions.find(
        resolution =>
          Number(
            resolution?.conflict_id
          ) === Number(conflictId)
      ) || null
    );
  };

  // ==========================================================
  // LOADING SCREEN
  // ==========================================================

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">

        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />

        <p className="mt-5 font-medium">
          Loading SpecTrust product...
        </p>

      </div>
    );
  }

  // ==========================================================
  // ERROR SCREEN
  // ==========================================================

  if (error && !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">

        <div className="bg-rose-950/60 border border-rose-500/40 p-8 rounded-2xl">

          <h2 className="text-xl font-bold text-rose-200">
            SpecTrust Analysis Error
          </h2>

          <p className="text-sm text-rose-300 mt-3 mb-6">
            {error}
          </p>

          <Link
            to="/products"
            className="inline-block px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm"
          >
            &larr; Back to Catalog
          </Link>

        </div>

      </div>
    );
  }

  // ==========================================================
  // MAIN PAGE
  // ==========================================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ======================================================
          ERROR BANNER
      ======================================================= */}

      {error && product && (
        <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl px-5 py-4">

          <p className="text-sm font-semibold text-rose-200">
            Analysis Error
          </p>

          <p className="text-xs text-rose-300 mt-1">
            {error}
          </p>

        </div>
      )}

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          <div>

            <div className="flex flex-wrap items-center gap-3 mb-3">

              <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-bold">
                {product?.id}
              </span>

              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${overallStatus.color}`}
              >
                {overallStatus.label}
              </span>

              <span className="text-xs text-slate-400">
                Category:{' '}

                <strong className="text-slate-200">
                  {product?.category ||
                    'Industrial'}
                </strong>
              </span>

            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {product?.name}
            </h1>

            {!analysisComplete &&
              !analyzing && (
                <p className="mt-3 text-sm text-slate-400 max-w-2xl">
                  Review the product information
                  and source provenance before
                  running cross-source verification.
                </p>
              )}

          </div>

          {/* ==================================================
              ANALYZE BUTTON
          =================================================== */}

          <button
            onClick={handleAnalyzeProduct}
            disabled={analyzing}
            className={`min-w-[210px] px-5 py-3 rounded-xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
              analyzing
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
            }`}
          >

            {analyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />

                <span>
                  Analyzing...
                </span>
              </>
            ) : analysisComplete ? (
              <>
                <span>
                  ↻
                </span>

                <span>
                  Re-analyze Product
                </span>
              </>
            ) : (
              <>
                <span>
                  ▶
                </span>

                <span>
                  Analyze Product
                </span>
              </>
            )}

          </button>

        </div>

      </div>

      {/* ======================================================
          ANALYSIS PROGRESS
      ======================================================= */}

      {analyzing && (
        <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-6 shadow-xl">

          <div className="flex items-center gap-4">

            <div className="w-11 h-11 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />

            <div className="flex-1">

              <div className="flex items-center justify-between">

                <p className="text-sm font-bold text-cyan-300">
                  SpecTrust AI Pipeline Running
                </p>

                <span className="text-xs font-mono text-cyan-400">
                  {analysisProgress}%
                </span>

              </div>

              <p className="text-xs text-slate-400 mt-1">
                {analysisStage}
              </p>

            </div>

          </div>

          <div className="mt-5 h-2 bg-slate-800 rounded-full overflow-hidden">

            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-700"
              style={{
                width: `${analysisProgress}%`
              }}
            />

          </div>

          <div className="grid grid-cols-4 gap-2 mt-5">

            {[
              'Extraction',
              'Normalization',
              'Conflict Detection',
              'Arbitration'
            ].map((stage, index) => {

              const stageProgress =
                [15, 30, 70, 85][index];

              const active =
                analysisProgress >=
                stageProgress;

              return (
                <div
                  key={stage}
                  className={`text-center text-[10px] sm:text-xs py-2 rounded-lg border ${
                    active
                      ? 'bg-cyan-950 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {stage}
                </div>
              );
            })}

          </div>

        </div>
      )}

      {/* ======================================================
          ANALYSIS COMPLETE
      ======================================================= */}

      {analysisComplete &&
        !analyzing && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-5 py-4 flex items-center gap-3">

            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ✓
            </div>

            <div>

              <p className="text-sm font-bold text-emerald-300">
                Analysis Complete
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Extraction, normalization,
                conflict detection, arbitration
                and trust scoring have completed.
              </p>

            </div>

          </div>
        )}

      {/* ======================================================
          PRE-ANALYSIS STATE
      ======================================================= */}

      {!analysisComplete &&
        !analyzing && (
          <div className="space-y-8">

            {/* PRODUCT OVERVIEW */}

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">

              <div className="flex items-center justify-between mb-5">

                <div>

                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Product Overview
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Product metadata available before
                    verification.
                  </p>

                </div>

                <span className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                  PRE-ANALYSIS
                </span>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">

                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    Product ID
                  </p>

                  <p className="mt-2 text-lg font-bold text-cyan-300 font-mono">
                    {product?.id}
                  </p>

                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">

                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    Data Sources
                  </p>

                  <p className="mt-2 text-lg font-bold text-white">
                    {product?.sources?.length ||
                      product?.sources_count ||
                      0}
                  </p>

                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">

                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    Verification Status
                  </p>

                  <p className="mt-2 text-lg font-bold text-slate-300">
                    Awaiting Analysis
                  </p>

                </div>

              </div>

            </div>

            {/* SOURCE PREVIEW */}

            {product?.sources?.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">

                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Available Source Records
                </h2>

                <p className="text-xs text-slate-500 mt-1 mb-5">
                  These sources are available for
                  verification but have not yet been
                  analyzed.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {product.sources.map(source => (

                    <div
                      key={source.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-5"
                    >

                      <div className="flex items-center justify-between gap-3">

                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {source.id}
                        </span>

                        <span className="text-[10px] px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-500">
                          TIER {source.authority_tier}
                        </span>

                      </div>

                      <p className="mt-3 text-sm font-semibold text-white">
                        {source.source_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {source.source_type ||
                          'Source Record'}
                      </p>

                    </div>

                  ))}

                </div>

              </div>
            )}

            {/* PRE-ANALYSIS MATRIX */}

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">

              <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/80">

                <div className="flex items-center justify-between gap-4">

                  <div>

                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Cross-Source Attribute Matrix
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      The verification matrix will be
                      generated after analysis.
                    </p>

                  </div>

                  <span className="shrink-0 text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                    NOT ANALYZED
                  </span>

                </div>

              </div>

              <div className="p-10 text-center">

                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl text-slate-500">
                  ⬡
                </div>

                <h3 className="mt-5 text-lg font-bold text-white">
                  Cross-source verification has not started
                </h3>

                <p className="mt-2 max-w-xl mx-auto text-sm text-slate-400">
                  Click Analyze Product to extract,
                  normalize and compare technical
                  specifications across the available
                  manufacturer, distributor and web
                  sources.
                </p>

                <button
                  onClick={handleAnalyzeProduct}
                  className="mt-6 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm shadow-lg shadow-cyan-500/10"
                >
                  Start Product Analysis
                </button>

              </div>

            </div>

          </div>
        )}

      {/* ======================================================
          ANALYZED RESULTS
      ======================================================= */}

      {analysisComplete && (
        <>

          {/* ==================================================
              TRUST METRICS
          =================================================== */}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            {/* TRUST SCORE */}

            <div className="md:col-span-2 bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg">

              <div className="flex items-center justify-between mb-4">

                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Specification Trust Rating
                </span>

                <span className="text-xs text-slate-500">
                  Backend Trust Engine
                </span>

              </div>

              <div className="flex items-baseline gap-3 mb-6">

                <span className="text-5xl font-extrabold text-white">
                  {trustScore !== null
                    ? Number(trustScore).toFixed(1)
                    : '--'}
                </span>

                <span className="text-lg font-medium text-slate-400">
                  / 100
                </span>

              </div>

              {trustScore !== null && (
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">

                  <div
                    className={`h-full transition-all duration-700 ${
                      Number(trustScore) > 80
                        ? 'bg-emerald-400'
                        : Number(trustScore) > 50
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          Number(trustScore)
                        )
                      )}%`
                    }}
                  />

                </div>
              )}

            </div>

            {/* SOURCES */}

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center space-y-2">

              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Data Sources
              </span>

              <span className="text-3xl font-extrabold text-white">
                {product?.sources?.length ||
                  product?.sources_count ||
                  0}
              </span>

              <span className="text-xs text-slate-500">
                Multi-source verification
              </span>

            </div>

            {/* CONFLICTS */}

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center space-y-2">

              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Conflicts
              </span>

              <div className="flex items-baseline gap-2">

                <span className="text-3xl font-extrabold text-white">
                  {totalConflicts}
                </span>

                {criticalCount > 0 && (
                  <span className="text-xs text-rose-400 font-bold">
                    ({criticalCount} Critical)
                  </span>
                )}

              </div>

              <span className="text-xs text-slate-500">
                Genuine conflicts requiring attention
              </span>

            </div>

          </div>

          {/* ==================================================
              TRUST SCORE ATTRIBUTE BREAKDOWN
          =================================================== */}

          {trustAttributes.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">

              <div className="px-6 py-5 border-b border-slate-800">

                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Attribute Trust Breakdown
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Backend-computed trust scores for each
                  verified attribute.
                </p>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full text-left text-sm">

                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-500">

                    <tr>

                      <th className="px-6 py-3">
                        Attribute
                      </th>

                      <th className="px-6 py-3">
                        Trust Score
                      </th>

                      <th className="px-6 py-3">
                        Extraction Confidence
                      </th>

                      <th className="px-6 py-3">
                        Conflict
                      </th>

                      <th className="px-6 py-3">
                        Severity
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-800">

                    {trustAttributes.map(attribute => (

                      <tr
                        key={`${attribute.product_id}-${attribute.attribute}`}
                        className="hover:bg-slate-800/30"
                      >

                        <td className="px-6 py-4 font-mono text-xs font-semibold text-white">
                          {String(
                            attribute.attribute || ''
                          ).replace(
                            /_/g,
                            ' '
                          )}
                        </td>

                        <td className="px-6 py-4">

                          <span
                            className={`font-bold ${
                              Number(attribute.score) > 80
                                ? 'text-emerald-400'
                                : Number(attribute.score) > 50
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {Number(
                              attribute.score
                            ).toFixed(1)}
                          </span>

                          <span className="text-slate-600">
                            /100
                          </span>

                        </td>

                        <td className="px-6 py-4 text-xs font-mono text-slate-300">
                          {(
                            Number(
                              attribute.avg_extraction_confidence
                            ) * 100
                          ).toFixed(1)}
                          %
                        </td>

                        <td className="px-6 py-4">

                          {attribute.has_genuine_conflict ? (
                            <span className="text-rose-400 text-xs font-bold">
                              Yes
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-xs font-bold">
                              No
                            </span>
                          )}

                        </td>

                        <td className="px-6 py-4 text-xs uppercase">

                          {attribute.severity ? (
                            <span className="text-rose-300">
                              {String(
                                attribute.severity
                              ).replace(
                                /_/g,
                                ' '
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              None
                            </span>
                          )}

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>
          )}

          {/* ==================================================
              ST-011 DEMO
          =================================================== */}

          {id === 'ST-011' && (
            <div className="bg-cyan-950/40 border border-cyan-500/30 p-6 sm:p-8 rounded-2xl shadow-xl">

              <div className="flex items-center gap-3">

                <span className="w-3 h-3 rounded-full bg-cyan-400" />

                <h3 className="text-lg font-bold text-cyan-200">
                  SEMANTICALLY EQUIVALENT
                </h3>

              </div>

              <p className="text-sm text-slate-300 mt-3">
                Different engineering units were
                normalized into the same technical
                representation.
              </p>

            </div>
          )}

          {/* ==================================================
              ST-017 CLEAN STATE
          =================================================== */}

          {id === 'ST-017' &&
            totalConflicts === 0 && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-8 rounded-2xl text-center shadow-xl">

                <div className="w-12 h-12 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">

                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>

                </div>

                <h3 className="mt-4 text-lg font-bold text-emerald-200">
                  NO GENUINE CONFLICTS DETECTED
                </h3>

                <p className="mt-2 text-sm text-slate-300 max-w-lg mx-auto">
                  All available sources agree or
                  are semantically equivalent after
                  normalization.
                </p>

              </div>
            )}

          {/* ==================================================
              CROSS-SOURCE MATRIX
          =================================================== */}

          {Object.keys(groupedClaims).length > 0 && (

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">

              <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/80">

                <div className="flex items-center justify-between">

                  <div>

                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Cross-Source Attribute Matrix
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Verified specifications extracted
                      across all available sources.
                    </p>

                  </div>

                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    VERIFIED
                  </span>

                </div>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full text-left text-sm text-slate-300">

                  <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">

                    <tr>

                      <th className="py-3.5 px-6">
                        Attribute
                      </th>

                      <th className="py-3.5 px-6">
                        Manufacturer (Tier 1)
                      </th>

                      <th className="py-3.5 px-6">
                        Distributor (Tier 2)
                      </th>

                      <th className="py-3.5 px-6">
                        Web Catalog (Tier 3)
                      </th>

                      <th className="py-3.5 px-6 text-right">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-800/60">

                    {Object.entries(
                      groupedClaims
                    ).map(
                      ([attr, claimList]) => {

                        const mfr =
                          findSourceClaim(
                            claimList,
                            'MFR'
                          );

                        const pim =
                          findSourceClaim(
                            claimList,
                            'PIM'
                          );

                        const web =
                          findSourceClaim(
                            claimList,
                            'WEB'
                          );

                        const conflictItem =
                          findConflictForAttribute(
                            attr
                          );

                        const conflictStatus =
                          String(
                            conflictItem?.status ||
                            ''
                          ).toUpperCase();

                        return (
                          <tr
                            key={attr}
                            className="hover:bg-slate-800/30"
                          >

                            <td className="py-4 px-6 font-semibold text-white capitalize font-mono">
                              {String(
                                attr
                              ).replace(
                                /_/g,
                                ' '
                              )}
                            </td>

                            <td className="py-4 px-6 font-mono text-xs">
                              {formatValue(
                                mfr?.raw_value,
                                mfr?.raw_unit
                              )}
                            </td>

                            <td className="py-4 px-6 font-mono text-xs">
                              {formatValue(
                                pim?.raw_value,
                                pim?.raw_unit
                              )}
                            </td>

                            <td className="py-4 px-6 font-mono text-xs">
                              {formatValue(
                                web?.raw_value,
                                web?.raw_unit
                              )}
                            </td>

                            <td className="py-4 px-6 text-right">

                              {conflictStatus ===
                              'GENUINE_CONFLICT' ? (

                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                                  🔴 Conflict
                                </span>

                              ) : conflictStatus ===
                                'EQUIVALENT' ? (

                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                                  🔵 Equivalent
                                </span>

                              ) : conflictStatus ===
                                'AGREE' ? (

                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                  🟢 Agreement
                                </span>

                              ) : (

                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                  —
                                </span>

                              )}

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

            </div>
          )}

          {/* ==================================================
              GENUINE CONFLICTS
          =================================================== */}

          {genuineConflicts.length > 0 && (

            <div className="space-y-6">

              <div>

                <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                  Detected Specification Conflicts
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Conflicts requiring review or resolution.
                </p>

              </div>

              {genuineConflicts.map(conf => {

                const resItem =
                  findResolutionForConflict(
                    conf.id
                  );

                const isCritical =
                  String(
                    conf.severity || ''
                  ).toUpperCase() ===
                    'CRITICAL' ||
                  String(
                    conf.severity || ''
                  ).toUpperCase() ===
                    'HIGH';

                // ------------------------------------------------
                // SAFE CLAIM ID HANDLING
                // ------------------------------------------------

                const conflictClaimIds =
                  parseClaimIds(
                    conf.claim_ids
                  );

                const conflictClaims =
                  claims.filter(
                    claim =>
                      conflictClaimIds.includes(
                        Number(claim.id)
                      )
                  );

                return (
                  <div
                    key={conf.id}
                    className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl"
                  >

                    {/* HEADER */}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">

                      <div className="flex items-center gap-3">

                        <h4 className="text-xl font-extrabold text-white uppercase font-mono">
                          {String(
                            conf.attribute ||
                            ''
                          ).replace(
                            /_/g,
                            ' '
                          )}
                        </h4>

                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-950 text-rose-300 border border-rose-500/40">
                          🔴 {conf.severity}
                        </span>

                      </div>

                      {isCritical && (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          ⚠ Human Verification Required
                        </span>
                      )}

                    </div>

                    {/* SOURCE VALUES */}

                    <div className="space-y-3">

                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Competing Source Values
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {conflictClaims.length > 0 ? (

                          conflictClaims.map(
                            claim => (

                              <div
                                key={claim.id}
                                className="bg-slate-950 p-4 rounded-xl border border-slate-800"
                              >

                                <span className="text-xs text-slate-400 block">
                                  Source:{' '}

                                  <strong className="text-slate-200">
                                    {claim.source_id}
                                  </strong>
                                </span>

                                <span className="text-base font-bold font-mono text-white block mt-2">
                                  {formatValue(
                                    claim.raw_value,
                                    claim.raw_unit
                                  )}
                                </span>

                                {claim.normalized_value !==
                                  null &&
                                  claim.normalized_value !==
                                    undefined && (

                                    <span className="text-xs text-cyan-400 font-mono block mt-2">
                                      Normalized:{' '}

                                      {formatValue(
                                        claim.normalized_value,
                                        claim.normalized_unit
                                      )}
                                    </span>
                                  )}

                                <div className="mt-3 pt-3 border-t border-slate-800">

                                  <span className="text-[10px] uppercase tracking-wider text-slate-600">
                                    Extraction Confidence
                                  </span>

                                  <span className="block text-xs font-mono text-slate-400 mt-1">
                                    {(
                                      Number(
                                        claim.extraction_confidence
                                      ) * 100
                                    ).toFixed(1)}
                                    %
                                  </span>

                                </div>

                              </div>
                            )
                          )

                        ) : (

                          <div className="md:col-span-3 bg-slate-950 p-5 rounded-xl border border-slate-800">

                            <p className="text-xs text-slate-400">
                              Source claim details are
                              unavailable for this conflict
                              record.
                            </p>

                          </div>

                        )}

                      </div>

                    </div>

                    {/* ARBITRATION RESULT */}

                    <div className="bg-cyan-950/40 border border-cyan-500/30 p-5 rounded-xl space-y-4">

                      <div className="flex flex-wrap items-center justify-between gap-3">

                        <div>

                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Recommended Specification
                          </p>

                          <p className="text-xl font-extrabold text-cyan-300 font-mono mt-1">
                            {resItem
                              ? formatValue(
                                  resItem.resolved_value,
                                  resItem.resolved_unit
                                )
                              : '--'}
                          </p>

                        </div>

                        {resItem &&
                          resItem.confidence !==
                            undefined &&
                          resItem.confidence !==
                            null && (

                            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-3 py-1.5 rounded border border-cyan-500/30">
                              {Number(
                                resItem.confidence
                              ).toFixed(1)}
                              % Confidence
                            </span>

                          )}

                      </div>

                      {resItem?.source_id_chosen && (
                        <p className="text-xs text-slate-400">
                          Selected source:{' '}

                          <span className="font-mono text-slate-200">
                            {resItem.source_id_chosen}
                          </span>
                        </p>
                      )}

                      {resItem?.reviewer_status && (
                        <div>

                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              String(
                                resItem.reviewer_status
                              ).toUpperCase() ===
                              'PENDING_REVIEW'
                                ? 'bg-amber-950 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {String(
                              resItem.reviewer_status
                            ).replace(
                              /_/g,
                              ' '
                            )}
                          </span>

                        </div>
                      )}

                      <div className="pt-3 border-t border-cyan-500/20">

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Explainable Decision
                        </p>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {resItem?.explanation ||
                            conf.rationale_text ||
                            'No explanation available.'}
                        </p>

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

          {/* ==================================================
              NO CONFLICTS
          =================================================== */}

          {analysisComplete &&
            totalConflicts === 0 && (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-8 text-center">

                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl">
                  ✓
                </div>

                <h3 className="mt-4 text-lg font-bold text-emerald-300">
                  No Genuine Conflicts Detected
                </h3>

                <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
                  All analyzed source claims were
                  consistent or semantically equivalent.
                </p>

              </div>
            )}

          {/* ==================================================
              SOURCE PROVENANCE
          =================================================== */}

          {product?.sources?.length > 0 && (

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">

              <div>

                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Source Provenance & Raw Records
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Original source records used during the
                  analysis.
                </p>

              </div>

              <div className="space-y-3">

                {product.sources.map(source => {

                  const isExpanded =
                    expandedSource ===
                    source.id;

                  return (
                    <div
                      key={source.id}
                      className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950"
                    >

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSource(
                            isExpanded
                              ? null
                              : source.id
                          )
                        }
                        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-900/80 transition-colors"
                      >

                        <div className="flex flex-wrap items-center gap-3">

                          <span className="font-mono text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                            {source.id}
                          </span>

                          <span className="font-semibold text-sm text-white">
                            {source.source_name}
                          </span>

                          <span className="text-xs text-slate-400">
                            Tier {source.authority_tier}
                          </span>

                        </div>

                        <span className="text-xs text-slate-400 font-mono">
                          {isExpanded
                            ? 'Hide Raw Text ▲'
                            : 'View Raw Text ▼'}
                        </span>

                      </button>

                      {isExpanded && (
                        <div className="p-5 border-t border-slate-800 bg-slate-900/40">

                          <div className="flex flex-wrap gap-3 mb-4">

                            <span className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">
                              {source.source_type ||
                                'SOURCE'}
                            </span>

                            <span className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">
                              AUTHORITY TIER {source.authority_tier}
                            </span>

                          </div>

                          <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {source.raw_text ||
                              'No raw source text available.'}
                          </pre>

                        </div>
                      )}

                    </div>
                  );
                })}

              </div>

            </div>

          )}

        </>
      )}

    </div>
  );
}