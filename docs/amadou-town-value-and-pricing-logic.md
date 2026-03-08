# Amadou Town — Value & Pricing Logic (Source of Truth)

This document specifies the **exact** calculation logic used on the Amadou Town website for value estimates, suggested retail pricing, ROI, and payback. Use it to align external reports (e.g. Gamma AI, Claude) and future integrations so numbers match the site.

**Code references:** `lib/value-calculations.ts`, `lib/value-report-generator.ts`, `lib/dynamic-pricing.ts`, `lib/bundle-item-value-methods.ts`, `app/pricing/methodology/page.tsx`.

---

## 1. Calculation methods (five formulas)

All monetary results are rounded to **2 decimal places**: `Math.round(value * 100) / 100`.

### 1.1 Time Saved

- **Formula:** `hours_per_week × hourly_rate × weeks_per_year`
- **Output:** Annual value (dollars).
- **Best for:** Manual processes, data entry, repetitive tasks.
- **Inputs:** `hours_per_week`, `hourly_rate`, `weeks_per_year` (default 52 if omitted).

### 1.2 Error Reduction

- **Formula:** `error_rate × cost_per_error × annual_volume`
- **Output:** Annual value (dollars).
- **Best for:** Quality issues, compliance, data accuracy.
- **Inputs:** `error_rate` (decimal, e.g. 0.05 = 5%), `cost_per_error`, `annual_volume`.
- **Auto-generation fallbacks when not from benchmarks:** `error_rate = 0.05`, `annual_volume = 1000`.

### 1.3 Revenue Acceleration

- **Formula:** `days_faster × daily_revenue_impact`
- **Output:** Annual value (dollars).
- **Best for:** Speed-to-market, faster sales cycles, quicker delivery.
- **Inputs:** `days_faster`, `daily_revenue_impact`.

### 1.4 Opportunity Cost

- **Formula:** `missed_opportunities × avg_deal_value × close_rate`
- **Output:** Annual value (dollars).
- **Best for:** Lead follow-up, sales pipeline, customer acquisition.
- **Inputs:** `missed_opportunities` (per year), `avg_deal_value`, `close_rate` (decimal, e.g. 0.25 = 25%).

### 1.5 Replacement Cost

- **Formula:** `fte_count × avg_salary × benefits_multiplier`
- **Output:** Annual value (dollars).
- **Best for:** Headcount reduction, automation of full roles.
- **Inputs:** `fte_count` (can be fractional, e.g. 0.5), `avg_salary`, `benefits_multiplier` (default **1.3** if omitted).

---

## 2. Pain point → method and default inputs

When **auto-generating** a value (no existing saved calculation), the following mapping is used. Benchmark-driven inputs (e.g. `hourly_rate`, `avg_deal_value`) are filled from the benchmark lookup (see §3); missing numeric inputs use these defaults.

| Pain point (name)        | Method              | Default inputs |
|--------------------------|---------------------|----------------------------------------|
| `manual_data_entry`      | time_saved          | `hours_per_week: 10`, `weeks_per_year: 52` |
| `slow_response_times`    | opportunity_cost    | `missed_opportunities: 50`, `close_rate: 0.25` |
| `inconsistent_followup` | opportunity_cost    | `missed_opportunities: 100`, `close_rate: 0.20` |
| `scattered_tools`        | time_saved          | `hours_per_week: 5`, `weeks_per_year: 52` |
| `manual_reporting`       | time_saved          | `hours_per_week: 8`, `weeks_per_year: 52` |
| `poor_lead_qualification`| opportunity_cost    | `missed_opportunities: 75`, `close_rate: 0.15` |
| `knowledge_loss`         | replacement_cost    | `fte_count: 0.25`, `benefits_multiplier: 1.3` |
| `scaling_bottlenecks`    | revenue_acceleration| `days_faster: 30` |
| `employee_onboarding`    | time_saved          | `hours_per_week: 15`, `weeks_per_year: 12` |
| `customer_churn`         | opportunity_cost    | `missed_opportunities: 20`, `close_rate: 0.80` |

**Absolute fallback when no benchmark exists:** for **time_saved** only, `hourly_rate = 40` if no `avg_hourly_wage` benchmark is found.

---

## 3. Benchmarks and fallback order

- **Source:** `industry_benchmarks` table (and segment fallbacks in code when DB has no row).
- **Lookup order** (first match wins):
  1. Exact: same `industry` + same `company_size_range` + same `benchmark_type`
  2. Same industry, any size
  3. `industry = '_default'` + same `company_size_range`
  4. `industry = '_default'`, any size

**Benchmark types used per method:**

| Method              | Benchmark type(s) used                          |
|---------------------|--------------------------------------------------|
| time_saved          | `avg_hourly_wage`                                |
| error_reduction     | `avg_error_cost`                                 |
| revenue_acceleration| `avg_daily_revenue`                              |
| opportunity_cost    | `avg_deal_size`, `avg_close_rate`                |
| replacement_cost    | `avg_employee_cost`                              |

---

## 4. Company size normalization

Raw input (e.g. "25", "11-50", "51-200 employees") is normalized to one of:

- `1-10`
- `11-50`
- `51-200`
- `201-1000`

**Rules:**

