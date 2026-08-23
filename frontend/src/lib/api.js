const API_BASE =
  'https://spectrust-ai-backend.onrender.com';

// ============================================================
// Internal helpers
// ============================================================

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function parseResponse(res) {
  const data =
    await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed (HTTP ${res.status})`
    );
  }

  return data;
}

// ============================================================
// Health Check
// ============================================================

export async function checkBackendHealth() {
  try {
    const res = await fetch(
      buildUrl('/api/health')
    );

    if (!res.ok) {
      return {
        connected: false,
        error: `HTTP ${res.status}`
      };
    }

    const data =
      await res.json();

    return {
      connected:
        data?.ok === true,
      data
    };

  } catch (err) {
    return {
      connected: false,
      error:
        err?.message ||
        'Unable to connect to backend'
    };
  }
}

// ============================================================
// Products
// ============================================================

export async function fetchProducts() {
  const res = await fetch(
    buildUrl('/api/products')
  );

  return await parseResponse(res);
}

// ============================================================
// Product Details
// ============================================================

export async function fetchProductDetails(id) {
  const safeId =
    encodeURIComponent(id);

  const res = await fetch(
    buildUrl(
      `/api/products/${safeId}`
    )
  );

  return await parseResponse(res);
}

// ============================================================
// Claims
// ============================================================

export async function fetchClaims(id) {
  const safeId =
    encodeURIComponent(id);

  const res = await fetch(
    buildUrl(
      `/api/products/${safeId}/claims`
    )
  );

  return await parseResponse(res);
}

// ============================================================
// Conflicts
// ============================================================

export async function fetchConflicts(id) {
  const safeId =
    encodeURIComponent(id);

  const res = await fetch(
    buildUrl(
      `/api/products/${safeId}/conflicts`
    )
  );

  return await parseResponse(res);
}

// ============================================================
// Resolutions
// ============================================================

export async function fetchResolutions(id) {
  const safeId =
    encodeURIComponent(id);

  const res = await fetch(
    buildUrl(
      `/api/products/${safeId}/resolutions`
    )
  );

  return await parseResponse(res);
}

// ============================================================
// Trust Score
// ============================================================

export async function fetchTrustScore(id) {
  const safeId =
    encodeURIComponent(id);

  const res = await fetch(
    buildUrl(
      `/api/products/${safeId}/trust-score`
    )
  );

  return await parseResponse(res);
}

// ============================================================
// Full Product Analysis
// ============================================================

export async function runFullPipeline(id) {
  const safeId =
    encodeURIComponent(id);

  const res = await fetch(
    buildUrl(
      `/api/products/${safeId}/analyze`
    ),
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      }
    }
  );

  const data =
    await res.json().catch(
      () => null
    );

  if (!res.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Product analysis failed (HTTP ${res.status})`
    );
  }

  if (data?.success !== true) {
    throw new Error(
      data?.error ||
      data?.message ||
      'Product analysis failed.'
    );
  }

  if (
    data?.analysis_complete !== true
  ) {
    throw new Error(
      data?.error ||
      'Backend did not complete the product analysis.'
    );
  }

  return data;
}

// ============================================================
// Convenience: Analyze Product
// ============================================================

export async function analyzeProduct(id) {
  const data =
    await runFullPipeline(id);

  return {
    success: true,

    product_id:
      data.product_id,

    analysis_complete:
      data.analysis_complete,

    claims:
      data?.extraction?.claims || [],

    conflicts:
      data?.conflict_detection?.conflicts || [],

    resolutions:
      data?.arbitration?.resolutions || [],

    trustScore:
      data?.trust_score
        ?.product_trust_score ?? null,

    trustAttributes:
      data?.trust_score
        ?.attributes || [],

    raw: data
  };
}

// ============================================================
// Fetch all product conflicts
// ============================================================

export async function fetchAllProductConflicts() {
  const productsData =
    await fetchProducts();

  const products =
    Array.isArray(
      productsData?.products
    )
      ? productsData.products
      : [];

  if (!products.length) {
    return {
      success: true,
      count: 0,
      conflicts: []
    };
  }

  const results =
    await Promise.all(
      products.map(
        async product => {

          try {

            const conflictData =
              await fetchConflicts(
                product.id
              );

            const conflicts =
              Array.isArray(
                conflictData?.conflicts
              )
                ? conflictData.conflicts
                : [];

            return conflicts.map(
              conflict => ({
                ...conflict,

                product_id:
                  product.id,

                product_name:
                  product.name,

                product_category:
                  product.category,

                product_image:
                  product.image_url
              })
            );

          } catch (error) {

            console.warn(
              `[API] Failed to fetch conflicts for ${product.id}:`,
              error
            );

            return [];
          }
        }
      )
    );

  const conflicts =
    results.flat();

  return {
    success: true,
    count: conflicts.length,
    conflicts
  };
}

// ============================================================
// Global Conflict Center
// ============================================================

export async function fetchGlobalConflictCenter() {
  const data =
    await fetchAllProductConflicts();

  const conflicts =
    Array.isArray(
      data?.conflicts
    )
      ? data.conflicts
      : [];

  const genuineConflicts =
    conflicts.filter(
      conflict =>
        String(
          conflict?.status || ''
        ).toUpperCase() ===
        'GENUINE_CONFLICT'
    );

  return {
    success: true,

    count:
      genuineConflicts.length,

    conflicts:
      genuineConflicts
  };
}

// ============================================================
// Human Review Queue
//
// Loads genuine conflicts and keeps only high-risk items.
//
// IMPORTANT:
// This endpoint does NOT modify backend records.
// Reviewer decisions in the current MVP are stored in
// browser localStorage by ReviewQueue.jsx.
// ============================================================

export async function fetchReviewQueue() {
  const data =
    await fetchGlobalConflictCenter();

  const conflicts =
    Array.isArray(
      data?.conflicts
    )
      ? data.conflicts
      : [];

  const reviewItems =
    conflicts.filter(
      conflict => {

        const severity =
          String(
            conflict?.severity || ''
          ).toUpperCase();

        return (
          severity === 'CRITICAL' ||
          severity === 'HIGH' ||
          severity === 'SAFETY_CRITICAL' ||
          severity === 'COMPATIBILITY_RISK'
        );
      }
    );

  return {
    success: true,
    count: reviewItems.length,
    conflicts: reviewItems
  };
}