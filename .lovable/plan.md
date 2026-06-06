## Budget Management Module

Builds on the existing `committees` table (9 committees already seeded). Adds line-item budget management with real-time aggregation into the Finance dashboard.

### 1. Database (one migration)

New table `public.budget_items`:
- `id` uuid PK
- `committee_id` uuid FK → `committees(id)` on delete cascade
- `item_name` text not null
- `quantity` numeric(12,2) not null, CHECK > 0
- `unit_cost` numeric(12,2) not null, CHECK >= 0
- `total_cost` numeric(12,2) GENERATED ALWAYS AS (`quantity * unit_cost`) STORED
- `notes` text nullable
- `created_by` uuid, `created_at`, `updated_at` (+ trigger)

Indexes: `(committee_id)`, `(created_at desc)`.

Grants: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`.

RLS policies:
- SELECT: admin, quality, supreme member, finance committee member, OR member of `committee_id` itself.
- INSERT/UPDATE/DELETE: admin OR member of `committee_id` (head can edit too via existing helpers).
- Finance committee gets read-only across all rows; cannot edit other committees' items.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_items` and `REPLICA IDENTITY FULL`.

### 2. Committee budget panel (per-committee)

New component `src/components/committee/CommitteeBudgetItems.tsx`, embedded in `src/routes/_app.committee.$type.tsx` (visible to that committee's members + admins).

Features:
- Inline editable table: Item, Quantity, Unit Cost, Total (auto = qty × unit, computed live in UI), Notes, actions.
- Add row inline; edit in place; delete with confirm.
- Client validation: qty > 0, unit_cost ≥ 0, name required (zod).
- Live Grand Total footer (sums client state, reconciled with DB after mutations).
- Supabase realtime subscription on `budget_items` filtered by `committee_id` for cross-tab sync.
- Export buttons: Excel (CSV via existing util) and PDF (branded, see §4).

### 3. Finance Dashboard aggregation

Add a new tab/section "ميزانيات اللجان" inside `src/components/FinanceModule.tsx` (rendered under `/finance-management`, already restricted to finance/admin/quality/supreme).

Features:
- Summary widget: "إجمالي ميزانية المشروع" = sum of all `total_cost`.
- Per-committee aggregated table: Committee name, item count, grand total, % of overall.
- Expandable row to show that committee's line items (read-only).
- Filters: by committee (multi-select), sort by highest cost, search by item name.
- Realtime subscription on all `budget_items` → recompute aggregates instantly.
- Export buttons: full Excel workbook (one sheet per committee + summary sheet) and consolidated branded PDF.

### 4. Branded PDF & Excel export

Reuse `src/lib/report-shared.ts` tokens + `src/lib/print-frame.ts` for printable HTML → PDF (browser print dialog, same pattern used elsewhere in the project).

PDF template:
- Header: logo (`src/assets/brand-logo.ts`), official title "لجنة الزواج الجماعي", committee name, Hijri/Gregorian date, reference number (`buildReferenceNumber`).
- Table: Item | Quantity | Unit Cost | Total Cost.
- Footer: page number, watermark from `watermarkCss`.
- Grand Total highlighted row at bottom (bold, gold accent).

Excel: use existing exporter pattern in `src/lib/exporters.ts` (CSV with BOM for Arabic). For multi-sheet workbooks on Finance dashboard, add a lightweight xlsx export via `xlsx` lib if not present — otherwise emit one CSV per committee in a zip; will confirm during build.

### 5. Access & wiring

- Use existing `useAuth()` + `has_role` / `is_committee_member` helpers (no new roles).
- Add link in finance management page sidebar/tabs.
- Mobile-responsive table (existing Tailwind patterns + horizontal scroll wrapper as in `CommitteeBudgetLimits.tsx`).

### Technical notes

- `total_cost` is a generated column → DB enforces the formula; UI computes the same for instant feedback.
- Realtime keeps Finance dashboard and committee pages in sync with no refresh.
- Validation: zod schema both client-side (form) and DB-level (CHECK constraints).
- No edge functions needed; all CRUD via supabase-js with RLS.

### Open question

Should each committee's grand total automatically update `committees.budget_allocated` (the existing field consumed by `CommitteeBudgetLimits`), or keep line-item totals separate from the manually-set allocated cap? Default: keep separate — budget items represent *requested* spending; the allocated cap stays an admin/finance decision. Confirm before implementation.
