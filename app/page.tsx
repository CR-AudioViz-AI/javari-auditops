"use client";
// app/page.tsx — Javari AuditOps
// CR AudioViz AI · EIN 39-3646201 · June 2026
export default function Page() {
  return (
    <div style={{minHeight:"100vh",background:"#040912"}}>
      <nav style={{background:"#1E3A5F",padding:"0 20px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(0,180,216,0.15)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>🔍</span><span style={{fontWeight:800,color:"#00B4D8",fontSize:15}}>Javari AuditOps</span></div>
        <a href="https://craudiovizai.com/auth/signup" style={{background:"#FF0800",color:"#fff",borderRadius:7,padding:"5px 14px",fontSize:12,fontWeight:700,textDecoration:"none"}}>Sign Up Free</a>
      </nav>
      <section style={{background:"linear-gradient(135deg,#1E3A5F,#040912)",padding:"40px 24px 32px",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>🔍</div>
        <h1 style={{fontSize:"clamp(22px,4vw,40px)",fontWeight:900,color:"#fff",margin:"0 0 8px"}}>Javari AuditOps</h1>
        <p style={{color:"rgba(255,255,255,0.7)",fontSize:15,margin:0}}>Platform audit, compliance monitoring, and operational oversight</p>
      </section>
      <section style={{maxWidth:900,margin:"0 auto",padding:"24px 16px 48px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
          <div style={{background:"#0F1F32",border:"1px solid rgba(0,180,216,0.1)",borderRadius:12,padding:16}}><div style={{fontSize:24,marginBottom:6}}>🔍</div><div style={{fontWeight:700,color:"#e2e8f0",fontSize:13,marginBottom:3}}>Audit Scanner</div><div style={{fontSize:11,color:"#6B7280"}}>Platform-wide audit checks</div></div>
        <div style={{background:"#0F1F32",border:"1px solid rgba(0,180,216,0.1)",borderRadius:12,padding:16}}><div style={{fontSize:24,marginBottom:6}}>📊</div><div style={{fontWeight:700,color:"#e2e8f0",fontSize:13,marginBottom:3}}>Compliance Report</div><div style={{fontSize:11,color:"#6B7280"}}>Regulatory compliance status</div></div>
        <div style={{background:"#0F1F32",border:"1px solid rgba(0,180,216,0.1)",borderRadius:12,padding:16}}><div style={{fontSize:24,marginBottom:6}}>⚡</div><div style={{fontWeight:700,color:"#e2e8f0",fontSize:13,marginBottom:3}}>Health Monitor</div><div style={{fontSize:11,color:"#6B7280"}}>System health and alerts</div></div>
        </div>
      </section>
      <footer style={{borderTop:"1px solid rgba(0,180,216,0.08)",padding:"10px 24px",textAlign:"center"}}>
        <p style={{color:"#374151",fontSize:11,margin:0}}>© 2026 CR AudioViz AI, LLC · EIN: 39-3646201 · <a href="https://craudiovizai.com" style={{color:"#00B4D8",textDecoration:"none"}}>craudiovizai.com</a></p>
      </footer>
    </div>
  );
}
