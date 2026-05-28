# Curd Application Guide

## 1. Application Overview
This project is a full-stack inventory management application with:
- ASP.NET Core Web API backend
- Angular frontend
- SQLite database
- JWT authentication (Register/Login)
- Product management with image upload

Project structure:
- `CurdApp.Api` -> backend API and SQLite database
- `curd-app-ui` -> Angular frontend app

---

## 2. Features

### Authentication & Security
- User Registration (`/api/auth/register`)
- User Login (`/api/auth/login`)
- JWT token-based authentication
- Protected product endpoints (only authenticated users can access)
- Password hashing + salt (PBKDF2)

### Inventory / Product Module
- Create, update, delete products
- Product image upload (JPG, JPEG, PNG, WEBP)
- Product fields:
  - Name
  - Description
  - SKU
  - Category
  - Price
  - Quantity
  - Active/Inactive status
- Toggle product active status
- Search, filter, sort, pagination
- Dashboard stats:
  - Total products
  - Active items
  - Low stock count
  - Total inventory value

### Storage
- SQLite DB file: `CurdApp.Api/curdapp.db`
- Uploaded images: `CurdApp.Api/wwwroot/uploads`

---

## 3. Run Locally

## Prerequisites
- .NET SDK 10
- Node.js + npm
- Angular CLI

## Backend (API)
1. Open terminal
2. Run:

```powershell
cd C:\CURD\CurdApp.Api
dotnet restore
dotnet build
dotnet run --urls http://localhost:5121
```

API base URL:
- `http://localhost:5121`

## Frontend (Angular)
1. Open a second terminal
2. Run:

```powershell
cd C:\CURD\curd-app-ui
npm install
npm start
```

Angular dev URL:
- Usually `http://localhost:4200`
- If 4200 is busy, Angular will pick a different port and show it in terminal.

## Local testing flow
1. Open frontend URL
2. Register a new user
3. Login
4. Add products and upload images

---

## 4. Important Configuration

## `CurdApp.Api/appsettings.json`
Key sections:
- `ConnectionStrings:DefaultConnection`
- `Jwt:Key`
- `Jwt:Issuer`
- `Jwt:Audience`
- `Jwt:ExpiryMinutes`

Current DB setup:
```json
"ConnectionStrings": {
  "DefaultConnection": "Data Source=curdapp.db"
}
```

---

## 5. Hosting Options

You can host this app in multiple ways.

## Option A: Windows Server (IIS) + Angular static files
- Publish backend API from `CurdApp.Api`
- Host API under IIS (Kestrel + ASP.NET Core Module)
- Build Angular and host static files in IIS site or CDN

### Backend publish command
```powershell
cd C:\CURD\CurdApp.Api
dotnet publish -c Release -o .\publish
```

### Frontend build command
```powershell
cd C:\CURD\curd-app-ui
npm run build
```
Deploy generated files from:
- `curd-app-ui/dist/curd-app-ui`

## Option B: Azure App Service (recommended)
- Deploy backend API to Azure App Service (Linux/Windows)
- Deploy frontend to Azure Static Web Apps or App Service
- Store JWT secret in Azure App Service Configuration (not in file)

## Option C: Linux VM / Container
- Run API with systemd + reverse proxy (Nginx)
- Host Angular build via Nginx

---

## 6. Changes Required Before Hosting

## Security changes (mandatory)
1. Replace JWT key with a strong secret (at least 32+ random characters).
2. Do NOT keep JWT key in source-controlled `appsettings.json` for production.
3. Use environment variables or secret manager.
4. Enable HTTPS-only traffic.

## CORS changes (mandatory)
Current CORS allows localhost for development. In production, restrict to your actual frontend domain.
Example:
- Allow only `https://yourdomain.com`

## Database changes (recommended)
SQLite is fine for small workloads. For multi-user production:
- Move to SQL Server / PostgreSQL / MySQL / Azure SQL
- Update EF Core provider and connection string

## File upload changes (recommended)
Current image storage is local filesystem. In production:
- Use cloud object storage (Azure Blob / S3)
- Save URL in DB

## Logging and monitoring
- Add centralized logging (Application Insights / Serilog)
- Add health checks endpoint

## API hardening
- Add request validation and rate limiting
- Add refresh token support if needed
- Add role-based authorization (Admin/User)

---

## 7. Environment Variables for Production (Example)

Use environment settings instead of committing secrets:

```text
ConnectionStrings__DefaultConnection=<prod_connection_string>
Jwt__Key=<strong_secret_key>
Jwt__Issuer=CurdApp.Api
Jwt__Audience=CurdApp.Client
Jwt__ExpiryMinutes=60
ASPNETCORE_ENVIRONMENT=Production
```

---

## 8. Suggested Next Enhancements
- Role-based access (Admin, Staff, Viewer)
- Password reset via email
- Audit logs (who changed what)
- Product import/export (CSV/Excel)
- Order and sales modules
- Reports and charts
- Docker + CI/CD pipeline

---

## 9. Troubleshooting
- 401 Unauthorized on products API:
  - Login again and ensure JWT token is sent in `Authorization: Bearer <token>`
- Images not loading:
  - Check `wwwroot/uploads` exists
  - Ensure static files are enabled and deployment includes upload path
- Angular cannot load products:
  - Verify backend is running
  - Verify CORS configuration matches frontend domain/port
