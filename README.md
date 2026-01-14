# 🎫 Multi-Tenant Event Booking System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-UNLICENSED-lightgrey.svg)](LICENSE)

A comprehensive multi-tenant event booking system built with **NestJS** (backend), **React** (frontend), and **PostgreSQL** (database). This system enables organizations to manage events, attendees, resources, and invitations with complex business rules, real-time inventory tracking, and comprehensive reporting capabilities.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Business Rules](#-business-rules)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🏢 Multi-Tenant Architecture
- **Organizations**: Isolated tenant spaces with domain-based user assignment
- **Role-Based Access Control**: Super Admin, Organization Admin, and User roles
- **Organization Switching**: Context-based organization management
- **Global Resources**: Shareable resources across organizations

### 📅 Event Management
- **Event Creation & Scheduling**: Create events with start/end times, capacity, and status
- **Parent-Child Events**: Support for multi-session events with hierarchical relationships
- **Event Status**: Draft, Published, and Cancelled states
- **External Attendees**: Support for email-only attendees without user accounts
- **Time Validation**: Automatic validation of event time boundaries
- **Past Event Protection**: Organization admins cannot edit/delete past events

### 🎫 Invitation System
- **User Invitations**: Invite registered users to events
- **External Invitations**: Invite external attendees via email
- **Public Invite Links**: Token-based public invitation acceptance
- **Invite Status Tracking**: Pending, Accepted, Declined, and Cancelled states
- **Email Notifications**: Automated email notifications for invitations
- **Validation**: Prevents inviting to past, draft, or cancelled events

### 📦 Resource Management
- **Three Resource Types**:
  - **Exclusive**: Cannot overlap in time (e.g., conference rooms)
  - **Shareable**: Max concurrent usage limits (e.g., projectors)
  - **Consumable**: Quantity-based tracking with inventory ledger (e.g., printed materials)
- **Resource Allocation**: Allocate resources to events with quantity tracking
- **Availability Checking**: Real-time availability validation
- **Inventory Ledger**: Transaction-based inventory tracking for consumables
- **Stock Management**: RESTOCK, ALLOCATION, RETURN, and ADJUSTMENT transactions

### 👥 Attendance Management
- **User Registration**: Registered users can register for events
- **External Registration**: Email-based registration for external attendees
- **Check-In System**: Timestamp-based check-in tracking
- **Capacity Management**: Automatic capacity validation
- **Double-Booking Prevention**: Users cannot be registered for overlapping events
- **Deregistration**: Time-based deregistration rules (15-minute window)

### 📊 Reporting & Analytics
- **Double-Booked Users**: Identify users registered for overlapping events
- **Violated Constraints**: Find events violating resource constraints
- **Resource Utilization**: Per-organization resource usage analytics
- **Parent-Child Violations**: Detect time boundary violations in hierarchical events
- **External Attendees Report**: Events with external attendees exceeding thresholds
- **Show-Up Rate**: Calculate attendance vs. registration rates
- **Capacity Utilization**: Track event capacity usage
- **Interactive Dashboards**: Visual charts and graphs for analytics

### 🔒 Security & Authentication
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **Input Validation**: class-validator for DTO validation
- **SQL Injection Prevention**: Parameterized queries
- **CORS Configuration**: Secure frontend-backend communication
- **Route Protection**: Role-based route guards

## 🏗️ Architecture

### Backend (NestJS)
- **Framework**: NestJS 10.0 with TypeScript
- **ORM**: TypeORM 0.3.17
- **Database**: PostgreSQL 12+
- **Authentication**: JWT with Passport
- **Validation**: class-validator & class-transformer
- **Email**: Nodemailer with @nestjs-modules/mailer
- **Port**: 3000 (default)

### Frontend (React)
- **Framework**: React 18.2 with TypeScript
- **Build Tool**: Vite 6.4
- **Routing**: React Router DOM 6.15
- **HTTP Client**: Axios 1.5
- **UI Notifications**: react-hot-toast 2.6
- **Charts**: Recharts 3.6
- **Date Handling**: date-fns 4.1
- **Port**: 5173 (default)

### Database Features
- **Advanced SQL**: Recursive CTEs, window functions, materialized views
- **Constraints**: Composite unique constraints, check constraints
- **Foreign Keys**: Cascading delete rules
- **Indexes**: Performance-optimized indexes
- **Transactions**: ACID-compliant transaction management

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**
- **Git**

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd event_booking_system
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb event_booking
```

Or using psql:

```sql
CREATE DATABASE event_booking;
```

### 3. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=event_booking

# Server Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=24h

# Email Configuration (Optional - for invite notifications)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@eventbooking.com
```

Run database migrations:

```bash
npm run migration:run
```

Seed the database (optional):

```bash
npm run seed
```

Start the backend server:

```bash
npm run start:dev
```

The backend API will be available at `http://localhost:3000`

### 4. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory (if needed):

```env
VITE_API_URL=http://localhost:3000
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## ⚙️ Configuration

### Environment Variables

#### Backend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_DATABASE` | Database name | `event_booking` |
| `PORT` | Backend server port | `3000` |
| `JWT_SECRET` | JWT secret key | **Required** |
| `JWT_EXPIRATION` | JWT token expiration | `24h` |
| `MAIL_HOST` | SMTP server host | - |
| `MAIL_PORT` | SMTP server port | `587` |
| `MAIL_USER` | SMTP username | - |
| `MAIL_PASSWORD` | SMTP password | - |
| `MAIL_FROM` | Sender email address | - |

### Database Migrations

Generate a new migration:

```bash
cd backend
npm run migration:generate -- -n MigrationName
```

Run migrations:

```bash
npm run migration:run
```

Revert last migration:

```bash
npm run migration:revert
```

## 💻 Usage

### Creating an Admin User

```bash
cd backend
npm run add-admin
```

Follow the prompts to create a super admin user.

### Seeding Test Data

```bash
cd backend
npm run seed
```

This will create:
- Organizations with domain-based email templates
- Organization admins and regular users
- Events (past, current, and upcoming)
- Resources (exclusive, shareable, consumable)
- Resource allocations
- Inventory transactions
- Attendances and check-ins
- Invitations

### Development Scripts

#### Backend

```bash
npm run start:dev      # Start development server with hot reload
npm run start:prod     # Start production server
npm run build          # Build for production
npm run test           # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:cov       # Run tests with coverage
npm run lint           # Lint code
npm run format         # Format code with Prettier
```

#### Frontend

```bash
npm run dev            # Start development server
npm run build          # Build for production
npm run preview        # Preview production build
npm run lint           # Lint code
```

## 📚 API Documentation

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Endpoints

#### Organizations

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/organizations` | List all organizations | Admin |
| `POST` | `/organizations` | Create organization | Admin |
| `GET` | `/organizations/:id` | Get organization | Admin |
| `PATCH` | `/organizations/:id` | Update organization | Admin |
| `DELETE` | `/organizations/:id` | Delete organization | Admin |

#### Users

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/users?organizationId=:id` | List users | Admin, Org Admin |
| `POST` | `/users` | Create user | Admin, Org Admin |
| `GET` | `/users/:id` | Get user | Admin, Org Admin |
| `PATCH` | `/users/:id` | Update user | Admin, Org Admin |
| `DELETE` | `/users/:id` | Delete user | Admin, Org Admin |

#### Events

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/events?organizationId=:id` | List events | All |
| `POST` | `/events` | Create event | Admin, Org Admin |
| `GET` | `/events/:id` | Get event | All |
| `PATCH` | `/events/:id` | Update event | Admin, Org Admin* |
| `DELETE` | `/events/:id` | Delete event | Admin, Org Admin* |

*Org Admins cannot edit/delete past events

#### Resources

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/resources?organizationId=:id&isGlobal=true` | List resources | All |
| `POST` | `/resources` | Create resource | Admin, Org Admin |
| `GET` | `/resources/:id` | Get resource | All |
| `GET` | `/resources/:id/availability` | Check availability | All |
| `PATCH` | `/resources/:id` | Update resource | Admin, Org Admin |
| `DELETE` | `/resources/:id` | Delete resource | Admin, Org Admin |

#### Resource Allocations

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/allocations?eventId=:id&resourceId=:id` | List allocations | Admin, Org Admin |
| `POST` | `/allocations` | Create allocation | Admin, Org Admin |
| `PATCH` | `/allocations/:id` | Update allocation | Admin, Org Admin* |
| `DELETE` | `/allocations/:id` | Delete allocation | Admin, Org Admin* |

*Org Admins cannot edit/delete allocations for past events

#### Attendances

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/attendances?eventId=:id` | List attendances | All |
| `POST` | `/attendances` | Register attendee | All |
| `POST` | `/attendances/:id/checkin` | Check in attendee | All |
| `DELETE` | `/attendances/:id` | Remove attendance | All |

#### Invitations

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/invites` | List invites | All* |
| `GET` | `/invites/my-invites` | Get my invites | All |
| `POST` | `/invites` | Create invite | Admin, Org Admin |
| `PATCH` | `/invites/:id` | Update invite | Admin, Org Admin |
| `DELETE` | `/invites/:id` | Delete invite | Admin, Org Admin |
| `POST` | `/invites/:id/accept` | Accept invite | All |
| `POST` | `/invites/:id/decline` | Decline invite | All |

#### Public Invitations

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/public/invites/:token` | Get invite by token | Public |
| `POST` | `/public/invites/:token/accept` | Accept public invite | Public |
| `POST` | `/public/invites/:token/decline` | Decline public invite | Public |

#### Inventory

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/inventory/restock` | Restock consumable resource | Admin, Org Admin |
| `POST` | `/inventory/adjust` | Adjust inventory | Admin, Org Admin |
| `GET` | `/inventory/transactions?resourceId=:id` | Get transactions | Admin, Org Admin |
| `GET` | `/inventory/balance/:resourceId` | Get current balance | All |
| `GET` | `/inventory/projected-balance/:resourceId` | Get projected balance | All |

#### Reports

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/reports/double-booked-users` | Double-booked users | Admin, Org Admin |
| `GET` | `/reports/violated-constraints` | Violated constraints | Admin, Org Admin |
| `GET` | `/reports/resource-utilization?organizationId=:id` | Resource utilization | Admin, Org Admin |
| `GET` | `/reports/parent-child-violations` | Parent-child violations | Admin, Org Admin |
| `GET` | `/reports/external-attendees?threshold=10` | External attendees | Admin, Org Admin |
| `GET` | `/reports/show-up-rate` | Show-up rate analytics | Admin, Org Admin |
| `GET` | `/reports/capacity-utilization` | Capacity utilization | Admin, Org Admin |
| `POST` | `/reports/refresh-utilization-view` | Refresh materialized view | Admin |

## 📁 Project Structure

```
event_booking_system/
├── backend/
│   ├── src/
│   │   ├── entities/              # TypeORM entities
│   │   │   ├── user.entity.ts
│   │   │   ├── organization.entity.ts
│   │   │   ├── event.entity.ts
│   │   │   ├── resource.entity.ts
│   │   │   ├── resource-allocation.entity.ts
│   │   │   ├── attendance.entity.ts
│   │   │   ├── invite.entity.ts
│   │   │   └── inventory-transaction.entity.ts
│   │   ├── migrations/             # Database migrations
│   │   ├── organizations/          # Organizations module
│   │   ├── users/                  # Users module
│   │   ├── events/                 # Events module
│   │   ├── resources/              # Resources module
│   │   ├── allocations/            # Resource allocations module
│   │   ├── attendances/            # Attendances module
│   │   ├── invites/                # Invitations module
│   │   ├── inventory/              # Inventory management module
│   │   ├── reports/                # Reporting module
│   │   ├── auth/                   # Authentication module
│   │   ├── services/               # Shared services
│   │   │   └── inventory.service.ts
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── seed.ts                 # Database seeding
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── EventsList.tsx
│   │   │   ├── EventForm.tsx
│   │   │   ├── ResourcesList.tsx
│   │   │   ├── ResourceAllocation.tsx
│   │   │   ├── AttendeesList.tsx
│   │   │   ├── AttendeeRegistration.tsx
│   │   │   ├── InvitesManagement.tsx
│   │   │   ├── MyInvites.tsx
│   │   │   ├── ReportsDashboard.tsx
│   │   │   └── ...
│   │   ├── contexts/               # React contexts
│   │   │   └── AuthContext.tsx
│   │   ├── services/               # API services
│   │   │   └── api.ts
│   │   ├── utils/                  # Utility functions
│   │   │   ├── eventUtils.ts
│   │   │   ├── dateFormatter.ts
│   │   │   └── timeUtils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 🗄️ Database Schema

### Core Tables

- **`organizations`**: Organization entities with domain-based email templates
- **`users`**: User accounts with role-based access (Admin, Org Admin, User)
- **`events`**: Event entities with parent-child relationships
- **`resources`**: Resource entities (Exclusive, Shareable, Consumable)
- **`resource_allocations`**: Resource-to-event allocations
- **`attendances`**: Attendance records (user or external)
- **`invites`**: Event invitations
- **`inventory_transactions`**: Inventory ledger transactions

### Materialized Views

- **`resource_utilization_summary`**: Pre-computed resource utilization data

### Key Relationships

- Users belong to one organization
- Events belong to one organization (optional parent event)
- Resources belong to one organization (or global)
- Allocations link resources to events
- Attendances link users/external emails to events
- Invites link users/external emails to events

## 📐 Business Rules

### Event Constraints

1. **Time Validation**: End time must be after start time
2. **Double-Booking Prevention**: Users cannot be registered for overlapping events
3. **Parent-Child Validation**: 
   - Parent events must fully contain all child sessions
   - Child sessions must be within parent event time boundaries
4. **Past Event Protection**: Organization admins cannot edit/delete past events
5. **Capacity Limits**: Event capacity cannot be exceeded

### Resource Constraints

1. **Exclusive Resources**: Cannot overlap in time
2. **Shareable Resources**: Must respect max concurrent usage limits
3. **Consumable Resources**: 
   - Must not exceed available quantity
   - Use inventory ledger for tracking
   - Stock calculated from transactions (RESTOCK, ALLOCATION, RETURN, ADJUSTMENT)
4. **Past Allocation Protection**: Organization admins cannot edit/delete allocations for past events

### Attendance Constraints

1. **Registration Requirements**: Either `userId` OR `userEmail` (not both)
2. **External Attendees**: Only allowed if `event.allowExternalAttendees` is true
3. **Capacity Validation**: Event capacity cannot be exceeded
4. **Unique Constraints**: 
   - `(eventId, userId)` for user attendances
   - `(eventId, userEmail)` for external attendances
5. **Deregistration Window**: 15-minute window after event start

### Invitation Constraints

1. **Event Status**: Cannot invite to draft or cancelled events
2. **Past Events**: Cannot invite to past events
3. **External Attendees**: Cannot send external invites if `event.allowExternalAttendees` is false
4. **Status Tracking**: Pending, Accepted, Declined, Cancelled states

### Inventory Constraints

1. **Transaction Types**: RESTOCK, ALLOCATION, RETURN, ADJUSTMENT
2. **Balance Calculation**: Sum of all transactions for consumable resources
3. **Projected Balance**: Balance at a specific point in time
4. **Negative Stock Prevention**: Validation prevents negative stock

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Run tests with coverage
npm run test:e2e         # Run end-to-end tests
```

### Frontend Linting

```bash
cd frontend
npm run lint             # Lint code
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features

## 📄 License

This project is **UNLICENSED** and is a prototype for demonstration purposes.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Frontend powered by [React](https://reactjs.org/)
- Database: [PostgreSQL](https://www.postgresql.org/)
- UI components styled with modern CSS

## 📞 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Note**: This is a prototype system. For production use, ensure proper security hardening, error handling, and performance optimization.
