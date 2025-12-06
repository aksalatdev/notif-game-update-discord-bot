// ================================
// CONFIG (Updated)
// ================================
// const DISCORD_WEBHOOK = ''; MAIN WEBHOOK
const DISCORD_WEBHOOK = 'ur-webook';
const LOG_WEBHOOK = '-';

// Using CORS proxy to bypass Cloudflare protection (with fallbacks)
const GAMERIV_RSS_URL = 'https://gameriv.com/valorant/feed/';
const VALORANT_PROXIES = [
    GAMERIV_RSS_URL, // Try direct first
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(GAMERIV_RSS_URL),
    'https://corsproxy.io/?' + encodeURIComponent(GAMERIV_RSS_URL),
];

const STEAMDB_RSS_URL = 'https://steamdb.info/api/PatchnotesRSS/?appid=730';
const CS2_PROXIES = [
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(STEAMDB_RSS_URL),
    'https://corsproxy.io/?' + encodeURIComponent(STEAMDB_RSS_URL),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(STEAMDB_RSS_URL),
];

// Regex untuk detect VALORANT patch - match "VALORANT Patch 11.11" atau "VALORANT Patch Notes 11.10"
const VALORANT_PATCH_REGEX = /VALORANT Patch (Notes )?(\d+\.\d+)/i;
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
    // Extract version dari title (misal: "VALORANT Patch Notes 11.10" atau "VALORANT Patch 11.11")
    const versionMatch = title.match(/VALORANT Patch (Notes )?(\d+\.\d+[a-z]?)/i);
    if (!versionMatch) return null;

    const version = versionMatch[2].replace('.', '-'); // 11.10 → 11-10
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

// Store last successful proxy for logging
let lastSuccessfulValorantProxy = null;

async function fetchValorantItems() {
    const advancedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://gameriv.com/',
        'Origin': 'https://gameriv.com',
    };

    // Try each proxy until one works
    for (let i = 0; i < VALORANT_PROXIES.length; i++) {
        const proxyUrl = VALORANT_PROXIES[i];
        const proxyName = ['direct', 'allorigins', 'corsproxy.io'][i];
        
        try {
            console.log(`[VALORANT] Trying: ${proxyName}...`);
            const response = await fetch(proxyUrl, {
                headers: advancedHeaders,
            });
            
            if (!response.ok) {
                console.error(`[VALORANT] ${proxyName} failed with status: ${response.status}`);
                continue;
            }
            
            const xml = await response.text();
            
            // Validate response contains RSS data
            if (!xml.includes('<item>')) {
                console.error(`[VALORANT] ${proxyName} returned invalid data (no <item> found)`);
                continue;
            }
            
            const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
            lastSuccessfulValorantProxy = proxyName;
            console.log(`[VALORANT] SUCCESS via ${proxyName} - fetched ${items.length} items`);
            return items;
        } catch (error) {
            console.error(`[VALORANT] ${proxyName} error: ${error.message}`);
            continue;
        }
    }
    
    lastSuccessfulValorantProxy = null;
    console.error('[VALORANT] All sources failed!');
    return [];
}

function getLastSuccessfulValorantProxy() {
    return lastSuccessfulValorantProxy;
}

// Store last successful proxy for CS2 logging
let lastSuccessfulCS2Proxy = null;

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
            lastSuccessfulCS2Proxy = proxyName;
            console.log(`[CS2] SUCCESS via ${proxyName} - fetched ${items.length} items`);
            return items;
        } catch (error) {
            console.error(`[CS2] ${proxyName} error: ${error.message}`);
            continue; // Try next proxy
        }
    }
    
    lastSuccessfulCS2Proxy = null;
    console.error('[CS2] All proxies failed!');
    return [];
}

function getLastSuccessfulCS2Proxy() {
    return lastSuccessfulCS2Proxy;
}