- Strip non-digits and hyphens; if the result contains a hyphen, treat as a range and use the **low** number to classify: ≤10 → `1-10`, ≤50 → `11-50`, ≤200 → `51-200`, else `201-1000`.
- Single number: same thresholds (≤10, ≤50, ≤200, else `201-1000`).
- **Default** when input is null/empty: `11-50`.

---

## 5. Value report total

- **Definition:** For a given context (industry, company size, and optionally a lead/contact), the report considers all **active** pain point categories.
- **Per pain point:** Either use an existing **value_calculation** row (same pain point + industry + company_size_range, active), or run **auto-generate** using §1, §2, §3, §4.
- **Report total:** Sum of each pain point’s **annual value** (one value per pain point). No impact percentage is applied to this report total.
- **Rounding:** Each line and the total use 2 decimal places.

---

## 6. Suggested retail price (for a service or content piece)

Used when suggesting an anchor price for a **single** product or service (e.g. in ProductClassifier/BundleEditor or for a report line item):

1. Resolve **content → pain points** via `content_pain_point_map` (content_type + content_id).
2. For each mapped pain point, get **annual value** (existing calculation or auto-generate, as in §5).
3. For each mapping, get **impact_percentage** (1–100). If missing, use **100**.
4. **Adjusted value** = `annual_value × (impact_percentage / 100)`, rounded to 2 decimals.
5. **Suggested retail price** = sum of all **adjusted values** for that content, rounded to 2 decimals.
6. **Suggested perceived value** (for display) = same as suggested retail in this flow.

---

## 7. ROI and payback

- **ROI (percentage):**  
  `ROI = (total_pain_point_value - offer_price) / offer_price * 100`  
  Displayed as integer (e.g. "732%").

- **Payback (months):**  
  `payback_months = offer_price / (total_pain_point_value / 12)`  
  - If `total_pain_point_value ≤ 0`, payback is 0.
  - Display: if &lt; 1 month, show **days** (e.g. `Math.round(payback_months * 30)` days); otherwise show one decimal (e.g. "1.2 months").

- **Annual savings** (narrative): Equals `total_pain_point_value`.  
- **Net first-year value:** `total_pain_point_value - offer_price`.

---

## 8. Dynamic tier retail (pricing page)

Used to show **per-item retail values** and **tier totals** that vary by segment/industry/size:

- **Per-item formula:**  
  `retail_value = base_hours × hourly_wage × category_multiplier`  
  (Cumulative items like "Everything in AI Quick Win" use the **referenced tier’s total** instead.)

- **Category multipliers:**

  | Category     | Multiplier |
  |-------------|------------|
  | consulting  | 2.0        |
  | technology  | 2.8        |
  | content     | 1.5        |
  | support     | 1.2        |

- **Segment → default benchmark context:**
  - **smb:** industry `_default`, company size `11-50`
  - **midmarket:** industry `_default`, company size `51-200`
  - **nonprofit:** industry `nonprofit`, company size `1-10`

- **Segment fallback rates** (when no DB benchmark):

  | Segment   | avg_hourly_wage | avg_deal_size | avg_employee_cost | avg_close_rate |
  |-----------|-----------------|--------------|-------------------|----------------|
  | smb       | 42              | 5,000        | 60,000            | 0.20           |
  | midmarket | 58              | 12,000       | 82,000            | 0.22           |
  | nonprofit | 30              | 3,000        | 45,000            | 0.18           |
  | _default  | 40              | 5,000        | 60,000            | 0.20           |

Item titles and their `baseHours`/category/cumulativeRef are defined in `lib/bundle-item-value-methods.ts` (`ITEM_VALUE_METHODS`). Tier totals are the sum of each item’s dynamic (or cumulative) value.

---

## 9. Confidence levels

Used for display and filtering (e.g. "Based on industry benchmarks" vs "Based on N data points"):

- **High:** Evidence count ≥ 5 and benchmarks present; or ≥ 5 with direct monetary evidence.
- **Medium:** Evidence count ≥ 2 with benchmarks; or ≥ 2 without.
- **Low:** Otherwise.

---

## 10. Data sources (methodology page)

Referenced for transparency on the public methodology page:

- Bureau of Labor Statistics (BLS) — hourly wages, employee costs, industry data
- Glassdoor Salary Data — role-specific salaries, compensation benchmarks
- HubSpot Sales Benchmark Report — deal sizes, close rates, sales cycle length
- McKinsey & Company — AI adoption, automation potential by industry
- Gartner IT Spending Forecasts — IT budgets, tool spending

---

## Summary checklist for external reports

To align an external report (e.g. Gamma/Claude) with Amadou Town:

1. Use **only** the five methods in §1 with the formulas and rounding above.
2. Use the **pain point → method + default inputs** in §2 when no saved calculation exists.
3. Apply **benchmark fallback** order in §3 and **company size** normalization in §4.
4. For a **single total** (e.g. “total cost of problems”): sum one annual value per pain point (§5).
5. For a **suggested price for one offer**: use content → pain points → impact % → sum(adjusted value) (§6).
6. For **ROI and payback**, use the formulas in §7.
7. If showing **tier or item retail**, use §8 (baseHours × rate × multiplier, segment fallbacks).
8. State **industry**, **company size** (normalized), and for each line: **pain point**, **method**, **inputs**, and **result** so the report can be audited against this spec.
