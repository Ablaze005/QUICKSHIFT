# QuickShift (MVP)

Dead-simple app for employees to request shift coverage and notify coworkers via SMS (Twilio) and web push (Firebase Cloud Messaging).

This scaffold contains:
- client/ — React (Vite) frontend
- functions/ — Firebase Cloud Functions (Realtime Database triggers + Twilio + FCM)

High-level flow:
1. Employee creates a request in Realtime Database (/requests)
2. Cloud Function onCreate sends FCM and SMS notifications to users
3. Another employee clicks Accept — frontend sets acceptedBy and status "pendingApproval"
4. Cloud Function notifies manager(s)
5. Manager approves via app which calls approve HTTPS function; function finalizes and notifies requester and accepter

Defaults in this scaffold:
- Vite + React (JavaScript)
- Firebase Realtime Database
- Firebase Authentication (email/password)

Setup (local & deploy)

1. Install Firebase CLI and Node.js
   - npm install -g firebase-tools

2. Create Firebase project in console (enable Authentication and Realtime Database)

3. Configure local project
   - From project root:
     cd client && npm install
     cd ../functions && npm install

4. Set Firebase Functions environment variables for Twilio
   - firebase functions:config:set twilio.sid="YOUR_TWILIO_SID" twilio.token="YOUR_TWILIO_AUTH_TOKEN" twilio.from="+1234567890"
   - Replace with your Twilio test or live credentials.

5. Initialize Firebase in client
   - Create a web app in Firebase console and copy config values.
   - Create a .env.local file in client/ with variables (see client/.env.example)

6. Emulators (recommended for testing)
   - firebase emulators:start --only auth,database,functions

7. Deploy
   - firebase deploy --only functions,hosting

Security notes
- Manager approval requires a signed-in manager. SMS approval links open the app; approval must happen when the manager is authenticated.
- Do not expose Twilio credentials in client code. Use functions.config for Twilio creds.

This scaffold is intentionally minimal. See client/ and functions/ for code and comments.
