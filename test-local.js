const fs = require('fs');

// Copy functions dari bot-cloudflare.js
function decodeHTML(str) {
    return str
        .replace(/&#038;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/&#8230;/g, '…')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
}

function generateRiotLink(title) {
    const versionMatch = title.match(/patch notes?\s+(\d+\.\d+[a-z]?)/i);
    if (!versionMatch) return null;
    const version = versionMatch[1].replace('.', '-');
    return `https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-${version}/`;
}

// Baca file XML lokal
const xml = fs.readFileSync('./rss.xml', 'utf-8');

// Extract semua <item>
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

console.log(`\n📦 Total items found: ${items.length}\n`);
console.log('='.repeat(80));

// Loop dan test
items.forEach((it, index) => {
    const block = it[1];
    
    // Extract title & link
    const titleRaw = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const title = decodeHTML(titleRaw);
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    
    console.log(`\n${index + 1}. ${title}`);
    console.log(`   📅 ${pubDate}`);
    console.log(`   🔗 ${link}`);
    
    // Cek apakah ada kata "patch"
    const hasPatch = title.toLowerCase().includes('patch');
    console.log(`   🎯 Contains "patch": ${hasPatch ? '✅ YES' : '❌ NO'}`);
    
    if (hasPatch) {
        const officialLink = generateRiotLink(title);
        if (officialLink) {
            console.log(`   🎮 Official Riot Link: ${officialLink}`);
        } else {
            console.log(`   ⚠️  Could not generate Riot link (fallback to RSS link)`);
        }
    }
    
    console.log('-'.repeat(80));
});

// Test khusus untuk item yang ada "patch notes"
console.log('\n\n🔍 FILTERING: Items with "Patch Notes" only:\n');
console.log('='.repeat(80));

const patchItems = items.filter(it => {
    const block = it[1];
    const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
    return title.toLowerCase().includes('patch');
});

console.log(`Found ${patchItems.length} patch-related items:\n`);

patchItems.forEach((it, index) => {
    const block = it[1];
    const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
    const officialLink = generateRiotLink(title);
    
    console.log(`${index + 1}. ${title}`);
    console.log(`   → ${officialLink || 'Could not generate link'}\n`);
});
