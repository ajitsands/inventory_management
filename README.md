# Multi-Tier Organization Inventory System

An enterprise-grade, high-performance Inventory Management System for multi-branch organizations with clinic outlets. Built with **Pure PHP MVC Architecture**, **MySQL**, **AES-256 URL Payload Encryption**, and a modern **React JS SPA** frontend styled around the organization's brand identity (`#1C8DCD` Primary Ocean Blue, `#F68D20` Accent Amber, and `logo/logo.png`).

---

## 🌟 Key Features

1. **4-Tier Item Movement & Inventory Lifecycle:**
   - **Vendor $\rightarrow$ Main Branch:** Enter PO Number, PO Date, Vendor Invoice Number, Vendor Invoice Date, Purchase Price, Selling Price, Expiry Date, and Batch Code creation.
   - **Main Branch $\rightarrow$ Sub Branch:** Invoiced stock transfers with internal billing.
   - **Sub Branch $\rightarrow$ Clinic Outlet:** Pure Stock Transfers (No Invoicing).
   - **Clinic Outlet $\rightarrow$ Customer / Patient:** OPD dispensing invoice with automated **FIFO (First-In, First-Out)** batch allocation.

2. **Automated FIFO Allocation Engine:**
   - Automatic batch selection based on earliest expiry date & purchase date.
   - Guarantees older non-expired batches are dispensed first.

3. **Security & URL Payload Encryption:**
   - Pure PHP MVC backend with AES-256-GCM parameter encryption (`UrlSecurity.php`).
   - Ensures no open/raw database IDs are exposed in URLs ("No Open URL").
   - Pure PDO prepared statements (Zero SQL Injection risk).
   - JWT Bearer Authentication & Role-Based Access Control (RBAC).

4. **Immutable System Audit Trail:**
   - Logs every system transaction, login, purchase, transfer, sale, and user creation into `system_audit_trail`.
   - Payload inspection showing JSON snapshots of actions.

5. **Role-Based Access Control (RBAC):**
   - **Admin:** Full access across all modules, location setups, and audit trails.
   - **Store Manager:** Stock operations (Vendor purchase bills, branch transfers, clinic transfers).
   - **OPD / Clinic User:** Consumption entry & customer dispensing at clinic level.
   - **Auditor:** Read-only access to movement ledgers, valuation reports, and audit logs.

---

## 🚀 Quick Setup Instructions

### 1. Database Setup (MySQL Localhost)
- Database: `inventory_system_db`
- Username: `root`
- Password: `S@nds1@b`

Run the database setup script:
```bash
php backend/database/seed_db.php
```

### 2. Backend API Setup (PHP Pure MVC)
Run built-in server or deploy on Apache (`mod_rewrite` enabled):
```bash
php -S localhost:8000 -t backend/public
```

### 3. Frontend Setup (React JS + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open browser at `http://localhost:3000`.

---

## 🔐 Default Demo Credentials

- **Admin:** `admin` / `password123`
- **Store Manager:** `store_mgr` / `password123`
- **OPD / Clinic User:** `clinic_user1` / `password123`
- **Auditor:** `auditor` / `password123`

---

## 📁 Git Repository
- Repository URL: `https://github.com/ajitsands/inventory_management.git`
