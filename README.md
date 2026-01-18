# StakShops Backend API Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Features](#features)
- [Environment Variables](#environment-variables)
- [Installation & Setup](#installation--setup)

---

## 🚀 Overview

StakShops Backend is a Node.js/Express REST API with the following features:
- User authentication (Signup/Login)
- OTP verification system
- Redis caching for improved performance
- BullMQ queue system for background job processing
- Email notifications via Nodemailer
- JWT-based authentication

---

## 🌐 Base URL

```
http://localhost:3000
```

All API endpoints are prefixed with `/api/user`

---

## 🔐 Authentication

Most endpoints require JWT authentication via Bearer token in the Authorization header.

**Format:**
```
Authorization: Bearer <your_jwt_token>
```

**How to get token:**
- Sign up: Token is returned in the response
- Login: Token is returned in the response

**Token Validity:** 7 days

---

## 📡 API Endpoints

### 1. Health Check

**Endpoint:** `GET /`

**Description:** Check if the server is running

**Authentication:** Not required

**Request:**
```bash
GET http://localhost:3000/
```

**Response:**
```
200 OK
Health Ok!
```

---

### 2. User Signup

**Endpoint:** `POST /api/user/signup`

**Description:** Create a new user account

**Authentication:** Not required

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Success Response (201 Created):**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
  ```json
  {
    "error": "All values must be filled."
  }
  ```

- `409 Conflict`: User already exists
  ```json
  {
    "error": "User already exits with this email."
  }
  ```

- `500 Internal Server Error`: Signup failed
  ```json
  {
    "error": "Signup Failed.",
    "details": "error message"
  }
  ```

**Notes:**
- Password is automatically hashed using bcrypt
- Welcome email is sent via queue system
- Token is valid for 7 days

---

### 3. User Login

**Endpoint:** `POST /api/user/login`

**Description:** Authenticate user and get JWT token

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Success Response (200 OK):**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing fields or invalid credentials
  ```json
  {
    "error": "All fields must be filled."
  }
  ```
  ```json
  {
    "error": "No user is associated with this email."
  }
  ```
  ```json
  {
    "error": "Maybe your Email or password is wrong"
  }
  ```

- `500 Internal Server Error`: Login failed
  ```json
  {
    "error": "Login failed",
    "details": "error message"
  }
  ```

---

### 4. Send OTP

**Endpoint:** `POST /api/user/sendOtp`

**Description:** Generate and send OTP to user's email

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/user/sendOtp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

**Success Response (201 Created):**
```json
{
  "message": "OTP sent successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Missing email
  ```json
  {
    "error": "Please fill all the details first."
  }
  ```

- `500 Internal Server Error`: Failed to send OTP
  ```json
  {
    "error": "Something went wrong.",
    "details": "error message"
  }
  ```

**Notes:**
- OTP is a 6-digit number
- OTP is stored in Redis with 10 minutes expiration
- OTP is sent via email using queue system

---

### 5. Verify OTP

**Endpoint:** `POST /api/user/verifyOtp`

**Description:** Verify the OTP sent to user's email

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/user/verifyOtp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456"
  }'
```

**Success Response (200 OK):**
```json
{
  "message": "OTP verified successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Missing fields or invalid OTP
  ```json
  {
    "error": "Please fill alll the details."
  }
  ```
  ```json
  {
    "error": "OTP expired or not found. Please request a new OTP."
  }
  ```
  ```json
  {
    "error": "Your entered otp is wrong."
  }
  ```

- `500 Internal Server Error`: Verification failed
  ```json
  {
    "error": "Something went wrong.",
    "details": "error message"
  }
  ```

**Notes:**
- OTP is automatically deleted from Redis after successful verification
- OTP expires after 10 minutes

---

### 6. Get User Details

**Endpoint:** `GET /api/user/`

**Description:** Get user profile details (with Redis caching)

**Authentication:** Required (Bearer token)

**Request Headers:**
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Request Example:**
```bash
curl -X GET http://localhost:3000/api/user/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

**Success Response (200 OK):**

*From Cache:*
```json
{
  "userFound": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "fromCache": true
}
```

*From Database:*
```json
{
  "userFound": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "fromCache": false
}
```

**Error Responses:**
- `400 Bad Request`: Missing email or user not found
  ```json
  {
    "error": "Please Enter all fields."
  }
  ```
  ```json
  {
    "error": "No user found with this email."
  }
  ```

- `401 Unauthorized`: Missing or invalid token
  ```json
  {
    "error": "Access Denied. No Authorization header provided"
  }
  ```

- `500 Internal Server Error`: Failed to fetch user
  ```json
  {
    "error": "User fetching failed.",
    "details": "error message"
  }
  ```

**Notes:**
- Uses Redis cache with 1 hour TTL
- First request fetches from database and caches it
- Subsequent requests use cached data for faster response

---

### 7. Update User

**Endpoint:** `POST /api/user/updateUser`

**Description:** Update user profile information

**Authentication:** Required (Bearer token)

**Request Headers:**
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userData": {
    "email": "john@example.com"
  },
  "name": "John Updated",
  "otherField": "value"
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/user/updateUser \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "email": "john@example.com"
    },
    "name": "John Updated"
  }'
