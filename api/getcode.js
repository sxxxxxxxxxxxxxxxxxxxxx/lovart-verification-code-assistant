// 提取验证码
function extractVerificationCode(content) {
    // 1. 从 <strong> 标签提取（Lovart 格式）
    const strongMatch = content.match(/<strong>\s*(\d{6})\s*<\/strong>/i);
    if (strongMatch) {
        return strongMatch[1];
    }
    
    // 2. Lovart 模式
    const lovartMatch = content.match(/Enter this code within the next \d+ minutes[\s\S]*?(\d{6})/i);
    if (lovartMatch) {
        return lovartMatch[1];
    }
    
    // 3. 通用6位数字匹配（排除日期时间戳）
    const allNumbers = content.match(/\b(\d{6})\b/g);
    if (allNumbers) {
        for (const num of allNumbers) {
            if (!/^20\d{4}$/.test(num) && !/^17\d{5}$/.test(num) && !/^19\d{4}$/.test(num)) {
                return num;
            }
        }
    }
    
    return null;
}

// 获取邮件内容
async function getMailContent(email, mailId) {
    // 方式1: 使用 /api/raw-html/{email}/{mailId}
    try {
        const url = `https://www.nimail.cn/api/raw-html/${email}/${mailId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'text/html,application/xhtml+xml',
                'accept-language': 'zh-CN',
                'referer': 'https://www.nimail.cn/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.ok) {
            const html = await response.text();
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
        
        if (response.ok) {
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                if (data.success === 'true' && data.mail) {
                    return data.mail;
                }
            } catch {
                if (text.length > 50) {
                    return text;
                }
            }
        }
    } catch (e) {
        console.log('viewmail 失败:', e.message);
    }
    
    return null;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const email = req.query.email;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: '请提供邮箱地址' 
            });
        }
        
        // 获取邮件列表
        const timestamp = Date.now();
        const body = `mail=${encodeURIComponent(email)}&time=0&_=${timestamp}`;
        
        const response = await fetch('https://www.nimail.cn/api/getmails', {
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
        
        const data = await response.json();
        const mails = data.mail || data.mails || [];
        
        if (!mails || mails.length === 0) {
            return res.status(200).json({ 
                success: false, 
                error: '暂无邮件', 
                mailCount: 0 
            });
        }
        
        // 遍历邮件
        for (const mail of mails) {
            const subject = mail.subject || '';
            const from = mail.from || '';
            const mailId = mail.id;
            
            // 检查是否是 Lovart 邮件
            const isLovart = subject.toLowerCase().includes('lovart') ||
                             from.toLowerCase().includes('lovart') ||
                             subject.toLowerCase().includes('welcome');
            
            if (isLovart && mailId) {
                // 获取邮件内容
                const content = await getMailContent(email, mailId);
                
                if (content) {
                    const code = extractVerificationCode(content);
                    
                    if (code) {
                        return res.status(200).json({
                            success: true,
                            code: code,
                            email: email,
                            mailCount: mails.length
                        });
                    }
                }
                
                // 无法获取内容或提取验证码
                return res.status(200).json({
                    success: false,
                    needManual: true,
                    email: email,
                    mailCount: mails.length
                });
            }
        }
        
        return res.status(200).json({
            success: false,
            error: '未找到 Lovart 邮件',
            mailCount: mails.length
        });
        
    } catch (error) {
        console.error('获取验证码错误:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}
