// ================================
// CONFIG (Updated)
// ================================
// const DISCORD_WEBHOOK = ''; MAIN WEBHOOK
const DISCORD_WEBHOOK = 'ur-webook'

const VALORANT_RSS = 'https://www.fragster.com/valorant/feed/';
// Using CORS proxy to bypass Cloudflare protection (with fallbacks)
const STEAMDB_RSS_URL = 'https://steamdb.info/api/PatchnotesRSS/?appid=730';
const CS2_PROXIES = [
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(STEAMDB_RSS_URL),
    'https://corsproxy.io/?' + encodeURIComponent(STEAMDB_RSS_URL),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(STEAMDB_RSS_URL),
];
const KV_KEY = 'PATCH_STATE';

// ================================
// ENABLE TRACING
// ================================
export const config = {
    tracing: {
        enabled: true,
        urls: ['https://gameriv.com', 'https://steamdb.info'],
    },
};

// ================================
// DECODE HTML
// ================================
function decodeHTML(str) {
    return str
        .replace(/&#038;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/&#8230;/g, '…')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
}

// ================================
// GENERATE RIOT OFFICIAL LINK
// ================================
function generateRiotLink(title) {
    // Extract version dari title (misal: "VALORANT Patch Notes 11.10" → "11.10")
    const versionMatch = title.match(/patch notes?\s+(\d+\.\d+[a-z]?)/i);
    if (!versionMatch) return null;

    const version = versionMatch[1].replace('.', '-'); // 11.10 → 11-10
    return `https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-${version}/`;
}

// ================================
// SEND EMBED (WITH @here)
// ================================
async function sendEmbed({ title, description, url, color }) {
    const payload = {
        content: '@here',
        embeds: [
            {
                title,
                description,
                url,
                color,
                timestamp: new Date().toISOString(),
                footer: { text: 'Azar PatchBot' },
            },
        ],
    };

    await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

// ================================
// FETCHERS
// ================================
async function fetchValorantItems() {
    const xml = await fetch(VALORANT_RSS, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://gameriv.com/',
            'Origin': 'https://gameriv.com',
        },
    }).then((r) => r.text());

    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
}

// Store last successful proxy for logging
let lastSuccessfulProxy = null;

async function fetchCS2Items() {
    const advancedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://steamdb.info/',
    };

    // Try each proxy until one works
    for (let i = 0; i < CS2_PROXIES.length; i++) {
        const proxyUrl = CS2_PROXIES[i];
        const proxyName = ['allorigins', 'corsproxy.io', 'codetabs'][i];
        
        try {
            console.log(`[CS2] Trying proxy: ${proxyName}...`);
            const response = await fetch(proxyUrl, {
                headers: advancedHeaders,
            });
            
            if (!response.ok) {
                console.error(`[CS2] ${proxyName} failed with status: ${response.status}`);
                continue; // Try next proxy
            }
            
            const xml = await response.text();
            
            // Validate response contains RSS data
            if (!xml.includes('<item>')) {
                console.error(`[CS2] ${proxyName} returned invalid data (no <item> found)`);
                continue; // Try next proxy
            }
            
            const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
            lastSuccessfulProxy = proxyName;
            console.log(`[CS2] SUCCESS via ${proxyName} - fetched ${items.length} items`);
            return items;
        } catch (error) {
            console.error(`[CS2] ${proxyName} error: ${error.message}`);
            continue; // Try next proxy
        }
    }
    
    lastSuccessfulProxy = null;
    console.error('[CS2] All proxies failed!');
    return [];
}

function getLastSuccessfulProxy() {
    return lastSuccessfulProxy;
}