// ================================
// SEND LOG TO DISCORD
// ================================
async function sendLog(logData) {
    const { valorantResult, cs2Result, errors } = logData;
    
    const valorantStatus = valorantResult.success 
        ? (valorantResult.newPatch ? `🆕 NEW: ${valorantResult.version}` : `✅ ${valorantResult.version}`)
        : `❌ Failed (${valorantResult.error})`;
    
    const cs2Status = cs2Result.success
        ? (cs2Result.newUpdate ? `🆕 NEW: ${cs2Result.buildId}` : `✅ ${cs2Result.buildId}`)
        : `❌ Failed (${cs2Result.error})`;

    const embed = {
        title: '🤖 Cron Run Complete',
        color: errors.length > 0 ? 16711680 : 5763719, // Red if errors, green if OK
        fields: [
            {
                name: 'VALORANT',
                value: `${valorantStatus}\nProxy: ${valorantResult.proxy || 'N/A'}`,
                inline: true
            },
            {
                name: 'CS2',
                value: `${cs2Status}\nProxy: ${cs2Result.proxy || 'N/A'}`,
                inline: true
            }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Azar PatchBot Log' }
    };

    if (errors.length > 0) {
        embed.fields.push({
            name: '⚠️ Errors',
            value: errors.join('\n').substring(0, 1000),
            inline: false
        });
    }

    await fetch(LOG_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
    });
}

