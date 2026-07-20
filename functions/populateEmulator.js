// Script to populate Firebase emulators with sample users and data
// Usage (PowerShell):
// $env:FIREBASE_AUTH_EMULATOR_HOST='localhost:9099'; $env:FIREBASE_DATABASE_EMULATOR_HOST='localhost:9000'; node populateEmulator.js

const admin = require('firebase-admin')

// Initialize admin app for emulator
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project'
const databaseHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST || ''
const databaseURL = databaseHost ? `http://${databaseHost}?ns=${projectId}` : undefined
admin.initializeApp({ projectId, databaseURL })
const db = admin.database()

async function main(){
  console.log('Populating emulator...')
  // Create users
  const users = [
    { uid: 'alice', email: 'alice@example.com', password: 'password', name: 'Alice', phone: '+15550001', role: 'employee' },
    { uid: 'bob', email: 'bob@example.com', password: 'password', name: 'Bob', phone: '+15550002', role: 'employee' },
    { uid: 'manager', email: 'manager@example.com', password: 'password', name: 'Manager', phone: '+15550003', role: 'manager' }
  ]

  for(const u of users){
    try{
      await admin.auth().getUser(u.uid)
      console.log('User exists', u.uid)
    }catch(e){
      await admin.auth().createUser({ uid: u.uid, email: u.email, password: u.password })
      console.log('Created user', u.uid)
    }
    await db.ref(`users/${u.uid}`).set({ name: u.name, phone: u.phone, role: u.role, notifySms: true, notifyPush: false })
  }

  // Create a sample request by Alice
  const reqRef = db.ref('requests').push()
  const request = {
    requesterId: 'alice',
    requesterName: 'alice@example.com',
    shiftStart: '2026-07-20 09:00',
    shiftEnd: '2026-07-20 17:00',
    location: 'Main Office',
    notes: 'Need coverage',
    status: 'open',
    acceptedBy: null,
    createdAt: Date.now()
  }
  await reqRef.set(request)
  console.log('Created request', reqRef.key)

  console.log('Done. Emulator populated.')
}

main().catch(e=>{ console.error(e); process.exit(1) })
