const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3001;

// 生成随机邮箱名
function generateRandomEmail() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(randomBytes[i] % chars.length);
    }
    return result + '@nimail.cn';
}

// 提取验证码
function extractVerificationCode(content) {
    console.log('提取验证码，内容预览:', content.substring(0, 300));
    
    // 1. 从 <strong> 标签提取（Lovart 格式）
    const strongMatch = content.match(/<strong>\s*(\d{6})\s*<\/strong>/i);
    if (strongMatch) {
        console.log('从 <strong> 标签提取:', strongMatch[1]);
        return strongMatch[1];
    }
    
    // 2. Lovart 模式
    const lovartMatch = content.match(/Enter this code within the next \d+ minutes[\s\S]*?(\d{6})/i);
    if (lovartMatch) {
        console.log('Lovart 模式匹配:', lovartMatch[1]);
        return lovartMatch[1];
    }
    
    // 3. 通用6位数字匹配（排除日期时间戳）
    const allNumbers = content.match(/\b(\d{6})\b/g);
    if (allNumbers) {
        for (const num of allNumbers) {
            // 排除日期格式 (20xxxx, 17xxxxx 等)
            if (!/^20\d{4}$/.test(num) && !/^17\d{5}$/.test(num) && !/^19\d{4}$/.test(num)) {
                console.log('通用模式匹配:', num);
                return num;
            }
        }
    }
    
    console.log('未能提取到验证码');
    return null;
}

// 调用 NiMail API（JSON）
async function callNiMailAPI(endpoint, body) {
    const url = `https://www.nimail.cn/api/${endpoint}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'accept-language': 'zh-CN',
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://www.nimail.cn',
            'referer': 'https://www.nimail.cn/'
        },
        body: body
    });
    
    return await response.json();
}

// 获取邮件内容 - 使用正确的 NiMail API
async function getMailContent(email, mailId) {
    console.log('获取邮件内容:', { email, mailId });
    
    // 方式1: 使用 /api/raw-html/{email}/{mailId} (最可靠)
    try {
        const url = `https://www.nimail.cn/api/raw-html/${email}/${mailId}`;
        console.log('尝试 raw-html API:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'zh-CN',
                'referer': 'https://www.nimail.cn/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('raw-html 响应状态:', response.status);
        
        if (response.ok) {
            const html = await response.text();
            console.log('raw-html 内容长度:', html.length, '预览:', html.substring(0, 200));
            if (html && html.length > 50 && !html.includes('{"success":"false"}')) {
                return html;
            }
        }
    } catch (e) {
        console.log('raw-html 失败:', e.message);
    }
    
    // 方式2: 使用 /api/viewmail POST 请求
    try {
        const url = 'https://www.nimail.cn/api/viewmail';
        const body = `mail=${encodeURIComponent(mailId)}&to=${encodeURIComponent(email)}&_=${Date.now()}`;
        console.log('尝试 viewmail API');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www.nimail.cn',
                'referer': 'https://www.nimail.cn/'
            },
            body: body
        });
        
        console.log('viewmail 响应状态:', response.status);
        
        if (response.ok) {
            const text = await response.text();
            console.log('viewmail 内容长度:', text.length, '预览:', text.substring(0, 200));
            
            // 尝试解析为 JSON
            try {
                const data = JSON.parse(text);
                if (data.success === 'true' && data.mail) {
                    console.log('viewmail 解析成功');
                    return data.mail;
                }
            } catch {
                // 不是 JSON，直接返回
                if (text.length > 50) {
                    return text;
                }
            }
        }
    } catch (e) {
        console.log('viewmail 失败:', e.message);
    }
    
    // 方式3: 尝试直接访问邮箱页面获取邮件
    try {
        const username = email.split('@')[0];
        const url = `https://www.nimail.cn/${username}`;
        console.log('尝试访问邮箱页面:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'text/html',
                'referer': 'https://www.nimail.cn/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.ok) {
            const html = await response.text();
            console.log('邮箱页面长度:', html.length);
            // 这个页面可能包含邮件列表的 JavaScript 数据
            if (html && html.length > 100) {
                return html;
            }
        }
    } catch (e) {
        console.log('邮箱页面失败:', e.message);
    }
    
    console.log('所有方式都失败了');
    return null;
}