// ================================
// MAIN WORKER
// ================================
export default {
    async scheduled(event, env, ctx) {
        console.log('=== SCHEDULED RUN START ===');
        
        // Cek apakah KV tersedia
        if (!env.PATCH_KV) {
            console.error('CRITICAL: PATCH_KV is not bound!');
            return;
        }
        
        let last = {};
        try {
            last = (await env.PATCH_KV.get(KV_KEY, 'json')) || {};
            console.log('Current state loaded:', JSON.stringify(last));
        } catch (kvReadError) {
            console.error('Failed to read from KV:', kvReadError);
        }

        try {
            await checkValorant(last);
        } catch (e) {
            console.error('Valorant error:', e);
        }

        try {
            await checkCS2(last);
        } catch (e) {
            console.error('CS2 error:', e);
        }

        console.log('Attempting to save state:', JSON.stringify(last));
        try {
            await env.PATCH_KV.put(KV_KEY, JSON.stringify(last));
            
            // Verify save
            const verify = await env.PATCH_KV.get(KV_KEY, 'json');
            console.log('State saved and verified:', JSON.stringify(verify));
        } catch (kvError) {
            console.error('CRITICAL: Failed to save to KV:', kvError);
        }
        
        console.log('=== SCHEDULED RUN END ===');
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/') return new Response('Worker active', { status: 200 });

        // ===========================
        // TEST ENDPOINTS
        // ===========================
        if (path.startsWith('/test1')) {
            const items = await fetchValorantItems();
            const block = items[0]?.[1];
            if (!block) return new Response('NO DATA');

            const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
            const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';

            if (path.endsWith('/send')) {
                const officialLink = generateRiotLink(title) || link;
                await sendEmbed({
                    title: '🧪 [TEST] VALORANT Patch Detected!',
                    description: `**[TEST MODE - Item 1]**\n${title}`,
                    url: officialLink,
                    color: 10526880,
                });
                return new Response('Test patch sent!');
            }

            return new Response(`ITEM 1:\n${title}\n${link}`);
        }

        if (path.startsWith('/test2')) {
            const items = await fetchValorantItems();
            const block = items[1]?.[1];
            if (!block) return new Response('NO SECOND ITEM');

            const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
            const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';

            if (path.endsWith('/send')) {
                const officialLink = generateRiotLink(title) || link;
                await sendEmbed({
                    title: '🧪 [TEST] VALORANT Patch Detected!',
                    description: `**[TEST MODE - Item 2]**\n${title}`,
                    url: officialLink,
                    color: 10526880,
                });
                return new Response('Test patch sent!');
            }

            return new Response(`ITEM 2:\n${title}\n${link}`);
        }

        if (path.startsWith('/test/valorant')) {
            const items = await fetchValorantItems();

            for (const it of items) {
                const block = it[1];
                const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
                const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';

                if (title.toLowerCase().includes('patch')) {
                    if (path.endsWith('/send')) {
                        const officialLink = generateRiotLink(title) || link;
                        await sendEmbed({
                            title: '🧪 [TEST] VALORANT Patch Detected!',
                            description: `**[TEST MODE - Generic]**\n${title}`,
                            url: officialLink,
                            color: 10526880,
                        });
                        return new Response('Test patch sent!');
                    }
                    return new Response(`PATCH FOUND:\n${title}\n${link}`);
                }
            }

            return new Response('NO PATCH FOUND');
        }

        // Test CS2 item 1 (must be before /test/cs2)
        if (path.startsWith('/test/cs2-1')) {
            const items = await fetchCS2Items();
            const item = items[0];
            if (!item) return new Response('NO CS2 ITEM 1');
            
            const block = item[1];
            const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
            
            if (path.endsWith('/send')) {
                await sendEmbed({
                    title: '🧪 [TEST] CS2 Update Detected!',
                    description: `**[TEST MODE - Item 1]**\n${title}`,
                    url: link,
                    color: 16766720,
                });
                return new Response('Test CS2 item 1 sent!');
            }

            return new Response(`CS2 ITEM 1:\n${title}\n${guid}\n${link}`);
        }

        // Test CS2 item 2 (must be before /test/cs2)
        if (path.startsWith('/test/cs2-2')) {
            const items = await fetchCS2Items();
            const item = items[1];
            if (!item) return new Response('NO CS2 ITEM 2');
            
            const block = item[1];
            const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
            
            if (path.endsWith('/send')) {
                await sendEmbed({
                    title: '🧪 [TEST] CS2 Update Detected!',
                    description: `**[TEST MODE - Item 2]**\n${title}`,
                    url: link,
                    color: 16766720,
                });
                return new Response('Test CS2 item 2 sent!');
            }

            return new Response(`CS2 ITEM 2:\n${title}\n${guid}\n${link}`);
        }

        // Test CS2 latest (generic, must be after specific routes)
        if (path.startsWith('/test/cs2')) {
            const items = await fetchCS2Items();
            const firstItem = items[0];
            if (!firstItem) return new Response('NO CS2 UPDATES');
            
            const block = firstItem[1];
            const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
            
            if (path.endsWith('/send')) {
                await sendEmbed({
                    title: '🧪 [TEST] CS2 Update Detected!',
                    description: `**[TEST MODE - Generic]**\n${title}`,
                    url: link,
                    color: 16766720,
                });
                return new Response('Test CS2 update sent!');
            }

            return new Response(`CS2 Latest Update:\n${title}\n${guid}\n${link}`);
        }

        // DEBUG: Liat raw XML
        if (path === '/debug/rss') {
            try {
                const xml = await fetch(VALORANT_RSS, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                }).then((r) => r.text());
                
                return new Response(xml, {
                    headers: { 'Content-Type': 'text/plain' }
                });
            } catch (e) {
                return new Response(`ERROR: ${e.message}`, { status: 500 });
            }
        }

        // DEBUG: Liat items count
        if (path === '/debug/items') {
            try {
                const items = await fetchValorantItems();
                return new Response(`Total items: ${items.length}\n\nFirst 3 titles:\n${
                    items.slice(0, 3).map((it, i) => {
                        const block = it[1];
                        const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
                        return `${i + 1}. ${title}`;
                    }).join('\n')
                }`);
            } catch (e) {
                return new Response(`ERROR: ${e.message}`, { status: 500 });
            }
        }

        // DEBUG: Liat raw XML CS2
        if (path === '/debug/cs2-rss') {
            try {
                const xml = await fetch(CS2_RSS, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                }).then((r) => r.text());
                
                return new Response(xml, {
                    headers: { 'Content-Type': 'text/plain' }
                });
            } catch (e) {
                return new Response(`ERROR: ${e.message}`, { status: 500 });
            }
        }

        // DEBUG: Liat items count CS2
        if (path === '/debug/cs2-items') {
            try {
                const items = await fetchCS2Items();
                return new Response(`Total CS2 items: ${items.length}\n\nFirst 3:\n${
                    items.slice(0, 3).map((it, i) => {
                        const block = it[1];
                        const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
                        const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
                        return `${i + 1}. ${title}\n   ${guid}`;
                    }).join('\n\n')
                }`);
            } catch (e) {
                return new Response(`ERROR: ${e.message}`, { status: 500 });
            }
        }

        // DEBUG: Cek KV storage
        if (path === '/debug/kv') {
            try {
                const stored = await env.PATCH_KV.get(KV_KEY, 'json');
                return new Response(JSON.stringify(stored, null, 2), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e) {
                return new Response(`ERROR: ${e.message}`, { status: 500 });
            }
        }

        // DEBUG: Reset KV storage
        if (path === '/debug/reset-kv') {
            try {
                await env.PATCH_KV.delete(KV_KEY);
                return new Response('KV storage cleared');
            } catch (e) {
                return new Response(`ERROR: ${e.message}`, { status: 500 });
            }
        }

        return new Response('Not Found', { status: 404 });
    },
};