// ================================
// MAIN WORKER
// ================================
export default {
    async scheduled(event, env, ctx) {
        console.log('=== SCHEDULED RUN START ===');
        
        const logData = {
            valorantResult: { success: false, version: null, proxy: null, newPatch: false, error: null },
            cs2Result: { success: false, buildId: null, proxy: null, newUpdate: false, error: null },
            errors: []
        };
        
        // Cek apakah KV tersedia
        if (!env.PATCH_KV) {
            console.error('CRITICAL: PATCH_KV is not bound!');
            logData.errors.push('KV not bound!');
            await sendLog(logData);
            return;
        }
        
        let last = {};
        try {
            last = (await env.PATCH_KV.get(KV_KEY, 'json')) || {};
            console.log('Current state loaded:', JSON.stringify(last));
        } catch (kvReadError) {
            console.error('Failed to read from KV:', kvReadError);
            logData.errors.push(`KV read error: ${kvReadError.message}`);
        }

        try {
            const result = await checkValorant(last);
            logData.valorantResult = result;
        } catch (e) {
            console.error('Valorant error:', e);
            logData.valorantResult.error = e.message;
            logData.errors.push(`Valorant: ${e.message}`);
        }

        try {
            const result = await checkCS2(last);
            logData.cs2Result = result;
        } catch (e) {
            console.error('CS2 error:', e);
            logData.cs2Result.error = e.message;
            logData.errors.push(`CS2: ${e.message}`);
        }

        console.log('Attempting to save state:', JSON.stringify(last));
        try {
            await env.PATCH_KV.put(KV_KEY, JSON.stringify(last));
            
            // Verify save
            const verify = await env.PATCH_KV.get(KV_KEY, 'json');
            console.log('State saved and verified:', JSON.stringify(verify));
        } catch (kvError) {
            console.error('CRITICAL: Failed to save to KV:', kvError);
            logData.errors.push(`KV save error: ${kvError.message}`);
        }
        
        // Send log to Discord
        await sendLog(logData);
        
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

                // Pakai regex baru untuk detect patch
                const patchMatch = title.match(VALORANT_PATCH_REGEX);
                if (patchMatch) {
                    const version = patchMatch[2];
                    if (path.endsWith('/send')) {
                        const officialLink = generateRiotLink(title) || link;
                        await sendEmbed({
                            title: '🧪 [TEST] VALORANT Patch Detected!',
                            description: `**[TEST MODE]**\nPatch ${version}\n${title}`,
                            url: officialLink,
                            color: 10526880,
                        });
                        return new Response('Test patch sent!');
                    }
                    return new Response(`PATCH FOUND:\nVersion: ${version}\nTitle: ${title}\nLink: ${link}`);
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
    const result = {
        success: false,
        version: last.valorant || null,
        proxy: null,
        newPatch: false,
        error: null
    };
    
    const items = await fetchValorantItems();
    const proxyUsed = getLastSuccessfulValorantProxy();
    result.proxy = proxyUsed || 'all failed';
    console.log(`[VALORANT] Proxy used: ${proxyUsed || 'none (all failed)'}`);

    if (items.length === 0) {
        console.log('[VALORANT] Result: No items found (fetch failed)');
        result.error = 'fetch failed';
        return result;
    }

    // Loop semua items untuk cari patch notes
    for (const it of items) {
        const block = it[1];
        const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
        const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';

        // Match dengan regex: "VALORANT Patch 11.11" atau "VALORANT Patch Notes 11.10"
        const patchMatch = title.match(VALORANT_PATCH_REGEX);
        
        if (patchMatch) {
            const version = patchMatch[2]; // Extract version number (e.g., "11.11")
            result.version = version;
            result.success = true;
            
            console.log('[VALORANT] --- PATCH CHECK ---');
            console.log(`[VALORANT] Found patch article: "${title}"`);
            console.log(`[VALORANT] Extracted version: ${version}`);
            console.log(`[VALORANT] Stored version: "${last.valorant || 'none'}"`);
            console.log(`[VALORANT] Is new: ${last.valorant !== version}`);
            
            if (!version || version === last.valorant) {
                console.log('[VALORANT] Result: No new patch (same version as stored)');
                return result;
            }
            
            console.log('[VALORANT] Result: NEW PATCH DETECTED! Sending notification...');
            const officialLink = generateRiotLink(title) || link;
            console.log(`[VALORANT] Official link: ${officialLink}`);
            await sendEmbed({
                title: 'VALORANT Patch Detected!',
                description: `Patch ${version}\n${title}`,
                url: officialLink,
                color: 10526880,
            });
            console.log('[VALORANT] Notification sent!');
            result.newPatch = true;
            last.valorant = version; // Simpan version number, bukan full title
            return result;
        }
    }
    
    console.log('[VALORANT] Result: No patch notes found in RSS feed');
    result.success = true; // Fetch berhasil, tapi ga ada patch
    result.error = 'no patch in feed';
    return result;
}

async function checkCS2(last) {
    const result = {
        success: false,
        buildId: last.cs2 || null,
        proxy: null,
        newUpdate: false,
        error: null
    };
    
    const items = await fetchCS2Items();
    const proxyUsed = getLastSuccessfulCS2Proxy();
    result.proxy = proxyUsed || 'all failed';
    console.log(`[CS2] Proxy used: ${proxyUsed || 'none (all failed)'}`);
    
    // Ambil item pertama (update terbaru)
    const firstItem = items[0];
    if (!firstItem) {
        console.log('[CS2] Result: No items found (fetch failed)');
        result.error = 'fetch failed';
        return result;
    }
    
    const block = firstItem[1];
    const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
    
    // Extract BuildID dari guid (format: "build#20897362")
    const buildMatch = guid.match(/build#(\d+)/);
    const buildId = buildMatch ? buildMatch[1] : (guid || title);
    result.buildId = buildId;
    result.success = true;
    
    console.log('[CS2] --- BUILD CHECK ---');
    console.log(`[CS2] Current build ID: ${buildId}`);
    console.log(`[CS2] Current title: "${title}"`);
    console.log(`[CS2] Current GUID: ${guid}`);
    console.log(`[CS2] Stored build ID: "${last.cs2 || 'none'}"`);
    console.log(`[CS2] Is new: ${last.cs2 !== buildId}`);
    
    // Pastikan buildId valid dan berbeda
    if (!buildId || buildId === last.cs2) {
        console.log('[CS2] Result: No new update (same as stored)');
        return result;
    }
    
    console.log('[CS2] Result: NEW UPDATE DETECTED! Sending notification...');
    console.log(`[CS2] Link: ${link}`);
    result.newUpdate = true;
    await sendEmbed({
        title: 'CS2 Update Detected!',
        description: title,
        url: link,
        color: 16766720,
    });
    console.log('[CS2] Notification sent!');
    last.cs2 = buildId;
    return result;
}
