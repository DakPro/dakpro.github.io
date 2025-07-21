require 'json'
require 'kramdown'

module Jekyll
  class FeedGenerator < Generator
    safe true
    priority :low

    def generate(site)
      # Read projects configuration
      projects_file = File.join(site.source, 'project_feeds', 'projects.json')
      return unless File.exist?(projects_file)
      
      projects = JSON.parse(File.read(projects_file))
      
      projects['projects'].each do |project|
        generate_feed(site, project)
      end
    end

    private

    def generate_feed(site, project)
      project_dir = project['directory']
      feed_entries_file = File.join(site.source, 'project_feeds', project_dir, 'feed_entries.json')
      return unless File.exist?(feed_entries_file)

      feed_config = JSON.parse(File.read(feed_entries_file))
      entries = []

      feed_config['entries'].each do |entry|
        entry_file = File.join(site.source, 'project_feeds', project_dir, entry['source'])
        next unless File.exist?(entry_file)

        content = File.read(entry_file)
        html_content = Kramdown::Document.new(content).to_html

        entries << {
          'title' => entry['title'],
          'content' => html_content,
          'date' => entry['updated'],
          'link' => entry['link'],
          'id' => entry['id']
        }
      end

      # Sort entries by date
      entries.sort_by! { |e| e['date'] }.reverse!

      # Create feed page
      feed = PageWithoutAFile.new(site, site.source, '', "feeds/#{project_dir}.xml")
      feed.content = entries.map { |entry|
        <<~ENTRY
          <entry>
            <title>#{entry['title']}</title>
            <link href="#{entry['link']}"/>
            <id>#{entry['id']}</id>
            <updated>#{entry['date']}</updated>
            <content type="html"><![CDATA[#{entry['content']}]]></content>
          </entry>
        ENTRY
      }.join("\n")

      feed.data.merge!({
        'layout' => 'atom',
        'feed_title' => feed_config['feed']['title'],
        'feed_link' => feed_config['feed']['link'],
        'feed_id' => feed_config['feed']['id'],
        'feed_updated' => entries.first&.dig('date') || Time.now.iso8601,
        'author_name' => feed_config['feed']['author']['name'],
        'author_email' => feed_config['feed']['author']['email']
      })

      site.pages << feed
    end
  end
end 