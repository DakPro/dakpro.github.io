interface FeedConfig {
    feed: {
        title: string;
        author: {
            name: string;
            email?: string;
        };
        id: string;
        link: string;
    };
    entries: Array<{
        title: string;
        id: string;
        updated: string;
        source: string;
        link: string;
    }>;
}

interface FeedEntry {
    title: string;
    content: string;
    date: string;
    link: string;
    id: string;
}

class FeedViewer {
    private container: HTMLElement;
    private projects: Array<{
        name: string;
        entries: FeedEntry[];
        directory: string;
        config: FeedConfig;
    }>;
    private currentProject: {
        name: string;
        entries: FeedEntry[];
        directory: string;
        config: FeedConfig;
    } | null;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container with id ${containerId} not found`);
        this.container = container;
        this.projects = [];
        this.currentProject = null;
        this.loadProjectFeeds();
        this.setupAtomFeedLink();
    }

    private setupAtomFeedLink() {
        // Add Atom feed link to the head
        const linkElement = document.createElement('link');
        linkElement.rel = 'alternate';
        linkElement.type = 'application/atom+xml';
        linkElement.title = 'Atom Feed';
        linkElement.id = 'atomFeedLink';
        document.head.appendChild(linkElement);
    }

    private updateAtomFeedLink() {
        if (this.currentProject) {
            const linkElement = document.getElementById('atomFeedLink') as HTMLLinkElement;
            if (linkElement) {
                linkElement.href = `project_feeds/${this.currentProject.directory}/feed.xml`;
                linkElement.title = `${this.currentProject.name} Atom Feed`;
            }
        }
    }

    async loadProjectFeeds() {
        try {
            const response = await fetch('project_feeds/projects.json');
            if (!response.ok) throw new Error('Failed to load projects');
            const data = await response.json();
            
            for (const project of data.projects) {
                try {
                    const configResponse = await fetch(`project_feeds/${project.directory}/feed_entries.json`);
                    if (!configResponse.ok) throw new Error('Failed to load feed configuration');
                    const config: FeedConfig = await configResponse.json();

                    const entries = await this.loadEntries(project.directory, config);
                    if (entries.length > 0) {
                        this.addProject(project.name, entries, project.directory, config);
                        await this.generateAtomFeed(project.directory, config, entries);
                    }
                } catch (error) {
                    console.warn(`Failed to load project ${project.name}:`, error);
                    continue;
                }
            }

            if (this.projects.length === 0) {
                this.container.innerHTML = `
                    <div class="error">
                        No entries found in project directories.
                    </div>
                `;
            }
        } catch (error) {
            this.container.innerHTML = `
                <div class="error">
                    ${error instanceof Error ? error.message : 'Unknown error'}
                </div>
            `;
        }
    }

    async loadEntries(projectDir: string, config: FeedConfig): Promise<FeedEntry[]> {
        const entries: FeedEntry[] = [];
        
        for (const entry of config.entries) {
            try {
                const response = await fetch(`project_feeds/${projectDir}/${entry.source}`);
                if (!response.ok) continue;
                
                const content = await response.text();
                entries.push({
                    title: entry.title,
                    content: this.markdownToHtml(content, projectDir),
                    date: entry.updated,
                    link: entry.link,
                    id: entry.id
                });
            } catch (error) {
                console.warn(`Failed to load ${entry.source}:`, error);
            }
        }
        
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    async generateAtomFeed(projectDir: string, config: FeedConfig, entries: FeedEntry[]) {
        const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>${config.feed.title}</title>
    <link href="${config.feed.link}"/>
    <updated>${entries[0]?.date || new Date().toISOString()}</updated>
    <author>
        <name>${config.feed.author.name}</name>
        ${config.feed.author.email ? `<email>${config.feed.author.email}</email>` : ''}
    </author>
    <id>${config.feed.id}</id>

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

        // In a real setup, you would save this to feed.xml
        // For now, we'll just log it
        console.log('Generated Atom feed:', atomXml);
    }

    markdownToHtml(markdown: string, projectDir: string): string {
        let html = markdown
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
            // Convert paragraphs
            .replace(/^(?!<[h|l|p|u|c])(.*$)/gm, '<p>$1</p>')
            // Fix image paths
            .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
                const imagePath = src.startsWith('http') ? src : `project_feeds/${projectDir}/${src}`;
                return `<img src="${imagePath}" alt="${alt}">`;
            })
            // Convert links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            // Convert emphasis
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Wrap lists in ul/ol tags
        html = html.replace(/<li>.*?<\/li>/gs, match => {
            if (match.includes('1.')) {
                return `<ol>${match}</ol>`;
            }
            return `<ul>${match}</ul>`;
        });

        return html;
    }

    addProject(name: string, entries: FeedEntry[], directory: string, config: FeedConfig) {
        this.projects.push({ name, entries, directory, config });
        this.updateTabs();
    }

    updateTabs() {
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
            this.displayProject(this.projects[0]);
        }
    }

    createTabNavigation(): HTMLElement {
        const tabNav = document.createElement('div');
        tabNav.className = 'tab-navigation';
        this.container.insertBefore(tabNav, this.container.firstChild);
        return tabNav;
    }

    displayProject(project: { name: string; entries: FeedEntry[]; directory: string; config: FeedConfig }) {
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

    createFeedContainer(): HTMLElement {
        const feedContainer = document.createElement('div');
        feedContainer.className = 'feed-container';
        this.container.appendChild(feedContainer);
        return feedContainer;
    }
}

// Initialize the feed viewer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const viewer = new FeedViewer('feed-viewer');
}); 