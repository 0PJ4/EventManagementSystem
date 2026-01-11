# Multi-Tenant Event Booking System

A comprehensive prototype of a multi-tenant event booking system built with NestJS (backend), React (frontend), and PostgreSQL (database). This system allows organizations to manage events, attendees, and shared resources with complex business rules and constraints.

## 🏗️ Architecture

### Backend (NestJS)
- **Framework**: NestJS with TypeORM
- **Database**: PostgreSQL
- **Port**: 3000 (default)

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Port**: 5173 (default)

### Database Features
- Composite unique constraints
- Check constraints
- Foreign keys with cascading rules
- Recursive CTE queries (for parent-child event validation)
- Materialized views (for resource utilization optimization)

## 📋 Features

### 1. Multi-Tenant Structure
- Users belong to exactly one organization
- Events and resources belong to organizations
- Global resources can be shared across organizations

### 2. Event Scheduling
- Create events with start/end times and capacity
- Support for parent-child events (multi-session events)
- Validation that users cannot be double-booked across overlapping events
- Validation that parent events fully contain child sessions

### 3. Resource Allocation
- **Exclusive Resources**: Cannot overlap in time (e.g., rooms)
- **Shareable Resources**: Have max concurrent usage limits (e.g., projectors)
- **Consumable Resources**: Track quantity used per event (e.g., printed materials)

### 4. Attendee Management
- Users can register for events within their organization
- External attendees (email-only, no user account) supported
- Check-in tracking with timestamps

### 5. Complex Reporting Queries
All implemented with raw SQL:

- **Double-Booked Users**: Find users registered for overlapping events
- **Violated Constraints**: List events that violate resource constraints
  - Over-allocated shareable resources
  - Exclusive resources double-booked
  - Consumables exceeding available quantity
- **Resource Utilization**: Compute per organization
  - Total hours used
  - Peak concurrent usage
  - Underutilized resources
- **Parent-Child Violations**: Find parent events whose child sessions violate time boundaries (uses recursive CTE)
- **External Attendees**: List events with external attendees exceeding a threshold

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Database Setup

1. Create a PostgreSQL database:
```bash
createdb event_booking
```

2. Update database configuration in `backend/src/app.module.ts` or use environment variables:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=event_booking
```

3. Run migrations:
```bash
cd backend
npm install
npm run migration:run
```

### Backend Setup

```bash
cd backend
npm install
npm run start:dev
```

The backend will be available at `http://localhost:3000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 📁 Project Structure

