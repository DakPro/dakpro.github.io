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
            // Fetch the list of project directories
            const response = await fetch('project_feeds/');
            if (!response.ok) throw new Error('Failed to load projects:' + response.statusText);
            const text = await response.text();
            
            // Create a temporary element to parse the directory listing
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;
            
            // Find all directory links (they end with /)
            const projectDirs = Array.from(tempDiv.querySelectorAll('a'))
                .filter(a => a.href.endsWith('/'))
                .map(a => a.textContent.replace('/', ''));

            // Add each project that has a feed file (either .xml or .atom)
            for (const projectName of projectDirs) {
                const feedUrls = [
                    `project_feeds/${projectName}/feed.xml`,
                    `project_feeds/${projectName}/feed.atom`
                ];
                
                // Try both possible feed files
                for (const feedUrl of feedUrls) {
                    try {
                        const feedResponse = await fetch(feedUrl, { method: 'HEAD' });
                        if (feedResponse.ok) {
                            this.addProject(projectName, feedUrl);
                            break; // Stop after finding the first valid feed
                        }
                    } catch (error) {
                        continue; // Try next file if this one fails
                    }
                }
            }
        } catch (error) {
            this.container.innerHTML = `
                <div class="error">
                    Failed to load projects: ${error.message || 'Unknown error'}
                </div>
            `;
        }
    }

    addProject(name, feedUrl) {
        this.projects.push({ name, feedUrl });
        this.updateTabs();
    }

    updateTabs() {
        const tabNav = this.container.querySelector('.tab-navigation') || this.createTabNavigation();
        tabNav.innerHTML = '';
        
        this.projects.forEach(project => {
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.textContent = project.name;
            tab.onclick = () => this.loadProject(project);
            
            if (this.currentProject?.name === project.name) {
                tab.classList.add('active');
            }
            
            tabNav.appendChild(tab);
        });

        // If we have projects but none selected, select the first one
        if (this.projects.length > 0 && !this.currentProject) {
            this.loadProject(this.projects[0]);
        }
    }

    createTabNavigation() {
        const tabNav = document.createElement('div');
        tabNav.className = 'tab-navigation';
        this.container.insertBefore(tabNav, this.container.firstChild);
        return tabNav;
    }

    async loadProject(project) {
        this.currentProject = project;
        this.updateTabs();
        
        const feedContainer = this.container.querySelector('.feed-container') || this.createFeedContainer();
        feedContainer.innerHTML = '<div class="loading">Loading feed...</div>';

        try {
            const response = await fetch(project.feedUrl);
            if (!response.ok) throw new Error('Failed to fetch feed');
            
            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'application/xml');
            
            const items = this.parseAtomFeed(xml);
            this.displayFeedItems(items, feedContainer);
        } catch (error) {
            feedContainer.innerHTML = `
                <div class="error">
                    Failed to load feed: ${error.message || 'Unknown error'}
                </div>
            `;
        }
    }

    createFeedContainer() {
        const feedContainer = document.createElement('div');
        feedContainer.className = 'feed-container';
        this.container.appendChild(feedContainer);
        return feedContainer;
    }

    parseAtomFeed(xml) {
        const entries = Array.from(xml.getElementsByTagName('entry'));
        
        return entries.map(entry => ({
            title: entry.querySelector('title')?.textContent || 'Untitled',
            link: entry.querySelector('link')?.getAttribute('href') || '#',
            id: entry.querySelector('id')?.textContent || '',
            updated: entry.querySelector('updated')?.textContent || '',
            content: entry.querySelector('content')?.textContent || '',
            author: {
                name: entry.querySelector('author name')?.textContent || 'Unknown',
                email: entry.querySelector('author email')?.textContent
            }
        }));
    }

    displayFeedItems(items, container) {
        if (items.length === 0) {
            container.innerHTML = '<div class="error">No items found in feed</div>';
            return;
        }

        container.innerHTML = items.map(item => `
            <article class="feed-item">
                <h2><a href="${item.link}">${item.title}</a></h2>
                <div class="meta">
                    By ${item.author?.name || 'Unknown'} • 
                    ${new Date(item.updated).toLocaleDateString()}
                </div>
                <div class="content">${item.content}</div>
            </article>
        `).join('');
    }
}

// Initialize the feed viewer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const viewer = new FeedViewer('feed-viewer');
}); 