// 处理 API 请求
async function handleAPI(req, res, pathname) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        if (pathname === '/api/apply') {
            // 生成邮箱
            const email = generateRandomEmail();
            const body = `mail=${encodeURIComponent(email)}`;
            
            console.log('申请邮箱:', email);
            const result = await callNiMailAPI('applymail', body);
            console.log('NiMail 响应:', result);
            
            res.writeHead(200);
            res.end(JSON.stringify({
                success: result.success === 'true',
                email: email,
                timestamp: Date.now()
            }));
            
        } else if (pathname === '/api/getcode') {
            // 获取验证码
            const url = new URL(req.url, `http://localhost:${PORT}`);
            const email = url.searchParams.get('email');
            
            if (!email) {
                res.writeHead(400);
                res.end(JSON.stringify({ success: false, error: '请提供邮箱地址' }));
                return;
            }
            
            console.log('查询邮箱:', email);
            
            // 获取邮件列表
            const timestamp = Date.now();
            const body = `mail=${encodeURIComponent(email)}&time=0&_=${timestamp}`;
            const data = await callNiMailAPI('getmails', body);
            
            console.log('邮件列表:', JSON.stringify(data).substring(0, 300));
            
            const mails = data.mail || data.mails || [];
            
            if (!mails || mails.length === 0) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: false, error: '暂无邮件', mailCount: 0 }));
                return;
            }
            
            // 遍历邮件
            for (const mail of mails) {
                const subject = mail.subject || '';
                const from = mail.from || '';
                const mailId = mail.id;
                
                console.log('检查邮件:', { subject, from, mailId });
                
                // 检查是否是 Lovart 邮件
                const isLovart = subject.toLowerCase().includes('lovart') ||
                                 from.toLowerCase().includes('lovart') ||
                                 subject.toLowerCase().includes('welcome');
                
                if (isLovart && mailId) {
                    console.log('找到 Lovart 邮件，尝试获取内容...');
                    
                    // 获取邮件内容
                    const content = await getMailContent(email, mailId);
                    
                    if (content) {
                        console.log('成功获取邮件内容，长度:', content.length);
                        const code = extractVerificationCode(content);
                        
                        if (code) {
                            console.log('验证码提取成功:', code);
                            res.writeHead(200);
                            res.end(JSON.stringify({
                                success: true,
                                code: code,
                                email: email,
                                mailCount: mails.length
                            }));
                            return;
                        } else {
                            console.log('内容中未找到验证码，继续尝试...');
                        }
                    }
                    
                    // 无法获取内容或提取验证码
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: false,
                        needManual: true,
                        email: email,
                        mailCount: mails.length
                    }));
                    return;
                }
            }
            
            res.writeHead(200);
            res.end(JSON.stringify({
                success: false,
                error: '未找到 Lovart 邮件',
                mailCount: mails.length
            }));
            
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    } catch (error) {
        console.error('API 错误:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

// 处理静态文件
function serveStatic(req, res, pathname) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    const extname = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon'
    };
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentTypes[extname] || 'text/plain' });
            res.end(content);
        }
    });
}

// 创建服务器
const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
    
    console.log(`${req.method} ${pathname}`);
    
    if (pathname.startsWith('/api/')) {
        await handleAPI(req, res, pathname);
    } else {
        serveStatic(req, res, pathname);
    }
});

server.listen(PORT, () => {
    console.log(`
========================================
  Lovart 临时邮箱服务器已启动!
  访问地址: http://localhost:${PORT}
  按 Ctrl+C 停止服务器
========================================
`);
});
