import React from 'react'

export default function RequestList({requests, user, onAccept}){
  return (
    <div>
      {requests.map(r=> (
        <div key={r.id} style={{border:'1px solid #ddd',padding:10,marginBottom:8}}>
          <div><strong>{r.requesterName}</strong> — {r.shiftStart} to {r.shiftEnd} @ {r.location}</div>
          <div>{r.notes}</div>
          <div>Status: {r.status}</div>
          {user && r.requesterId !== user.uid && r.status==='open' && (
            <button onClick={()=>onAccept(r.id)}>Accept</button>
          )}
        </div>
      ))}
    </div>
  )
}
