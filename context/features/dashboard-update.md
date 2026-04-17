# Dashboard UI Phase 3 Spec

## Overview

This feature is for the /dashboard and /items/* UI layout.

## Requirements

- 4 stats cards at the top for number of items, collections, favorite items and favorite collections for the dashboard(/dashboard)

/items/command -- Card Grid Layout  include createdAt date to current display
/items/file -- Card Grid Layout include image if the url ends with an image extension if not use context/screenshots/default_bg.jpg as the default image thumbnail. 
/items/image --
- Show an image grid/gallery with 3 columns
- Displays image thumbnail with 16:9 aspect ratio (`aspect-video`)
- Uses `object-cover` to fill the card (may crop edges)
- Subtle hover zoom effect (5% scale with 300ms transition)
/items/note , /item/prompt , /item/snippet, /item/url --Grid Layout  include createdAt date to current display