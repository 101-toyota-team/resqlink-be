# ResQLink Backend

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Database](#database)
- [Development Guidelines](#development-guidelines)

## Features

- **Multi-Role Authentication**: Support for Customer, Provider Admin, and Driver roles
- **JWT Token-Based Security**: Secure API endpoints with djangorestframework-simplejwt
- **Role-Based Access Control (RBAC)**: Different permissions for different user roles
- **User Management**: Registration, authentication, and user profile endpoints
- **RESTful API**: Clean and intuitive REST API design
- **Static File Serving**: WhiteNoise for efficient static file management
- **Database Support**: PostgreSQL for scalable data management

## Tech Stack

- **Framework**: Django 4.2.29
- **REST Framework**: Django REST Framework 3.16.1
- **Authentication**: djangorestframework-simplejwt 5.5.1
- **Database**: PostgreSQL (via psycopg2-binary 2.9.11)
- **Web Server**: Gunicorn 23.0.0
- **Static Files**: WhiteNoise 6.11.0
- **Environment**: Python 3.9+

## Prerequisites

Before you begin, ensure you have the following installed:

- Python 3.9 or higher
- pip (Python package manager)
- PostgreSQL 12+ (for production; SQLite for development)
- git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/resqlink-be.git
cd resqlink-be
```

### 2. Create Virtual Environment

```bash
# Create virtual environment
python3.9 -m venv env

# Activate virtual environment
# On macOS/Linux:
source env/bin/activate

# On Windows:
env\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### 5. Database Setup

```bash
# Run migrations
python manage.py migrate

# Create superuser (for admin access)
python manage.py createsuperuser
```

### 6. Create Static Files (Production)

```bash
python manage.py collectstatic --noinput
```

### Important Notes:
- **DEBUG**: Always set to `False` in production  
- **Database**: Production database (PostgreSQL) will be managed and configured via Railway  
- **ALLOWED_HOSTS**: Will be set according to the Railway deployment domain  

## Running the Project

### Development Server

```bash
# Activate virtual environment
source env/bin/activate

# Run development server
python manage.py runserver

# Server runs at http://localhost:8000
```

## Project Structure

```
resqlink-be/
├── account/                    # User authentication and management
│   ├── migrations/            # Database migrations
│   ├── models.py              # User model with role-based access
│   ├── views.py               # API views for authentication
│   ├── serializers.py         # DRF serializers
│   ├── urls.py                # App URL routing
│   ├── admin.py               # Django admin configuration
│   └── tests.py               # Unit tests
├── resqlink/                  # Main project configuration
│   ├── settings.py            # Django settings
│   ├── urls.py                # Main URL routing
│   ├── wsgi.py                # WSGI configuration
│   ├── asgi.py                # ASGI configuration
│   └── __init__.py
├── manage.py                  # Django management script
├── requirements.txt           # Python dependencies
├── db.sqlite3                 # SQLite database (development only)
├── .env                       # Environment variables (not in git)
└── README.md                  # This file
```

## API Endpoints

### Authentication & User Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| POST | `/account/register/customer/` | Register as a customer | ❌ |
| POST | `/account/register/provider-admin/` | Register as a provider admin | ❌ |
| GET | `/account/me/` | Get current user profile | ✅ |
| POST | `/api/token/` | Obtain JWT tokens | ❌ |
| POST | `/api/token/refresh/` | Refresh access token | ❌ |

### Admin Panel

| Endpoint | Description |
|----------|-------------|
| `/admin/` | Django admin panel (superuser only) |

## Authentication

### JWT Token Flow

1. **User Registration**: Customer or Provider registers at `/account/register/{role}/`
2. **Token Acquisition**: User logs in at `/api/token/` to receive access and refresh tokens
3. **API Access**: Include token in request header: `Authorization: Bearer <access_token>`
4. **Token Refresh**: Use refresh token to get new access token when expired

### Example Request

```bash
# Get token
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "password123"}'

# Use token to access protected endpoint
curl -X GET http://localhost:8000/account/me/ \
  -H "Authorization: Bearer <your_access_token>"
```

## Database

### Database Models

**User Model** (`account/models.py`):
- Extends Django's AbstractUser
- Includes role field with choices: CUSTOMER, PROVIDER_ADMIN, DRIVER
- Customizable through inheritance

### Running Migrations

```bash
# Create new migration
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Check migration status
python manage.py showmigrations

# Revert to previous migration
python manage.py migrate account 0001
```

### Database Backup

```bash
# PostgreSQL dump
pg_dump -U postgres resqlink_db > backup.sql

# Restore from backup
psql -U postgres resqlink_db < backup.sql
```

## Development Guidelines

### Code Style

- Follow PEP 8 guidelines
- Use meaningful variable and function names
- Add docstrings to functions and classes

### Creating New Apps

```bash
python manage.py startapp appname
```

Then add `appname` to `INSTALLED_APPS` in `resqlink/settings.py`.

### Running Tests

```bash
# Run all tests
python manage.py test

# Run specific test
python manage.py test account.tests

# Run with verbose output
python manage.py test --verbosity=2
```


### Common Management Commands

```bash
# Shell access to database
python manage.py shell

# Check for potential issues
python manage.py check

# Create migration files
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Collect static files (production)
python manage.py collectstatic
```



## 📄 License

This project is licensed under the [MIT License](LICENSE).
