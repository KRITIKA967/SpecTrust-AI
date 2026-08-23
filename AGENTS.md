**# SpecTrust-AI Hackathon Project Instructions**



**## IMPORTANT**



**This is an EXISTING working hackathon MVP.**



**DO NOT rebuild the project from scratch.**



**DO NOT delete existing functionality.**



**DO NOT reset or delete the SQLite database.**



**DO NOT reseed the database unless explicitly requested.**



**DO NOT modify completed checkpoints unnecessarily.**



**Before changing code:**

**1. Inspect the existing implementation.**

**2. Identify the exact files/functions responsible.**

**3. Explain the proposed change.**

**4. Make the smallest safe change.**

**5. Run only relevant tests/build commands.**

**6. Report exactly what changed.**



**## CURRENT STATUS**



**Checkpoints 1–6 are implemented.**



**Database:**

**- 18 products**

**- 54 source records**

**- 3 sources per product**



**## DEMO PRODUCTS**



**### ST-001**



**SV-220B Direct-Acting 2/2-Way Solenoid Valve**



**Manufacturer: 24 VDC**

**PIM: 24 VDC**

**Web: 220 VAC**



**Expected result:**

**CRITICAL CONFLICT**



**Recommended value:**

**24 VDC**



**Human verification:**

**REQUIRED**



**### ST-011**



**PT-820 Pressure Transmitter**



**Manufacturer: 0–10 bar**

**PIM: 0–1 MPa**

**Web: 0–1000 kPa**



**Expected result:**

**SEMANTICALLY EQUIVALENT**



**Normalized result:**

**0–10 bar**



**Conflict:**

**NONE**



**### ST-017**



**CG-2012 Nylon Cable Gland**



**Manufacturer: M20x1.5**

**PIM: M20x1.5**

**Web: M20x1.5**



**Expected result:**

**CLEAN AGREEMENT**



**Conflict:**

**NONE**



**## EXISTING ARCHITECTURE**



**Backend:**

**- Node.js**

**- Express**

**- SQLite**

**- extraction pipeline**

**- normalization pipeline**

**- conflict detection**

**- arbitration**

**- product APIs**



**Frontend:**

**- React**

**- React Router**

**- Product List**

**- Product Analysis page**



**## CRITICAL RULES**



**Never create duplicate conflict-detection logic in the frontend.**



**The frontend must consume backend conflict/arbitration results.**



**Never replace deterministic normalization with random/mock AI output.**



**Preserve source provenance.**



**Preserve authority tiers.**



**Preserve explainability.**



**Do not add dependencies unless necessary.**



**Do not perform broad refactors during checkpoint implementation.**



**## TESTING**



**After every checkpoint:**

**- run relevant tests**

**- run frontend build when UI changes**

**- verify ST-001**

**- verify ST-011**

**- verify ST-017**



**Do not run npm install repeatedly.**



**Do not initialize or reseed the database unless explicitly requested.**



**## HACKATHON PRIORITY**



**The goal is not maximum feature count.**



**The goal is a reliable demonstration of:**



**1. Multi-source extraction**

**2. Semantic normalization**

**3. Conflict detection**

**4. Explainable arbitration**

**5. Source trust/provenance**

**6. Human verification**

**7. Trust scoring**

**8. Actionable review workflow**



**A smaller reliable feature is better than a large broken feature.**

