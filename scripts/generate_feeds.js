const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');

async function generateFeedForProject(projectDir) {
    console.log(`Processing ${projectDir}...`);
    
    // Read feed configuration
    const feedConfigPath = path.join('project_feeds', projectDir, 'feed_entries.json');
    const feedConfig = JSON.parse(await fs.readFile(feedConfigPath, 'utf8'));
    
    // Process entries
    const entries = [];
    for (const entry of feedConfig.entries) {
        const mdPath = path.join('project_feeds', projectDir, entry.source);
        const mdContent = await fs.readFile(mdPath, 'utf8');
        const htmlContent = marked.parse(mdContent);
        
        entries.push({
            title: entry.title,
            content: htmlContent,
            date: entry.updated,
            link: entry.link,
            id: entry.id
        });
    }
    
    // Sort by date (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Generate Atom XML
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>${feedConfig.feed.title}</title>
    <link href="${feedConfig.feed.link}"/>
    <id>${feedConfig.feed.id}</id>
    <updated>${entries[0]?.date || new Date().toISOString()}</updated>
    <author>
        <name>${feedConfig.feed.author.name}</name>
        ${feedConfig.feed.author.email ? `<email>${feedConfig.feed.author.email}</email>` : ''}
    </author>
    ${entries.map(entry => `
    <entry>
        <title>${entry.title}</title>
        <link href="${entry.link}"/>
        <id>${entry.id}</id>
        <updated>${entry.date}</updated>
        <content type="html"><![CDATA[${entry.content}]]></content>
    </entry>`).join('\n')}
</feed>`;
    
    // Write the feed file
    const outputPath = path.join('project_feeds', projectDir, 'feed.xml');
    await fs.writeFile(outputPath, atomXml);
    console.log(`Generated ${outputPath}`);
}

async function main() {
    try {
        // Get project directory from command line argument
        const projectDir = process.argv[2];
        if (!projectDir) {
            console.error('Please provide a project directory name');
            console.error('Usage: node generate_feeds.js <project-dir>');
            process.exit(1);
        }
        
        await generateFeedForProject(projectDir);
        console.log('Done!');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main(); 