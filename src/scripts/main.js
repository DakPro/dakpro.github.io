class FeedViewer {
    constructor(containerId) {
        console.log('Initializing FeedViewer...');
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container with id ${containerId} not found`);
        this.container = container;
        this.projects = [];
        this.currentProject = null;
        this.loadProjectFeeds().catch(error => {
            console.error('Failed to load project feeds:', error);
        });
        this.setupAtomFeedLink();
    }

    setupAtomFeedLink() {
        const existingLink = document.getElementById('atomFeedLink');
        if (!existingLink) {
            const linkElement = document.createElement('link');
            linkElement.rel = 'alternate';
            linkElement.type = 'application/atom+xml';
            linkElement.title = 'Atom Feed';
            linkElement.id = 'atomFeedLink';
            document.head.appendChild(linkElement);
        }
    }

    updateAtomFeedLink() {
        if (this.currentProject) {
            const linkElement = document.getElementById('atomFeedLink');
            if (linkElement) {
                linkElement.href = `project_feeds/${this.currentProject.directory}/feed.xml`;
                linkElement.title = `${this.currentProject.name} Atom Feed`;
            }
        }
    }

    async loadProjectFeeds() {
        try {
            const response = await fetch('project_feeds/projects.json');
            if (!response.ok) throw new Error(`Failed to load projects: ${response.status} ${response.statusText}`);
            const data = await response.json();
            
            for (const project of data.projects) {
                try {
                    console.log(`Loading config for project ${project.name}...`);
                    const feedEntriesInfo = await fetch(`project_feeds/${project.directory}/feed_entries.json`);
                    if (!feedEntriesInfo.ok) {
                        throw new Error(`Failed to load feed configuration: ${feedEntriesInfo.status} ${feedEntriesInfo.statusText}`);
                    }
                    const feedEntriesInfoJson = await feedEntriesInfo.json();
                    const feedsEntriesJson = await this.loadEntries(project.directory, feedEntriesInfoJson);
                    if (feedsEntriesJson.length > 0) {
                        this.addProject(project.name, feedsEntriesJson, project.directory, feedEntriesInfoJson);
                        await this.generateAtomFeed(project.directory, feedEntriesInfoJson, feedsEntriesJson);
                    } else {
                        console.warn(`No entries found for project ${project.name}`);
                    }
                } catch (error) {
                    console.error(`Failed to load project ${project.name}:`, error);
                    continue;
                }
            }

            if (this.projects.length === 0) {
                console.warn('No projects loaded');
                this.container.innerHTML = `
                    <div class="error">
                        No entries found in project directories.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.container.innerHTML = `
                <div class="error">
                    ${error instanceof Error ? error.message : 'Unknown error'}
                </div>
            `;
        }
    }

    async loadEntries(projectDir, feedEntriesInfoJson) {
        const entries = [];
        for (const entry of feedEntriesInfoJson.entries) {
            try {
                const response = await fetch(`project_feeds/${projectDir}/${entry.source}`);
                if (!response.ok) {
                    continue;
                }
                const content = await response.text();
                entries.push({
                    title: entry.title,
                    content: this.markdownToHtml(content, projectDir),
                    date: entry.updated,
                    link: entry.link,
                    id: entry.id
                });
            } catch (error) {
                console.error(`Failed to load ${entry.source}:`, error);
            }
        }
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    async generateAtomFeed(projectDir, feedEntriesInfoJson, entries) {
        const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>${feedEntriesInfoJson.feed.title}</title>
    <link href="${feedEntriesInfoJson.feed.link}"/>
    <updated>${entries[0]?.date || new Date().toISOString()}</updated>
    <author>
        <name>${feedEntriesInfoJson.feed.author.name}</name>
        ${feedEntriesInfoJson.feed.author.email ? `<email>${feedEntriesInfoJson.feed.author.email}</email>` : ''}
    </author>
    <id>${feedEntriesInfoJson.feed.id}</id>

    ${entries.map(entry => `
    <entry>
        <title>${entry.title}</title>
        <link href="${entry.link}"/>
        <id>${entry.id}</id>
        <updated>${entry.date}</updated>
        <content type="html"><![CDATA[${entry.content}]]></content>
    </entry>
    `).join('\n')}
</feed>`;

        console.log(`Generated Atom feed for ${projectDir}`);
        console.log('--------------------------------');
        console.log('feedEntriesInfoJson given:', feedEntriesInfoJson);
        console.log('--------------------------------');
        console.log('entries given:', entries);
        console.log('--------------------------------');
        console.log('Atom feed generated:', atomXml);
        console.log('--------------------------------');
        console.log('--------------------------------');
    }

    markdownToHtml(markdownText, projectDir) {
        let htmlText = markdownText
            // Convert headers
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            // Convert lists
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/^[0-9]+\. (.*$)/gm, '<li>$1</li>')
            // Convert code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Convert inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Convert paragraphs (but not empty lines)
            .replace(/^(?!<[h|l|p|u|c])(.*[^\s].*)$/gm, '<p>$1</p>')
            // Fix image paths
            .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
                const imagePath = src.startsWith('http') ? src : `project_feeds/${projectDir}/${src}`;
                return `<img src="${imagePath}" alt="${alt}">`;
            })
            // Convert links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            // Convert emphasis
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Convert blockquotes
            .replace(/^>(.*$)/gm, '<blockquote>$1</blockquote>');

        // html = html.replace(/<li>.*?<\/li>\n*/gs, match => {
        //     if (match.includes('1.')) {
        //         return `<ol>${match}</ol>`;
        //     }
        //     return `<ul>${match}</ul>`;
        // });

        return htmlText;
    }

    addProject(name, entries, directory, feedEntriesInfo) {
        console.log(`Adding project ${name} with ${entries.length} entries`);
        this.projects.push({ name, entries, directory, config: feedEntriesInfo });
        this.updateTabs();
    }

    updateTabs() {
        console.log('Updating tabs...');
        const tabNav = this.container.querySelector('.tab-navigation') || this.createTabNavigation();
        tabNav.innerHTML = '';
        
        this.projects.forEach(project => {
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.textContent = project.name;
            tab.onclick = () => this.displayProject(project);
            
            if (this.currentProject?.name === project.name) {
                tab.classList.add('active');
            }
            
            tabNav.appendChild(tab);
        });

        if (this.projects.length > 0 && !this.currentProject) {
            console.log('No current project, displaying first project');
            this.displayProject(this.projects[0]);
        }
    }

    createTabNavigation() {
        console.log('Creating tab navigation');
        const tabNav = document.createElement('div');
        tabNav.className = 'tab-navigation';
        this.container.insertBefore(tabNav, this.container.firstChild);
        return tabNav;
    }

    displayProject(project) {
        console.log(`Displaying project ${project.name}`);
        this.currentProject = project;
        this.updateTabs();
        this.updateAtomFeedLink();
        
        const feedContainer = this.container.querySelector('.feed-container') || this.createFeedContainer();
        
        if (project.entries.length === 0) {
            feedContainer.innerHTML = '<div class="error">No entries found</div>';
            return;
        }

        feedContainer.innerHTML = `
            <div class="feed-header">
                <h1>${project.config.feed.title}</h1>
                <p>Subscribe via <a href="project_feeds/${project.directory}/feed.xml">Atom feed</a></p>
            </div>
            ${project.entries.map(entry => `
                <article class="feed-item">
                    <h2><a href="${entry.link}">${entry.title}</a></h2>
                    <div class="meta">
                        Last updated: ${new Date(entry.date).toLocaleDateString()}
                    </div>
                    <div class="content">${entry.content}</div>
                </article>
            `).join('')}
        `;
    }

    createFeedContainer() {
        console.log('Creating feed container');
        const feedContainer = document.createElement('div');
        feedContainer.className = 'feed-container';
        this.container.appendChild(feedContainer);
        return feedContainer;
    }
}

// Initialize the feed viewer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing FeedViewer');
    const viewer = new FeedViewer('feed-viewer');
}); 