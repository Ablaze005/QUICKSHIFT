const functions = require('firebase-functions')
const admin = require('firebase-admin')
const twilio = require('twilio')

admin.initializeApp()
const db = admin.database()

// Read Twilio config from functions config: firebase functions:config:set twilio.sid="..." twilio.token="..." twilio.from="+123"
const twilioConfig = functions.config().twilio || {}
let twilioClient = null
try {
  const sid = twilioConfig.sid
  const token = twilioConfig.token
  if(sid && token && sid !== 'REPLACE_ME' && token !== 'REPLACE_ME') {
    twilioClient = twilio(sid, token)
  } else {
    console.log('Twilio config missing or placeholder; SMS sending disabled')
  }
} catch(e) {
  console.warn('Twilio init failed, SMS disabled', e.message)
}

// Helper: send FCM to tokens
async function sendFcm(tokens, payload){
  if(!tokens || !tokens.length) return
  const message = {
    tokens,
    notification: {
      title: payload.title || 'QuickShift',
      body: payload.body || ''
    },
    data: payload.data || {}
  }
  try{
    const res = await admin.messaging().sendMulticast(message)
    console.log('FCM result', res.successCount, 'success out of', res.responses.length)
  }catch(e){
    console.error('FCM error', e)
  }
}

// Helper: send SMS via Twilio
async function sendSms(to, body){
  if(!twilioClient) { console.log('Twilio not configured'); return }
  try{
    const msg = await twilioClient.messages.create({
      body,
      from: twilioConfig.from,
      to
    })
    console.log('Sent SMS', msg.sid)
  }catch(e){
    console.error('Twilio error', e)
  }
}

// On new request, notify users
exports.onRequestCreate = functions.database.ref('/requests/{requestId}').onCreate(async (snapshot, context) => {
  const data = snapshot.val()
  const requestId = context.params.requestId
  console.log('New request', requestId, data)

  // Read all users to find tokens/phones
  const usersSnap = await db.ref('users').once('value')
  const users = usersSnap.val() || {}

  const fcmTokens = []
  const smsRecipients = []
  Object.entries(users).forEach(([uid,u])=>{
    if(uid === data.requesterId) return // don't notify requester
    if(u.notifyPush && u.fcmToken) fcmTokens.push(u.fcmToken)
    if(u.notifySms && u.phone) smsRecipients.push(u.phone)
  })

  const title = 'Shift needs coverage'
  const body = `${data.requesterName} needs ${data.shiftStart}–${data.shiftEnd} at ${data.location}`
  await sendFcm(fcmTokens, {title, body, data:{requestId}})

  for(const to of smsRecipients){
    await sendSms(to, `${body}. Open app to accept: [open QuickShift]`)
  }
})

// On accept, notify manager(s)
exports.onRequestAccept = functions.database.ref('/requests/{requestId}/acceptedBy').onWrite(async (change, context) => {
  if(!change.after.exists()) return
  const acceptedBy = change.after.val()
  const requestId = context.params.requestId
  const requestSnap = await db.ref(`requests/${requestId}`).once('value')
  const request = requestSnap.val()
  if(!request) return
  console.log('Request accepted', requestId, acceptedBy)

  // find managers
  const usersSnap = await db.ref('users').once('value')
  const users = usersSnap.val() || {}
  const managerTokens = []
  const managerPhones = []
  Object.entries(users).forEach(([uid,u])=>{
    if(u.role === 'manager'){
      if(u.notifyPush && u.fcmToken) managerTokens.push(u.fcmToken)
      if(u.notifySms && u.phone) managerPhones.push(u.phone)
    }
  })

  const title = 'Approval needed'
  const body = `${request.requesterName} -> ${acceptedBy} accepted for ${request.shiftStart}–${request.shiftEnd}. Approve?`
  await sendFcm(managerTokens, {title, body, data:{requestId}})
  for(const to of managerPhones) await sendSms(to, `${body}. Open app to approve.`)
})

const cors = require('cors')({origin: true})

// HTTPS endpoint to approve a request — must include Firebase ID token in Authorization: Bearer <token>
exports.approveRequest = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if(req.method !== 'POST') return res.status(400).send('POST only')
    const idToken = (req.headers.authorization || '').split('Bearer ')[1]
    if(!idToken) return res.status(401).send('Missing auth')
    try{
      const decoded = await admin.auth().verifyIdToken(idToken)
      const uid = decoded.uid
      const userSnap = await db.ref(`users/${uid}`).once('value')
      const user = userSnap.val()
      if(!user || user.role !== 'manager') return res.status(403).send('Not a manager')

      const { requestId } = req.body
      if(!requestId) return res.status(400).send('Missing requestId')

      const reqRef = db.ref(`requests/${requestId}`)
      const rSnap = await reqRef.once('value')
      const request = rSnap.val()
      if(!request) return res.status(404).send('Request not found')
      if(request.status === 'approved') return res.status(400).send('Already approved')

      await reqRef.update({status:'approved', approvedBy: uid, approvedAt: Date.now()})

      // notify requester and accepter
      const notifyUids = [request.requesterId, request.acceptedBy].filter(Boolean)
      const usersSnap = await db.ref('users').once('value')
      const users = usersSnap.val() || {}
      const tokens = []
      const phones = []
      notifyUids.forEach(u=>{
        const info = users[u]
        if(!info) return
        if(info.notifyPush && info.fcmToken) tokens.push(info.fcmToken)
        if(info.notifySms && info.phone) phones.push(info.phone)
      })
      const title = 'Shift approved'
      const body = `Your shift request has been approved.`
      await sendFcm(tokens, {title, body, data:{requestId}})
      for(const to of phones) await sendSms(to, body)

      res.status(200).send({ok:true})
    }catch(e){
      console.error('approveRequest error', e)
      res.status(401).send('Auth error')
    }
  })
})

// Also provide a callable version (https.onCall) so the client can use firebase/functions SDK without manual auth header
exports.approveRequestCallable = functions.https.onCall(async (data, context) => {
  if(!context.auth) throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.')
  const uid = context.auth.uid
  const userSnap = await db.ref(`users/${uid}`).once('value')
  const user = userSnap.val()
  if(!user || user.role !== 'manager') throw new functions.https.HttpsError('permission-denied', 'Not a manager')
  const requestId = data.requestId
  if(!requestId) throw new functions.https.HttpsError('invalid-argument', 'Missing requestId')

  const reqRef = db.ref(`requests/${requestId}`)
  const rSnap = await reqRef.once('value')
  const request = rSnap.val()
  if(!request) throw new functions.https.HttpsError('not-found', 'Request not found')
  if(request.status === 'approved') throw new functions.https.HttpsError('failed-precondition', 'Already approved')

  await reqRef.update({status:'approved', approvedBy: uid, approvedAt: Date.now()})

  // notify requester and accepter
  const notifyUids = [request.requesterId, request.acceptedBy].filter(Boolean)
  const usersSnap = await db.ref('users').once('value')
  const users = usersSnap.val() || {}
  const tokens = []
  const phones = []
  notifyUids.forEach(u=>{
    const info = users[u]
    if(!info) return
    if(info.notifyPush && info.fcmToken) tokens.push(info.fcmToken)
    if(info.notifySms && info.phone) phones.push(info.phone)
  })
  const title = 'Shift approved'
  const body = `Your shift request has been approved.`
  await sendFcm(tokens, {title, body, data:{requestId}})
  for(const to of phones) await sendSms(to, body)

  return {ok:true}
})
