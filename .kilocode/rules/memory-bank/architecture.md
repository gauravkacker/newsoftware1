# System Patterns: HomeoPMS - Homeopathic Patient Management System

## Architecture Overview

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Login page
│   ├── globals.css         # Tailwind imports + global styles
│   ├── favicon.ico         # Site icon
│   ├── doctor-panel/       # Main prescription interface
│   ├── patients/           # Patient management
│   ├── appointments/       # Appointment scheduling
│   ├── queue/              # Queue management
│   ├── settings/           # System settings
│   ├── admin/              # Admin panel
│   ├── messages/           # Messaging
│   ├── login/              # Authentication
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # Reusable UI components
│   └── layout/             # Layout components (Header, Sidebar)
├── lib/                    # Utilities and helpers
│   ├── auth/               # Authentication
│   └── db/                 # Database (better-sqlite3)
└── types/                  # TypeScript types
```

## Key Design Patterns

### 1. App Router Pattern

Uses Next.js App Router with file-based routing:
```
src/app/
├── page.tsx              # Route: / (login)
├── doctor-panel/page.tsx # Route: /doctor-panel
├── patients/page.tsx     # Route: /patients
├── patients/[id]/page.tsx # Route: /patients/:id
├── appointments/page.tsx # Route: /appointments
├── queue/page.tsx        # Route: /queue
├── settings/page.tsx     # Route: /settings
├── admin/page.tsx        # Route: /admin
└── api/route.ts          # API endpoints
```

### 2. Component Organization Pattern

```
src/components/
├── ui/                   # Reusable UI components (Button, Card, Input, Badge, PhotoUpload)
└── layout/               # Layout components (Header, Sidebar)
```

### 3. Server Components by Default

All components are Server Components unless marked with `"use client"`:
```tsx
// Server Component (default) - can fetch data, access DB
export default function Page() {
  return <div>Server rendered</div>;
}

// Client Component - for interactivity
"use client";
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### 4. Layout Pattern

Layouts wrap pages and can be nested:
```tsx
// src/app/layout.tsx - Root layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

// src/app/doctor-panel/layout.tsx - Nested layout
export default function DoctorPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

### 5. Database Pattern (better-sqlite3)

```typescript
// lib/db/database.ts
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'clinic.db');
export const db = new Database(dbPath);

// lib/db/schema.ts - Database schema definitions
```

## Styling Conventions

### Tailwind CSS Usage
- Utility classes directly on elements
- Component composition for repeated patterns
- Responsive: `sm:`, `md:`, `lg:`, `xl:`

### Common Patterns
```tsx
// Container
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Flexbox centering
<div className="flex items-center justify-center">
```

## File Naming Conventions

- Components: PascalCase (`Button.tsx`, `Header.tsx`)
- Utilities: camelCase (`utils.ts`, `helpers.ts`)
- Pages/Routes: lowercase (`page.tsx`, `layout.tsx`)
- Directories: lowercase (`components/`, `lib/`)
- API Routes: lowercase with hyphens (`combinations/route.ts`)

## State Management

For simple needs:
- `useState` for local component state
- `useContext` for shared state (auth-context.tsx)
- Server Components for data fetching

For complex needs:
- Consider Zustand for client state
- Consider React Query for server state
