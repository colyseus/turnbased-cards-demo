const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('id="error-log"')) {
  const replacement = `
      {/* UI LAYER (zIndex: 10) */}
      <div id="error-log" style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,0,0,0.8)', color: 'white', zIndex: 9999, fontSize: '12px', whiteSpace: 'pre-wrap', pointerEvents: 'none' }}></div>
      <script>
        {(() => {
          if (typeof window !== 'undefined' && !window.__loggerAdded) {
            window.__loggerAdded = true;
            const oldError = console.error;
            console.error = function(...args) {
              const el = document.getElementById('error-log');
              if (el) {
                el.innerText += args.join(' ') + '\\n';
              }
              oldError.apply(console, args);
            };
            window.addEventListener('error', e => {
              const el = document.getElementById('error-log');
              if (el) el.innerText += e.message + '\\n';
            });
            window.addEventListener('unhandledrejection', e => {
              const el = document.getElementById('error-log');
              if (el) el.innerText += e.reason + '\\n';
            });
          }
          return null;
        })()}
      </script>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>`;
  
  code = code.replace('{/* UI LAYER (zIndex: 10) */}\n      <div style={{ position: \'absolute\', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: \'none\', zIndex: 10 }}>', replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Logger added");
}
