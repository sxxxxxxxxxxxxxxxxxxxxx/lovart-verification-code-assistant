const crypto = require('crypto');

// 生成随机邮箱名
function generateRandomEmail() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '@nimail.cn';
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const email = generateRandomEmail();
        const body = `mail=${encodeURIComponent(email)}`;
        
        const response = await fetch('https://www.nimail.cn/api/applymail', {
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
        
        const result = await response.json();
        
        return res.status(200).json({
            success: result.success === 'true',
            email: email,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('申请邮箱错误:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

