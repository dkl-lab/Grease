const express = require('express');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.protonmail.ch',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper function to execute team-db commands
function runTeamDb(query) {
  return new Promise((resolve, reject) => {
    // Escape double quotes for the shell command
    const safeQuery = query.replace(/"/g, '\\"');
    exec(`team-db "${safeQuery}"`, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        // If it's not JSON, it might be an empty success or an error message
        if (stdout.trim() === '' || stdout.trim() === '[]') {
          resolve([]);
        } else {
          resolve(stdout.trim());
        }
      }
    });
  });
}

// Escape single quotes for SQL
function escapeSql(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
}

app.post('/api/lead', async (req, res) => {
  const { name, business, email, phone, volume, message } = req.body;

  if (!name || !business || !email) {
    return res.status(400).json({ success: false, error: 'Missing required fields: name, business, and email are required.' });
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
    await runTeamDb(sql);
    
    // Get the last inserted id
    const lastIdResult = await runTeamDb("SELECT id FROM leads ORDER BY id DESC LIMIT 1");
    const insertedId = lastIdResult[0]?.id;

    // Send email notification (non-blocking)
    const emailTo = 'greasecyclepro@protonmail.com';
    const emailSubject = `New Lead: ${business} - ${name}`;
    const emailHtml = `
      <h2>New Lead Details</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Business:</strong> ${business}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Weekly Volume:</strong> ${volume || 'N/A'}</p>
      <p><strong>Message:</strong> ${message || 'N/A'}</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    `;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials not set, skipping email notification.');
    } else {
      transporter.sendMail({
        from: `"GreaseCycle Pro" <${process.env.SMTP_USER}>`,
        to: emailTo,
        subject: emailSubject,
        html: emailHtml,
      }).catch(err => {
        console.error('Error sending email notification:', err);
      });
    }

    res.json({ success: true, id: insertedId });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: 'Failed to store lead.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const countResult = await runTeamDb("SELECT COUNT(*) as count FROM leads");
    const count = countResult[0]?.count || 0;
    res.json({ status: 'ok', leads_count: count });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Lead capture API listening at http://0.0.0.0:${port}`);
});
