# blips (microblog - bob.yexley.net)

### Feature ideas

This document contains a running checklist of ideas for features that I would like to add to the blips microblog module of the site.

- [x] ~~**Query optimization** - really need to create a view that combines not only the blip data, but all of the related graph data that it does and will have in the future, so that instead of the app having to make multiple different queries to the database to get all of the data it needs for the data graph of a single blip, it can instead make a single query to get the entire graph of data in a single fetch. [Chat with Claude about this can be found here](https://claude.ai/share/f6dd70e2-487c-463c-8000-cf4f58aa69c7)~~.
- [ ] **Reactions + Visitor Identity System** - This is actually two separate features, but the kind of, somewhat of necessity, should be developed in parallel. Reactions are dead simple, but a visitor identity system is needed to enable it properly.
  - [ ] **Reactions** - this is what it is. A simple system to allow visitors to be able to add reactions to blips on the site. They should be able to be added to any/all kinds of blips (root, updates and comments). This should be a simple “picker” component that shows a list of emojis that users can choose to react with. [Some details about how this can/should be implemented can be found in this chat with Claude](https://claude.ai/share/f6dd70e2-487c-463c-8000-cf4f58aa69c7).
  - [ ] **Visitor Identity System** - In order for a visitor to be able to add a reaction, we have to be able to identify who they are. [Chat with Claude about this can be found here](https://claude.ai/share/f424184e-86db-461b-b5f9-e62e8a2beda2).
- [ ] **Comments** - Once the above visitor identity system is in place, need to enable comments on blips. Visitors should be able to add comments directly on root blips, and updates, but not on other comments. I don’t want to hassle with having to figure out how deeply nested comments are. They should just be kept at those two levels. That should be fairly simple, and not over-complicate things.
- [ ] **Media (picture and video) uploads and viewing** - This is the big one. The details are bulleted below.
  - Should be able to attach and upload both pictures and videos to blips.
  - Tapping a button on the formatting toolbar should open a media picker dialog.
  - When the user selects one or more pictures or videos, they need to be uploaded to an **Amazon S3** bucket.
  - The upload should show progress (thinking a circular progress bar) overlaid on a tiny thumbnail of the media rendered in the blip editor.
  - The upload progress indicator/overlay should go away once the upload is done, but the thumbnail should remain visible.
  - Once the blip is published, thumbnails of attached media should be displayed on the rendered blip / blip card.
  - When thumbnails are tapped/clicked on, they should be displayed in a lightbox style media overlay on the page.
  - When there are multiple pictures/videos attached to a blip, the lightbox overlay should behave as a carousel, offering navigation through the collection of media attached to the blip, both forward and back. This should be mobile optimized and support swiping for navigation.
  - The lightbox should be rendered as a modal dialog on the page on desktop devices, with media displayed with the appropriate (ideally derived from the media itself) aspect ratio in the dialog, but on mobile devices the media should take up the maximum available space on the device.
