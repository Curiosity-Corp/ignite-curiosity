import os
import re

project_root = "C:\\Users\\AbdulRehman\\Desktop\\curiosity\\curiosity"
all_html_files = []
for root, _, files in os.walk(project_root):
    for file in files:
        if file.endswith(".html"):
            all_html_files.append(os.path.join(root, file))

broken_links = {}
linked_files = set()

for html_file_path in all_html_files:
    with open(html_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all href attributes
    hrefs = re.findall(r'href=["\']([^"\']*)["\']', content)

    for href in hrefs:
        if href.startswith("http://") or href.startswith("https://") or href.startswith("#") or href.startswith("mailto:"):
            # Ignore external links, anchors, and mailto links
            continue

        # Resolve relative paths
        if href.startswith("/"):
            # Absolute path from root
            target_path = os.path.join(project_root, href[1:])
        else:
            # Relative path from current file
            current_dir = os.path.dirname(html_file_path)
            target_path = os.path.abspath(os.path.join(current_dir, href))

        # Normalize path to be within project_root
        if not target_path.startswith(project_root):
            # This handles cases where relative paths might go outside the project root
            # For example, if href was "../../../some_file.html"
            common_prefix = os.path.commonpath([project_root, target_path])
            if common_prefix != project_root:
                # Link points outside the project, consider it external or invalid for this check
                continue

        # Check if the target file exists and is an HTML file
        if target_path.endswith(".html"):
            if not os.path.exists(target_path):
                if html_file_path not in broken_links:
                    broken_links[html_file_path] = []
                broken_links[html_file_path].append(href)
            else:
                linked_files.add(target_path)

unlinked_html_files = []
for html_file_path in all_html_files:
    if html_file_path not in linked_files and html_file_path != os.path.join(project_root, "index.html"):
        # Exclude index.html from unlinked files as it's the entry point
        unlinked_html_files.append(html_file_path)

print("Broken Links:")
if broken_links:
    for file, links in broken_links.items():
        print(f"  From {file}:")
        for link in links:
            print(f"    - {link}")
else:
    print("  None found.")

print("\nUnlinked HTML Files (excluding index.html):")
if unlinked_html_files:
    for file in unlinked_html_files:
        print(f"  - {file}")
else:
    print("  None found.")
