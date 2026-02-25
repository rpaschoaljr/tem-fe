# Copilot Instructions

## Project Overview

**TEM-FE** is an Angular 20 frontend for managing an Afro-Brazilian religious temple (terreiro). It handles member registration, financial transactions, and stock/inventory — all currently backed by **mock data stored in `localStorage`**, with Firebase infrastructure already configured for future migration.

## Commands

```bash
npm start          # dev server at http://localhost:4200
ng serve           # same as above
ng build           # production build to dist/
ng test            # run all tests with Karma/Jasmine

# Run a single test file (target a specific spec):
ng test --include src/app/features/members/members.spec.ts
```

## Firebase Setup

`app.config.ts` is gitignored — it holds real Firebase credentials. Use `app.config.example.ts` as the template:
1. Copy `app.config.example.ts` → `app.config.ts`
2. Fill in Firebase credentials from the Firebase console

In dev mode (`isDevMode()`), all Firebase services automatically connect to local emulators:
- Auth: `localhost:9099`
- Firestore: `localhost:8080`
- Storage: `localhost:9199`

## Architecture

```
src/app/
├── core/
│   ├── layout/main-layout/   # Shell: sidenav + toolbar + router-outlet
│   ├── models/               # TypeScript interfaces (Member, Transaction, StockItem)
│   └── services/             # Data services (currently localStorage-backed mocks)
├── features/
│   ├── auth/login/
│   ├── dashboard/
│   ├── members/              # List + member-form (create/edit)
│   ├── finance/
│   └── stock/
└── shared/
    ├── components/generic-list/  # Reusable Material table with filter/sort/pagination
    ├── directives/input-mask     # CPF, phone, CEP, date formatting
    └── utils/validators          # CustomValidators (CPF, dateReal, dateRange)
```

### Routing pattern

All authenticated routes are children of `MainLayoutComponent`. The login route is standalone (no layout):
```
/login                  → LoginComponent (no layout)
/                       → MainLayoutComponent
  /dashboard
  /members
  /members/new
  /members/edit/:id
  /finance
  /stock
```

## Key Conventions

### Standalone components only
All components, directives, and pipes use `standalone: true`. There are no NgModules. Import Angular Material modules directly in each component's `imports` array.

### Dependency injection with `inject()`
Use `inject()` inside the class body, not constructor injection:
```typescript
private service = inject(MyService);
```

### Service data layer (mock → Firebase migration path)
Services currently simulate Firestore using `localStorage` with a 15-minute cache. The pattern to follow:
- `getItems(forceRefresh = false)` returns `Observable<T[]>` via `of(data).pipe(delay(500))`
- `softDelete(id)` sets `deleted: true`, never hard-deletes
- `restore(id)` sets `deleted: false`
- Always call `updateCache(data)` after writes
- Date fields stored as JSON strings must be reconstructed via a `fixDates()` helper on read

### GenericListComponent
The shared `<app-generic-list>` wraps a Material table with built-in filter, sort, pagination, soft-delete toggle, and edit/delete/restore actions. Use it for all list views:
```typescript
tableColumns: ColumnDef[] = [
  { def: 'name', label: 'Nome' },
  { def: 'status', label: 'Status', type: 'status' }
];
// In template:
// <app-generic-list [data]="items" [columns]="tableColumns"
//   (editAction)="onEdit($event)" (deleteAction)="onDelete($event)" (restoreAction)="onRestore($event)" />
```
Column `type` options: `'text' | 'date' | 'currency' | 'status' | 'stock-level'`

### InputMaskDirective
Apply formatting masks to inputs with `[appInputMask]="'type'"`:
```html
<input [appInputMask]="'cpf'" formControlName="cpf">
<input [appInputMask]="'phone'" formControlName="phone">
<input [appInputMask]="'cep'" formControlName="cep">
<input [appInputMask]="'date'" formControlName="someDate">
```

### Notifications
Use `NotificationService` (wraps `MatSnackBar`) for all user feedback:
```typescript
this.notify.showSuccess('Mensagem de sucesso');
this.notify.showError('Mensagem de erro');
```

### Dark mode
`ThemeService` manages dark/light mode via Angular `signal()`. It persists to `localStorage` and applies/removes the `dark-theme` CSS class on `<html>` and `<body>`.

### Locale
The app is in **Brazilian Portuguese**. All user-facing strings, labels, and error messages should be in pt-BR. Date locale is `'pt-BR'` (`MAT_DATE_LOCALE`). CEP lookups use the public ViaCEP API (`https://viacep.com.br`).

### Member model domain
The `Member` interface includes Afro-Brazilian spiritual roles (`MÉDIUM`, `CAMBONO`, `OGÃ`, etc.), ritual dates (initiation, baptism, coronation, etc.), and consecrations keyed by Orixá name (oxossi, iemanja, ogum, etc.). Respect this domain terminology when adding features.

### Prettier config
`printWidth: 100`, `singleQuote: true`, Angular parser for `.html` files (configured in `package.json`).
