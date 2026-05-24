/**
 * test.js — End-to-end test for ResearchPilot
 */
const http = require('http');

const topic = 'AI agents for autonomous scientific discovery';
const data = JSON.stringify({ topic });

console.log(`\n🧪 Testing ResearchPilot with topic: "${topic}"\n`);

const opts = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/research',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(opts, (res) => {
  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();

    // Split on double newline (SSE message separator)
    const messages = buffer.split('\n\n');
    buffer = messages.pop() || ''; // Keep incomplete message

    for (const msg of messages) {
      const line = msg.trim();
      if (!line.startsWith('data: ')) continue;

      try {
        const event = JSON.parse(line.slice(6));
        const m = event.message || '';
        if (m) {
          console.log(`[${event.step}] ${m}`);
        }

        // Print report preview on completion
        if (event.type === 'agent_complete' && event.data) {
          if (event.data.report) {
            console.log('\n════════════════════════════════════════');
            console.log('  REPORT PREVIEW (first 1000 chars)');
            console.log('════════════════════════════════════════\n');
            console.log(event.data.report.substring(0, 1000));
            console.log('\n... [truncated]\n');
          }
          if (event.data.stats) {
            console.log('════════════════════════════════════════');
            console.log('  STATS');
            console.log('════════════════════════════════════════\n');
            console.log(JSON.stringify(event.data.stats, null, 2));
          }
        }
      } catch (e) {
        // Skip malformed events
      }
    }
  });

  res.on('end', () => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  });

  res.on('error', (e) => {
    console.error('Response error:', e.message);
    process.exit(1);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  console.error('Is the server running? Start with: node server.js');
  process.exit(1);
});

req.write(data);
req.end();

// Timeout after 5 minutes
setTimeout(() => {
  console.error('\n⏰ Test timed out after 5 minutes');
  process.exit(1);
}, 300000);
