// app/layout.tsx — Javari AuditOps
// CR AudioViz AI · EIN 39-3646201 · June 2026
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><title>Javari AuditOps</title><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
    <body style={{margin:0,padding:0,background:"#040912",color:"#e2e8f0",fontFamily:"system-ui"}}>{children}</body></html>);
}