```
event_booking_system/
├── backend/
│   ├── src/
│   │   ├── entities/          # TypeORM entities
│   │   ├── migrations/         # Database migrations
│   │   ├── organizations/      # Organizations module
│   │   ├── users/              # Users module
│   │   ├── events/             # Events module
│   │   ├── resources/          # Resources module
│   │   ├── attendances/        # Attendances module
│   │   ├── allocations/        # Resource allocations module
│   │   ├── reports/            # Reporting module (complex SQL queries)
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── contexts/           # React contexts
│   │   ├── services/           # API services
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 🔌 API Endpoints

### Organizations
- `GET /organizations` - List all organizations
- `POST /organizations` - Create organization
- `GET /organizations/:id` - Get organization
- `PATCH /organizations/:id` - Update organization
- `DELETE /organizations/:id` - Delete organization

### Users
- `GET /users?organizationId=:id` - List users (optional filter)
- `POST /users` - Create user
- `GET /users/:id` - Get user
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Events
- `GET /events?organizationId=:id` - List events (optional filter)
- `POST /events` - Create event
- `GET /events/:id` - Get event
- `PATCH /events/:id` - Update event
- `DELETE /events/:id` - Delete event

### Resources
- `GET /resources?organizationId=:id&isGlobal=true` - List resources (optional filters)
- `POST /resources` - Create resource
- `GET /resources/:id` - Get resource
- `PATCH /resources/:id` - Update resource
- `DELETE /resources/:id` - Delete resource

### Attendances
- `GET /attendances?eventId=:id` - List attendances (optional filter)
- `POST /attendances` - Register attendee
- `POST /attendances/:id/checkin` - Check in attendee
- `DELETE /attendances/:id` - Remove attendance

### Resource Allocations
- `GET /allocations?eventId=:id&resourceId=:id` - List allocations (optional filters)
- `POST /allocations` - Allocate resource to event
- `DELETE /allocations/:id` - Remove allocation

### Reports (Complex SQL Queries)
- `GET /reports/double-booked-users` - Find double-booked users
- `GET /reports/violated-constraints` - Find events with violated constraints
- `GET /reports/resource-utilization?organizationId=:id` - Resource utilization per organization
- `GET /reports/parent-child-violations` - Find parent-child time violations (recursive CTE)
- `GET /reports/external-attendees?threshold=10` - Events with external attendees exceeding threshold
- `POST /reports/refresh-utilization-view` - Refresh materialized view

## 🎯 Business Rules & Constraints

### Event Constraints
1. End time must be after start time (database check constraint)
2. Users cannot be double-booked across overlapping events (application validation)
3. Parent events must fully contain all child sessions (application validation)
4. Child sessions must be within parent event time boundaries (application validation)

### Resource Constraints
1. Exclusive resources cannot overlap in time (application validation)
2. Shareable resources have max concurrent usage limits (application validation)
3. Consumables must not exceed available quantity (application validation)
4. Available quantity must be non-negative (database check constraint)

### Attendance Constraints
1. Attendance requires either userId OR userEmail (not both) (database check constraint)
2. External attendees only allowed if event.allowExternalAttendees is true
3. Event capacity cannot be exceeded
4. Unique constraint: (eventId, userId) for user attendances
5. Unique constraint: (eventId, userEmail) for external attendances

### Database Constraints
- Composite unique constraints on resource_allocations (eventId, resourceId)
- Partial unique indexes on attendances (eventId, userId) and (eventId, userEmail)
- Foreign keys with CASCADE delete rules
- Check constraints for data integrity

## 📊 Reporting Queries Details

### 1. Double-Booked Users
Uses JOINs to find users with overlapping event attendances.

### 2. Violated Constraints
Uses UNION ALL with three subqueries:
- Exclusive resources double-booked
- Shareable resources over-allocated
- Consumables exceeding available quantity

### 3. Resource Utilization
Uses aggregation and window functions to calculate:
- Total hours used per resource
- Peak concurrent usage
- Underutilized resources (< 10 hours)

### 4. Parent-Child Violations
Uses recursive CTE to traverse parent-child relationships and find time boundary violations.

### 5. External Attendees
Uses GROUP BY and HAVING to find events with external attendees exceeding threshold.

## 🗄️ Database Schema

### Tables
- `organizations` - Organization entities
- `users` - User entities (belong to one organization)
- `events` - Event entities (belong to one organization, optional parent event)
- `resources` - Resource entities (belong to one organization or global)
- `attendances` - Attendance records (user or external attendee)
- `resource_allocations` - Resource allocation records

### Materialized View
- `resource_utilization_summary` - Pre-computed resource utilization data

## 🧪 Testing

Run backend tests:
```bash
cd backend
npm test
```

Run frontend linting:
```bash
cd frontend
npm run lint
```

## 📝 Notes

- The system uses raw SQL for all reporting queries as required
- All complex business validations are implemented in services
- The frontend uses mocked organization switching (context-based)
- Materialized views can be refreshed for performance optimization
- All foreign keys use CASCADE delete rules for data integrity

## 🔧 Environment Variables

Create a `.env` file in the `backend` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=event_booking
PORT=3000
```

## 📚 Technology Stack

- **Backend**: NestJS, TypeORM, PostgreSQL
- **Frontend**: React, TypeScript, Vite, Axios
- **Database**: PostgreSQL with advanced SQL features

## 🎨 Frontend Features

- Organization switcher (mocked, context-based)
- Event list and creation/edit form
- Resource list and allocation UI
- Attendee registration form (supports users and external attendees)
- Comprehensive reporting dashboard with multiple report types

## 🔒 Security Considerations

- Input validation using class-validator
- SQL injection prevention via parameterized queries
- CORS configuration for frontend-backend communication

## 📄 License

This is a prototype project for demonstration purposes.
