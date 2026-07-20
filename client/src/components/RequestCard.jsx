import React from 'react'

export default function RequestCard({r, user, onAccept}){
  return (
    <div style={{border:'1px solid #ddd',padding:10,marginBottom:8}}>
      <div><strong>{r.requesterName}</strong> — {r.shiftStart} to {r.shiftEnd} @ {r.location}</div>
      <div>{r.notes}</div>
      <div>Status: {r.status} {r.acceptedBy? ' — accepted by '+r.acceptedBy : ''}</div>
      {user && r.requesterId !== user.uid && r.status==='open' && (
        <button onClick={()=>onAccept(r.id)}>Accept</button>
      )}
    </div>
  )
}
