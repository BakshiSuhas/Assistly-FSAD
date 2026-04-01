Assistly - Role-Based Community Service Platform (Updated Stack)
Assistly is a Spring Boot + React + MySQL platform where users can switch between Resident and Volunteer modes, while Admin users manage users, requests, and communities.
________________________________________
Core Features
 Authentication & Authorization
•	Spring Security + JWT Authentication 
•	Signup / Login / Logout 
•	Role-based access: 
o	ADMIN → Admin Dashboard 
o	USER → User Dashboard 
________________________________________
Role & Mode System
•	Users can toggle between: 
o	Resident Mode 
o	Volunteer Mode 
•	Managed via backend (Spring Boot service layer) 
________________________________________
Location Features
•	React + Leaflet.js integration 
o	Click to select location 
o	Detect current location (Geolocation API) 
•	Coordinates stored in MySQL database 
________________________________________
 Resident Requests System
•	Create / View / Update / Delete requests 
•	Status tracking: 
o	Open 
o	In Progress 
o	Completed 
________________________________________
 Volunteer Workflow
•	View all requests except own 
•	Accept request 
•	Mark request as completed 
•	Backend validation prevents self-accept 
________________________________________
 Communities Module
•	List & search communities 
•	Join community 
•	Admin: 
o	Create community 
o	Delete community 
________________________________________
 Admin Dashboard
•	Manage users 
•	Manage requests 
•	Manage communities 
•	Analytics charts (React charts) 
________________________________________
 Bonus Features
•	Modal-based request creation 
•	Real-time notifications (polling / WebSocket optional) 
________________________________________
 Tech Stack (Updated)
 Development & Tools
•	Version Control: Git, GitHub 
•	IDEs: Eclipse / Spring Tool Suite (STS), VS Code 
•	Runtime: Java (JDK), Node.js 
•	Build Tool: Maven 
•	API Testing: Postman 
________________________________________
 Backend
•	Language: Java 
•	Framework: Spring Framework 
•	Backend Framework: Spring Boot 
•	Architecture: MVC (Controller → Service → Repository) 
•	ORM: Hibernate / JPA 
________________________________________
 Database
•	MySQL 
________________________________________
 API Layer
•	REST APIs (Spring MVC) 
•	Data Format: JSON 
•	HTTP Methods: 
o	GET 
o	POST 
o	PUT 
o	DELETE 
________________________________________
 Frontend
•	Library: React.js 
Core Concepts:
•	Components, JSX 
•	Props, State, Hooks 
•	Routing (React Router) 
Styling:
•	Bootstrap 5 / CSS 
________________________________________
 State Management
•	Context API 
•	Redux 
________________________________________
 Client-Side Features
•	LocalStorage 
•	SessionStorage 
•	API calls using Fetch / Axios 
________________________________________
 Security
•	Spring Security 
•	JWT Authentication 
•	OAuth / SSO concepts 
________________________________________
 Additional Backend Features
•	File Upload APIs 
•	Email Services (Spring Mail) 
•	Logging: SLF4J + Logback 
•	API Documentation: Swagger / OpenAPI 
•	AOP (Aspect-Oriented Programming) 
________________________________________
 Architecture Concepts
•	SOA (Service-Oriented Architecture) 
•	Microservices Architecture 
•	API-driven architecture 
•	Cloud-native systems 
________________________________________
 Updated Project Structure
assistly/
  backend/
    src/main/java/com/assistly/
      controller/
      service/
      repository/
      model/
      security/
      config/
    src/main/resources/
      application.properties
    pom.xml

  frontend/
    src/
      components/
      pages/
      services/
      redux/
      App.js
    public/

  database/
    schema.sql

  docs/
    api-docs (Swagger)

  README.md
________________________________________
 Run Locally
Backend (Spring Boot)
cd backend
mvn clean install
mvn spring-boot:run
Frontend (React)
cd frontend
npm install
npm start
________________________________________
 Environment Variables
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/assistly_db
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=yourpassword

JWT_SECRET=your_secret_key
________________________________________
 Key API Endpoints
Auth
•	POST /api/auth/signup 
•	POST /api/auth/login 
Dashboard
•	GET /api/dashboard/user 
•	GET /api/dashboard/admin 
Requests
•	POST /api/requests 
•	PUT /api/requests/{id} 
•	DELETE /api/requests/{id} 
•	POST /api/requests/{id}/accept 
•	POST /api/requests/{id}/complete 
Communities
•	GET /api/communities 
•	POST /api/communities/{id}/join 
•	POST /api/communities (Admin) 
•	DELETE /api/communities/{id} (Admin) 
________________________________________
 Deployment (Render)
Backend
•	Spring Boot JAR deployment 
•	Embedded Tomcat 
Frontend
•	React build → Static Hosting 
Database
•	MySQL (cloud instance)