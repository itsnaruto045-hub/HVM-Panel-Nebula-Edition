const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const { execFile } = require('child_process');
const { validateString } = require('./utilities');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..')));

const DATA_DIR = __dirname;
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

function readJSON(f){ try{ return JSON.parse(fs.readFileSync(f)); }catch(e){ return {}; } }
function writeJSON(f,obj){ fs.writeFileSync(f, JSON.stringify(obj, null, 2)); }

const SESSIONS = {};

app.post('/api/login', async (req,res)=>{
  const { username, password } = req.body;
  if(!validateString(username) || !validateString(password)) return res.status(400).json({error:'invalid'});
  const users = readJSON(USERS_FILE);
  const user = users[username];
  if(!user) return res.status(401).json({ error: 'invalid' });
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) return res.status(401).json({ error: 'invalid' });
  const token = Math.random().toString(36).slice(2);
  SESSIONS[token] = username;
  res.json({ token, username, role: user.role });
});

function auth(req,res,next){
  const token = req.headers['x-token'];
  if(!token || !SESSIONS[token]) return res.status(401).json({ error:'unauth' });
  req.user = SESSIONS[token];
  next();
}
function requireAdmin(req,res,next){
  const users = readJSON(USERS_FILE);
  const u = users[req.user];
  if(!u || u.role !== 'admin') return res.status(403).json({ error:'forbidden' });
  next();
}

app.post('/api/admin/create-user', auth, requireAdmin, async (req,res)=>{
  const { username, password, role='user' } = req.body;
  if(!validateString(username) || !validateString(password)) return res.status(400).json({error:'invalid'});
  const users = readJSON(USERS_FILE);
  if(users[username]) return res.status(400).json({ error:'exists' });
  const hash = await bcrypt.hash(password, 10);
  users[username] = { password: hash, role };
  writeJSON(USERS_FILE, users);
  res.json({ ok:true });
});

app.post('/api/admin/add-server', auth, requireAdmin, (req,res)=>{
  const { id, name, host, commands = {} } = req.body;
  if(!validateString(id) || !validateString(name) || !validateString(host)) return res.status(400).json({error:'invalid'});
  const servers = readJSON(SERVERS_FILE) || {};
  servers[id] = { id, name, host, commands, allowedUsers: [] };
  writeJSON(SERVERS_FILE, servers);
  res.json({ ok:true });
});

app.post('/api/admin/assign', auth, requireAdmin, (req,res)=>{
  const { id, username } = req.body;
  const users = readJSON(USERS_FILE);
  const servers = readJSON(SERVERS_FILE);
  if(!users[username] || !servers[id]) return res.status(400).json({error:'invalid'});
  const s = servers[id];
  if(!s.allowedUsers) s.allowedUsers = [];
  if(!s.allowedUsers.includes(username)) s.allowedUsers.push(username);
  writeJSON(SERVERS_FILE, servers);
  res.json({ ok:true });
});

app.get('/api/servers', auth, (req,res)=>{
  const servers = readJSON(SERVERS_FILE) || {};
  const users = readJSON(USERS_FILE);
  const me = req.user;
  const isAdmin = users[me] && users[me].role === 'admin';
  const list = Object.values(servers).filter(s => isAdmin || (s.allowedUsers||[]).includes(me));
  res.json(list);
});

app.post('/api/servers/:id/action', auth, (req,res)=>{
  const id = req.params.id;
  const { action } = req.body;
  if(!validateString(action)) return res.status(400).json({error:'invalid'});
  const servers = readJSON(SERVERS_FILE) || {};
  const s = servers[id];
  if(!s) return res.status(404).json({error:'notfound'});
  const users = readJSON(USERS_FILE);
  const me = req.user;
  const isAdmin = users[me] && users[me].role === 'admin';
  if(!(isAdmin || (s.allowedUsers||[]).includes(me))) return res.status(403).json({error:'forbidden'});

  const cmdObj = (s.commands && s.commands[action]);
  if(!cmdObj || !cmdObj.file) return res.status(400).json({ error:'action-not-allowed' });

  const file = cmdObj.file;
  const args = cmdObj.args || [];
  execFile(file, args, (err, stdout, stderr) => {
    if(err){
      return res.status(500).json({ error: 'exec-failed', detail: stderr || err.message });
    }
    res.json({ ok:true, out: stdout });
  });
});

app.get('/api/ping', (req,res)=> res.json({ ok:true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log('HVM API listening on', PORT));
