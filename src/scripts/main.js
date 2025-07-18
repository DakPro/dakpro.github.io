class FeedViewer {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container with id ${containerId} not found`);
        this.container = container;
        this.projects = [];
        this.loadProjectFeeds();
    }

    async loadProjectFeeds() {
        try {
            const response = await fetch('project_feeds/projects.json');
            if (!response.ok) throw new Error('Failed to load projects: ' + response.statusText);
            const data = await response.json();
            
            for (const project of data.projects) {
                try {
                    // Try to load the markdown files first
                    const mdFiles = await this.getMarkdownFiles(project.directory);
                    if (mdFiles.length > 0) {
                        // Create feed entries from markdown files
                        const entries = await this.createEntriesFromMarkdown(project.directory, mdFiles);
                        this.addProject(project.name, entries, project.directory);
                    } else {
                        // Fallback to existing feed file if no markdown files found
                        const feedUrls = [
                            `project_feeds/${project.directory}/feed.xml`,
                            `project_feeds/${project.directory}/feed.atom`
                        ];
                        
                        for (const feedUrl of feedUrls) {
                            const feedResponse = await fetch(feedUrl, { method: 'HEAD' });
                            if (feedResponse.ok) {
                                const feedContent = await this.loadFeedFile(feedUrl);
                                this.addProject(project.name, feedContent, project.directory);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to load project ${project.name}:`, error);
                    continue;
                }
            }

            if (this.projects.length === 0) {
                this.container.innerHTML = `
                    <div class="error">
                        No project feeds or markdown files found.
                    </div>
                `;
            }
        } catch (error) {
            this.container.innerHTML = `
                <div class="error">
                    ${error.message}
                </div>
            `;
        }
    }

    async getMarkdownFiles(projectDir) {
        try {
            // Try to fetch the directory listing (this might not work on all servers)
            const response = await fetch(`project_feeds/${projectDir}/`);
            const text = await response.text();
            
            // Parse HTML directory listing
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            // Find all markdown files
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.endsWith('.md'))
                .map(href => href.split('/').pop());
        } catch (error) {
            console.warn('Failed to get directory listing, trying known files');
            // Fallback: try to fetch specific files we know might exist
            const knownFiles = ['week1.md', 'week2.md', 'week3.md'];
            const existingFiles = [];
            
            for (const file of knownFiles) {
                try {
                    const response = await fetch(`project_feeds/${projectDir}/${file}`, { method: 'HEAD' });
                    if (response.ok) {
                        existingFiles.push(file);
                    }
                } catch (error) {
                    continue;
                }
            }
            
            return existingFiles;
        }
    }

    async createEntriesFromMarkdown(projectDir, mdFiles) {
        const entries = [];
        
        for (const file of mdFiles) {
            try {
                const response = await fetch(`project_feeds/${projectDir}/${file}`);
                if (!response.ok) continue;
                
                const content = await response.text();
                const title = this.extractTitle(content) || file.replace('.md', '');
                const date = await this.getFileDate(projectDir, file);
                
                entries.push({
                    title,
                    content,
                    date,
                    link: `https://dakpro.github.io/${projectDir}/${file.replace('.md', '')}`,
                    id: `urn:uuid:${this.generateUUID()}`,
                });
            } catch (error) {
                console.warn(`Failed to load ${file}:`, error);
            }
        }
        
        // Sort entries by date, newest first
        return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    extractTitle(markdown) {
        // Look for the first # heading
        const match = markdown.match(/^#\s+(.+)$/m);
        return match ? match[1] : null;
    }

    async getFileDate(projectDir, file) {
        try {
            // Try to get the file's last modified date
            const response = await fetch(`project_feeds/${projectDir}/${file}`);
            const lastModified = response.headers.get('last-modified');
            return lastModified || new Date().toISOString();
        } catch (error) {
            return new Date().toISOString();
        }
    }

    generateUUID() {
        // Simple UUID v4 generation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async loadFeedFile(feedUrl) {
        const response = await fetch(feedUrl);
        if (!response.ok) throw new Error('Failed to fetch feed');
        
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');
        
        return Array.from(xml.getElementsByTagName('entry')).map(entry => ({
            title: entry.querySelector('title')?.textContent || 'Untitled',
            content: entry.querySelector('content')?.textContent || '',
            date: entry.querySelector('updated')?.textContent || new Date().toISOString(),
            link: entry.querySelector('link')?.getAttribute('href') || '#',
            id: entry.querySelector('id')?.textContent || `urn:uuid:${this.generateUUID()}`,
        }));
    }

    addProject(name, entries, directory) {
        this.projects.push({ name, entries, directory });
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

    createTabNavigation() {
        const tabNav = document.createElement('div');
        tabNav.className = 'tab-navigation';
        this.container.insertBefore(tabNav, this.container.firstChild);
        return tabNav;
    }

    displayProject(project) {
        this.currentProject = project;
        this.updateTabs();
        
        const feedContainer = this.container.querySelector('.feed-container') || this.createFeedContainer();
        
        if (project.entries.length === 0) {
            feedContainer.innerHTML = '<div class="error">No entries found</div>';
            return;
        }

        feedContainer.innerHTML = project.entries.map(entry => {
            // Fix image paths in the content to be relative to the project directory
            let content = entry.content.replace(
                /!\[(.*?)\]\((.*?)\)/g, 
                (match, alt, src) => `![${alt}](project_feeds/${project.directory}/${src})`
            );
            
            return `
                <article class="feed-item">
                    <h2><a href="${entry.link}">${entry.title}</a></h2>
                    <div class="meta">
                        Last updated: ${new Date(entry.date).toLocaleDateString()}
                    </div>
                    <div class="content">${content}</div>
                </article>
            `;
        }).join('');
    }

    createFeedContainer() {
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