// ================================
// PRODUCTION LOGIC
// ================================
async function checkValorant(last) {
    console.log('[VALORANT] Fetching RSS...');
    const items = await fetchValorantItems();
    console.log(`[VALORANT] Fetched ${items.length} items from RSS`);

    for (const it of items) {
        const block = it[1];
        const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
        const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';

        if (title.toLowerCase().includes('patch')) {
            console.log('[VALORANT] --- PATCH CHECK ---');
            console.log(`[VALORANT] Current patch title: "${title}"`);
            console.log(`[VALORANT] Stored patch title: "${last.valorant || 'none'}"`);
            console.log(`[VALORANT] Is new: ${last.valorant !== title}`);
            
            if (!title || title === last.valorant) {
                console.log('[VALORANT] Result: No new patch (same as stored)');
                return;
            }
            
            console.log('[VALORANT] Result: NEW PATCH DETECTED! Sending notification...');
            const officialLink = generateRiotLink(title) || link;
            console.log(`[VALORANT] Official link: ${officialLink}`);
            await sendEmbed({
                title: 'VALORANT Patch Detected!',
                description: title,
                url: officialLink,
                color: 10526880,
            });
            console.log('[VALORANT] Notification sent!');
            last.valorant = title;
            return;
        }
    }
    
    console.log('[VALORANT] Result: No patch found in RSS feed');
}

async function checkCS2(last) {
    const items = await fetchCS2Items();
    const proxyUsed = getLastSuccessfulProxy();
    console.log(`[CS2] Proxy used: ${proxyUsed || 'none (all failed)'}`);
    
    // Ambil item pertama (update terbaru)
    const firstItem = items[0];
    if (!firstItem) {
        console.log('[CS2] Result: No items found (fetch failed)');
        return;
    }
    
    const block = firstItem[1];
    const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
    
    // Extract BuildID dari guid (format: "build#20897362")
    const buildMatch = guid.match(/build#(\d+)/);
    const buildId = buildMatch ? buildMatch[1] : (guid || title);
    
    console.log('[CS2] --- BUILD CHECK ---');
    console.log(`[CS2] Current build ID: ${buildId}`);
    console.log(`[CS2] Current title: "${title}"`);
    console.log(`[CS2] Current GUID: ${guid}`);
    console.log(`[CS2] Stored build ID: "${last.cs2 || 'none'}"`);
    console.log(`[CS2] Is new: ${last.cs2 !== buildId}`);
    
    // Pastikan buildId valid dan berbeda
    if (!buildId || buildId === last.cs2) {
        console.log('[CS2] Result: No new update (same as stored)');
        return;
    }
    
    console.log('[CS2] Result: NEW UPDATE DETECTED! Sending notification...');
    console.log(`[CS2] Link: ${link}`);
    await sendEmbed({
        title: 'CS2 Update Detected!',
        description: title,
        url: link,
        color: 16766720,
    });
    console.log('[CS2] Notification sent!');
    last.cs2 = buildId;
}
