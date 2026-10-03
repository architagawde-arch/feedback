# College Feedback Management System (SPES GMFC)
## Run (XAMPP/phpMyAdmin)
1. Start MySQL in XAMPP. In phpMyAdmin create DB `cfms` (or import `database/schema.sql`).
2. `cd backend && cp .env.example .env && npm install && npm start`  (auto-creates tables + demo data)
3. `cd frontend && npm install && npm run dev`  -> open http://localhost:5173
Logins: admin@gmfc.edu/admin123 · naik@gmfc.edu/faculty123 · archita@gmfc.edu/student123
New students/faculty added by admin get a login (student123 / faculty123).
