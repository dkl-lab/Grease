const express = require('express');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();
// Default to 3001 for local dev, but allow process.env.PORT for production (like Vercel)
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.protonmail.ch',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Executes a SQL query using the team-db CLI.
 * Returns a Promise that resolves to the parsed JSON output.
 */
function runTeamDb(query) {
  return new Promise((resolve, reject) => {
    // Escape double quotes for the shell command
    const safeQuery = query.replace(/"/g, '\"');
    exec(`team-db "${safeQuery}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`team-db error: ${error.message}`);
        return reject(error);
      }
      
      const trimmedOutput = stdout.trim();
      
      if (!trimmedOutput || trimmedOutput === '[]') {
        return resolve([]);
      }

      try {
        const result = JSON.parse(trimmedOutput);
        resolve(result);
      } catch (e) {
        // Fallback for non-JSON output (e.g. success messages or errors)
        console.warn(`Could not parse team-db output as JSON: "${trimmedOutput}"`);
        resolve(trimmedOutput);
      }
    });
  });
}

/**
 * Escapes single quotes in a string for safe inclusion in a SQL query.
 */
function escapeSql(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
}

/**
 * POST /api/lead
 * Receives lead data, stores it in the database, and sends an email notification.
 */
app.post('/api/lead', async (req, res) => {
  const { name, business, email, phone, volume, message } = req.body;

  // Basic validation
  if (!name || !business || !email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: name, business, and email are required.' 
    });
  }

  const sql = `INSERT INTO leads (name, business, email, phone, volume, message, source) VALUES (
    '${escapeSql(name)}',
    '${escapeSql(business)}',
    '${escapeSql(email)}',
    '${escapeSql(phone || '')}',
    '${escapeSql(volume || '')}',
    '${escapeSql(message || '')}',
    'website'
  )`;

  try {
    // Store in database
    await runTeamDb(sql);
    
    // Attempt to get the ID of the newly inserted lead
    const lastIdResult = await runTeamDb("SELECT id FROM leads ORDER BY id DESC LIMIT 1");
    const insertedId = (Array.isArray(lastIdResult) && lastIdResult[0]) ? lastIdResult[0].id : null;

    // Send email notification (non-blocking / best-effort)
    const emailTo = 'greasecyclepro@protonmail.com';
    const emailSubject = `New Lead: ${business} - ${name}`;
    const emailHtml = `
      <h2>New Lead Details</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Business:</strong> ${business}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Estimated Volume:</strong> ${volume || 'N/A'}</p>
      <p><strong>Message:</strong> ${message || 'N/A'}</p>
      <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
    `;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials not configured. Lead stored in DB but email notification skipped.');
    } else {
      transporter.sendMail({
        from: `"GreaseCycle Pro" <${process.env.SMTP_USER}>`,
        to: emailTo,
        subject: emailSubject,
        html: emailHtml,
      }).then(() => {
        console.log(`Email notification sent for lead from ${business}`);
      }).catch(err => {
        console.error('Failed to send email notification:', err);
      });
    }

    res.json({ success: true, id: insertedId });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error. Failed to process lead.' });
  }
});

/**
 * GET /api/health
 * Returns the operational status of the API and the total lead count.
 */
app.get('/api/health', async (req, res) => {
  try {
    const countResult = await runTeamDb("SELECT COUNT(*) as count FROM leads");
    const count = (Array.isArray(countResult) && countResult[0]) ? countResult[0].count : 0;
    res.json({ status: 'ok', leads_count: count });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`GreaseCycle Pro Backend listening on port ${port}`);
});
