# replit.md

## Overview

CashBook Pro is a simplified money changer management system built with vanilla JavaScript frontend and Node.js/Express backend. The application is now structured as a 4-file system: index.html, style.css, app.js (frontend), and server.js (backend). It provides user authentication, transaction management, and financial tracking capabilities for money changing businesses using in-memory storage that simulates MongoDB functionality.

## User Preferences

Preferred communication style: Simple, everyday language.
No TypeScript or additional frameworks - pure vanilla JavaScript only.

## System Architecture

### Simplified File Structure
- **index.html**: Single HTML file containing all pages and components
- **style.css**: Single CSS file with all styling and responsive design
- **app.js**: Single JavaScript file with complete frontend application logic
- **server.js**: Single Node.js file with complete backend API and database simulation

### Frontend Architecture
- **Framework**: Pure vanilla JavaScript with class-based architecture (CashBookApp class)
- **Design Pattern**: Single-page application (SPA) with modal-based interactions
- **State Management**: Local state management within the main CashBookApp class
- **Authentication**: JWT token-based authentication stored in localStorage
- **API Communication**: Fetch API with centralized error handling and loading states
- **UI Framework**: Custom CSS with utility classes, responsive design using flexbox/grid

### Backend Architecture
- **Framework**: Express.js with CommonJS modules
- **Architecture Pattern**: RESTful API design
- **Data Storage**: In-memory storage using JavaScript arrays (simulates MongoDB functionality)
- **Authentication**: JWT (JSON Web Tokens) for stateless authentication
- **Middleware**: CORS enabled, JSON body parsing, static file serving
- **Security**: bcryptjs for password hashing, token-based authorization middleware

### Authentication System
- **Method**: JWT-based authentication with Bearer token authorization
- **Storage**: Client-side localStorage for token persistence
- **Security**: Password hashing with bcryptjs, role-based access control
- **Session Management**: 7-day token expiration with automatic refresh capability

### API Design
- **Base URL**: http://localhost:8000
- **Authentication**: Bearer token in Authorization header
- **Error Handling**: Centralized error responses with consistent JSON structure
- **Loading States**: Built-in loading indicators for all API calls

## External Dependencies

### Frontend Dependencies
- **CSS Framework**: Custom CSS with Inter font family fallback
- **No external JavaScript libraries**: Pure vanilla JavaScript implementation

### Backend Dependencies
- **express**: Web application framework for Node.js
- **cors**: Cross-Origin Resource Sharing middleware
- **bcryptjs**: Password hashing library
- **jsonwebtoken**: JWT implementation for Node.js
- **path**: Node.js built-in module for file path utilities

### Development Environment
- **Server Port**: 5000 (serves both backend API and frontend static files)
- **CORS Configuration**: Configured for localhost development
- **Static Assets**: Served from root directory
- **Demo Data**: Pre-loaded with admin and client accounts for testing

### Demo Accounts
- **Owner Account**: username=admin, password=admin123
- **Client Account**: username=democlient, password=client123

### Key Features
- User registration with payment workflow
- Owner dashboard with client management
- Client dashboard with transaction tracking
- JWT authentication system
- In-memory data storage (simulates MongoDB)
- Responsive design for all screen sizes