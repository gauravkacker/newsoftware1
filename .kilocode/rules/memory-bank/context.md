# Active Context: HomeoPMS - Homeopathic Patient Management System

## Current State

**Project Status**: ✅ In Development

A complete Homeopathic Patient Management System built with Next.js 16, featuring smart prescription parsing, combination medicine management, and comprehensive patient data handling.

## Recently Completed

- [x] Cloned project from softwarepms.git (February 2025)
- [x] Smart parsing feature for prescriptions
- [x] Combination medicine button and management
- [x] Doctor Panel with dose form column and medicine autocomplete
- [x] Keyboard shortcuts for faster prescription entry
- [x] System memory for prescriptions and medicines
- [x] Repository re-cloned and set up for continued development (February 2026)
- [x] Prescription settings page for configuring default values (Potency, Quantity, Dose Form, Pattern, Frequency, Duration)
- [x] Separate smart parsing input field above prescription table (February 2026)
- [x] Fixed combination medicine autocomplete - initialized database stores and added seed data for 20 common homeopathic combinations (Bioplasgen No. 1-12, Five Phos, BC-1 to BC-6)
- [x] **NEW: Billing Module** (February 2026)
  - Created billing database schema (BillingQueueItem, BillingReceipt)
  - Created billing page with patient queue list
  - Implemented fee details popup with edit functionality
  - Implemented prescription view popup with WhatsApp, Print, PDF options
  - Added patient fee history tab
  - Added fee receipt print functionality
  - Implemented complete button to end patient flow
  - Integrated with pharmacy queue (prepared status → billing)
  - Integrated with doctor panel (bypass pharmacy → billing)
  - Added 'billed' status to appointments
  - Added 'outline' and 'success' button variants

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/doctor-panel/` | Main prescription interface | ✅ Active |
| `src/app/patients/` | Patient management | ✅ Active |
| `src/app/appointments/` | Appointment scheduling | ✅ Active |
| `src/app/queue/` | Queue management | ✅ Active |
| `src/app/settings/` | System settings | ✅ Active |
| `src/app/admin/` | Admin panel | ✅ Active |
| `src/app/billing/` | Billing module | ✅ Active |
| `src/app/pharmacy/` | Pharmacy queue | ✅ Active |
| `src/lib/db/` | Database schema and utilities | ✅ Active |
| `src/components/ui/` | Reusable UI components | ✅ Active |
| `src/components/layout/` | Layout components | ✅ Active |
| `src/lib/auth/` | Authentication context | ✅ Active |

## Current Focus

The project is fully functional. Development continues based on user requirements:

1. New features and enhancements
2. Bug fixes and optimizations
3. User experience improvements

## Quick Start Guide

### Running the Project

```bash
bun install    # Install dependencies
bun dev        # Start dev server
bun build      # Production build
bun lint       # Run ESLint
bun typecheck  # TypeScript checking
```

### Key Features

- **Doctor Panel**: Smart prescription parsing with combination medicines
- **Patient Management**: Full CRUD operations, visit history, tags, import
- **Appointments**: Schedule and manage patient visits
- **Queue System**: Organize patient flow with token management
- **Pharmacy**: Medicine preparation queue with status tracking
- **Billing**: Fee management, receipts, and payment tracking
- **Settings**: Configure fees, registration, time slots, smart parsing
- **Admin**: User management, activity logging

## Available Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard |
| `/login` | Login page |
| `/doctor-panel` | Main prescription interface |
| `/patients` | Patient list and management |
| `/patients/[id]` | Patient details |
| `/patients/new` | New patient registration |
| `/patients/import` | Import patients |
| `/patients/tags` | Patient tags management |
| `/appointments` | Appointment management |
| `/appointments/new` | New appointment |
| `/queue` | Patient queue |
| `/queue/doctor` | Doctor queue view |
| `/pharmacy` | Pharmacy queue |
| `/billing` | Billing and receipts |
| `/settings` | System settings |
| `/settings/fees` | Fee configuration |
| `/settings/slots` | Time slot configuration |
| `/settings/registration` | Registration settings |
| `/settings/smart-parsing` | Smart parsing rules |
| `/admin/users` | User management |
| `/admin/activity-log` | Activity tracking |
| `/messages` | Staff messaging |

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| February 2025 | Cloned from softwarepms.git, ready for continued development |
| February 2026 | Repository re-cloned, dependencies installed, project verified |
| February 2026 | Added separate smart parsing input field above prescription table |
| February 2026 | Fixed combination medicine autocomplete - added database store initialization and seed data |
| February 2026 | Cloned from newsoftware1.git repository, ready for continued development |
| February 2026 | Enhanced pharmacy module: 25/75 layout, Prepared tab, Reopen functionality |
| February 2026 | Added medicines-prepared status for appointments, linked pharmacy to appointments |
| February 2026 | **Added Billing Module**: Complete billing workflow with fee editing, receipts, fee history, WhatsApp/Print/PDF options, and integration with pharmacy and doctor panel |
| February 2026 | **Billing Duplicate Fix**: Fixed issue where patients appeared in both pending and completed tabs after clicking complete - changed billing check to look for existing items by visitId only (not status) |
| February 2026 | **Combination Medicine Fix**: Fixed user-created combinations not showing their content in autocomplete - now saves to database and localStorage with content, updated autocomplete to merge content from both sources |
| February 2026 | **Pharmacy Date Filter**: Added date filter to pharmacy module - shows only today's active and prepared prescriptions by default, with calendar picker to view other dates | |
| February 2026 | **Bill Creation in Prescription View**: Added 'Create Bill' button in billing prescription popup - allows editing amounts for each medicine, calculates subtotal/discount/tax, print and WhatsApp sharing | |
| February 2026 | **Save Bill Feature**: Added Save Bill button to save medicine bills to database, View Bill button on billing page patient row, and medicine amount memory that remembers last entered amounts for each medicine | |
| February 2026 | **Quantity Display Fix**: Fixed quantity display in billing - now shows exact quantity string (e.g., "2dr") from prescription in view mode, and uses bottles field for bill quantity number | |
