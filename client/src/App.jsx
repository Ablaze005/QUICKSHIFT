import React, {useEffect, useState} from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, ref, push, set, onValue, update, get, connectDatabaseEmulator } from 'firebase/database'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { firebaseConfig } from './firebase'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app)
const functions = getFunctions(app)

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export default function App(){
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState({shiftStart:'', shiftEnd:'', location:'', notes:''})

  useEffect(()=>{
    onAuthStateChanged(auth, async u=>{
      setUser(u)
      if(u){
        // ensure user record exists in Realtime DB
        try{
          const userRef = ref(db, `users/${u.uid}`)
          const snap = await get(userRef)
          if(!snap.exists()){
            const phone = prompt('Phone number (E.164) — optional (e.g. +1555123)') || ''
            const role = prompt('Role (employee or manager) — default employee') || 'employee'
            await set(userRef, { name: u.email, phone, role, notifySms: !!phone, notifyPush: true })
            setProfile({ name: u.email, phone, role, notifySms: !!phone, notifyPush: true })
          }else{
            setProfile(snap.val())
          }

          // register FCM token (web push) if possible
          try{
            const messaging = getMessaging()
            // Request permission
            if(Notification.permission !== 'granted'){
              await Notification.requestPermission()
            }
            if(Notification.permission === 'granted'){
              const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
              const token = await getToken(messaging, { vapidKey })
              if(token){
                await set(ref(db, `users/${u.uid}/fcmToken`), token)
                console.log('Saved FCM token')
              }

              onMessage(messaging, payload=>{
                console.log('Foreground message', payload)
                alert(payload.notification?.title + '\n' + payload.notification?.body)
              })
            }
          }catch(e){ console.warn('FCM setup failed', e) }
        }catch(e){ console.error('Error ensuring user record', e) }
      }else{
        setProfile(null)
      }
    })

    const reqRef = ref(db, 'requests')
    onValue(reqRef, snap=>{
      const raw = snap.val() || {}
      const list = Object.entries(raw).map(([id, val])=>({id, ...val}))
      setRequests(list.reverse())
    })
  },[])

  async function createRequest(e){
    e.preventDefault()
    if(!user) return alert('Please login')
    const r = {
      requesterId: user.uid,
      requesterName: user.email,
      shiftStart: form.shiftStart,
      shiftEnd: form.shiftEnd,
      location: form.location,
      notes: form.notes,
      status: 'open',
      acceptedBy: null,
      createdAt: Date.now()
    }
    const newRef = push(ref(db, 'requests'))
    await set(newRef, r)
    setForm({shiftStart:'', shiftEnd:'', location:'', notes:''})
  }

  async function acceptRequest(id){
    if(!user) return alert('Please login')
    const updates = {}
    updates[`/requests/${id}/acceptedBy`] = user.uid
    updates[`/requests/${id}/status`] = 'pendingApproval'
    await update(ref(db), updates)
  }

  async function approveRequest(id){
    if(!user) return alert('Please login')
    if(!profile || profile.role !== 'manager') return alert('Only managers can approve')
    try{
      const callable = httpsCallable(functions, 'approveRequestCallable')
      const res = await callable({ requestId: id })
      if(res.data && res.data.ok) alert('Approved')
    }catch(e){
      alert('Approve failed: '+(e.message || e.code || e))
    }
  }

  async function doLogin(){
    const email = prompt('Email')
    const pass = prompt('Password')
    try{
      await signInWithEmailAndPassword(auth, email, pass)
    }catch(e){
      if(e.code==='auth/user-not-found'){
        try{
          const userCred = await createUserWithEmailAndPassword(auth, email, pass)
          // user record creation handled in onAuthStateChanged
        }catch(err){ alert(err.message) }
      }else{alert(e.message)}
    }
  }

  return (
    <div style={{padding:20,fontFamily:'sans-serif'}}>
      <h1>QuickShift</h1>
      <div style={{marginBottom:20}}>
        {user ? (
          <>
            <span>Signed in: {user.email} {profile ? `(${profile.role})` : ''}</span>
            <button style={{marginLeft:10}} onClick={()=>signOut(auth)}>Sign out</button>
          </>
        ) : (
          <button onClick={doLogin}>Sign in / Sign up (email)</button>
        )}
      </div>

      <section style={{marginBottom:20}}>
        <h2>Create request</h2>
        <form onSubmit={createRequest}>
          <input placeholder="Shift start" value={form.shiftStart} onChange={e=>setForm({...form, shiftStart:e.target.value})} />
          <input placeholder="Shift end" value={form.shiftEnd} onChange={e=>setForm({...form, shiftEnd:e.target.value})} />
          <input placeholder="Location" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} />
          <input placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} />
          <button>Create</button>
        </form>
      </section>

      <section>
        <h2>Open requests</h2>
        {requests.filter(r=>r.status==='open' || r.status==='pendingApproval' || r.status==='approved').map(r=> (
          <div key={r.id} style={{border:'1px solid #ddd',padding:10,marginBottom:8}}>
            <div><strong>{r.requesterName}</strong> — {r.shiftStart} to {r.shiftEnd} @ {r.location}</div>
            <div>{r.notes}</div>
            <div>Status: {r.status} {r.acceptedBy? ' — accepted by '+r.acceptedBy : ''}</div>
            {user && r.requesterId !== user.uid && r.status==='open' && (
              <button onClick={()=>acceptRequest(r.id)}>Accept</button>
            )}
            {r.status==='pendingApproval' && <em>Pending manager approval</em>}
            {r.status==='approved' && <strong>Approved</strong>}
            {profile && profile.role==='manager' && r.status==='pendingApproval' && (
              <div><button onClick={()=>approveRequest(r.id)}>Approve</button></div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
