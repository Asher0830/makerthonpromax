const fs = require('fs');
const path = require('path');

// 廣泛匹配 Emoji
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules') {
                results = results.concat(walk(fullPath));
            }
        } else {
            const ext = path.extname(fullPath);
            if (['.js', '.html', '.css'].includes(ext)) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = walk('./public');
let found = false;
files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    if (emojiRegex.test(content)) {
        console.log('Found emoji in:', f);
        found = true;
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (emojiRegex.test(line)) {
                console.log(`  Line ${idx + 1}: ${line.trim()}`);
            }
        });
    }
});

if (!found) {
    console.log('No emojis found under ./public! Perfect!');
}