```

**Success Response (201 Created):**
```json
{
  "updatedUser": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Updated",
    "email": "john@example.com"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing fields or user not found
  ```json
  {
    "error": "Please all the fields"
  }
  ```
  ```json
  {
    "error": "No user is asssociated with this email."
  }
  ```

- `401 Unauthorized**: Missing or invalid token
  ```json
  {
    "error": "Access Denied. No Authorization header provided"
  }
  ```

- `500 Internal Server Error`: Update failed
  ```json
  {
    "error": "Update Failed.",
    "details": "error message"
  }
  ```

**Notes:**
- Cache is automatically invalidated and updated after successful update
- All fields in `req.body` (except userData) are updated

---

## ✨ Features

### 1. Redis Caching
- **User Profile Caching:** 1 hour TTL
- **OTP Storage:** 10 minutes TTL
- Automatic cache invalidation on updates

### 2. Queue System (BullMQ)
- **Signup Email Queue:** Sends welcome emails
- **OTP Email Queue:** Sends OTP emails
- Background job processing for better performance

### 3. Email Notifications
- Welcome emails on signup
- OTP emails for verification
- Processed asynchronously via queues

### 4. Security Features
- Password hashing using bcrypt
- JWT token-based authentication
- Secure token validation middleware

---

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# Database
MONGODB_URI=your_mongodb_connection_string

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Redis Configuration
REDIS_URL=your_redis_connection_url

# Email Configuration (Gmail)
GOOGLE_GMAIL=your_email@gmail.com
GOOGLE_PASS=your_app_password
```

**Important:**
- Never commit `.env` file to version control
- Use strong, random values for `JWT_SECRET`
- For Gmail, use App Password (not regular password)

---

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB database
- Redis instance (Upstash or local)

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd StakShops-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Create .env file and add all required variables
   cp .env.example .env  # if .env.example exists
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

5. **Verify server is running**
   ```bash
   curl http://localhost:3000/
   # Should return: Health Ok!
   ```

---

## 📚 Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **ioredis** - Redis client
- **bullmq** - Queue management
- **nodemailer** - Email sending
- **dotenv** - Environment variables
- **morgan** - HTTP request logger

---

## 🔍 Response Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required/failed
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

---

## 📝 Notes

- All timestamps are in UTC
- Password field is never returned in responses
- OTPs expire after 10 minutes
- JWT tokens expire after 7 days
- Redis cache for user data expires after 1 hour

---

## 🐛 Error Handling

All errors follow a consistent format:
```json
{
  "error": "Human-readable error message",
  "details": "Technical error details (in development)"
}
```

---

## 📞 Support

For issues or questions, please contact the development team.

---

**Last Updated:** 2024