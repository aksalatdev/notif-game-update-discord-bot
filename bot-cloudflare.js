// ================================
// CONFIG (Updated)
// ================================
// const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1438786471241846855/LH7aQDYD1noDJwlFCpssaSKB8rK_Ca07WQqylcr_q2m6eJwKQh4mbOnBDZjH4BwGYp7e'; MAIN WEBHOOK
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1442501127726825512/AGkXMtYQWBzgeDMdnq37PNPvthIjwggdBZoH1hgQ7IKD3c3kPjqD7Hu6UlHO-v6SRk-0'

const VALORANT_RSS = 'https://www.fragster.com/valorant/feed/';
// Using CORS proxy to bypass Cloudflare protection
const CS2_RSS = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://steamdb.info/api/PatchnotesRSS/?appid=730');
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

async function fetchCS2Items() {
    const advancedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://steamdb.info/',
    };

    try {
        console.log('Fetching CS2 RSS from SteamDB via proxy...');
        const response = await fetch(CS2_RSS, {
            headers: advancedHeaders,
        });
        
        if (!response.ok) {
            console.error(`CS2 RSS fetch failed: ${response.status}`);
            return [];
        }
        
        const xml = await response.text();
        console.log('CS2 RSS fetch successful');
        return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    } catch (error) {
        console.error('CS2 RSS fetch error:', error.message);
        return [];
    }
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
    const items = await fetchValorantItems();

    for (const it of items) {
        const block = it[1];
        const title = decodeHTML(block.match(/<title>(.*?)<\/title>/)?.[1] || '');
        const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';

        if (title.toLowerCase().includes('patch')) {
            console.log('Valorant Check:', {
                lastStored: last.valorant,
                currentTitle: title,
                isNew: last.valorant !== title
            });
            
            if (!title || title === last.valorant) {
                console.log('Valorant: No new patch');
                return;
            }
            
            console.log('Valorant: New patch detected, sending notification');
            const officialLink = generateRiotLink(title) || link;
            await sendEmbed({
                title: 'VALORANT Patch Detected!',
                description: title,
                url: officialLink,
                color: 10526880,
            });
            last.valorant = title;
            return;
        }
    }
    
    console.log('Valorant: No patch found in RSS feed');
}

async function checkCS2(last) {
    const items = await fetchCS2Items();
    
    // Ambil item pertama (update terbaru)
    const firstItem = items[0];
    if (!firstItem) {
        console.log('No CS2 items found');
        return;
    }
    
    const block = firstItem[1];
    const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '';
    
    // Extract BuildID dari guid (format: "build#20897362")
    // Fallback: gunakan title sebagai identifier kalau guid tidak ada build#
    const buildMatch = guid.match(/build#(\d+)/);
    const buildId = buildMatch ? buildMatch[1] : (guid || title);
    
    console.log('CS2 Check:', {
        lastStored: last.cs2,
        currentBuildId: buildId,
        guid: guid,
        title: title,
        isNew: last.cs2 !== buildId
    });
    
    // Pastikan buildId valid dan berbeda
    if (!buildId || buildId === last.cs2) {
        console.log('CS2: No new update');
        return;
    }
    
    console.log('CS2: New update detected, sending notification');
    await sendEmbed({
        title: 'CS2 Update Detected!',
        description: title,
        url: link,
        color: 16766720,
    });
    last.cs2 = buildId;
}
