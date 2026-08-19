# /slop/ Arby Recover (RecoveringArby)

A Tampermonkey/Violentmonkey userscript for 4chan's `/trash/` board that automatically replaces anchor post images in `/slop/` threads with a deterministically chosen image from a shared image pool.

> _"People can't schizo over what they can't see."_

---

## Features

- **Deterministic Seeded Selection:** Uses the Mulberry32 PRNG seeded by the thread ID so that every user viewing the same thread gets the exact same replacement image.
- **Dynamic Image Sync:** Automatically fetches the latest list of anchor images from [JSON Hosting](https://jsonhosting.com/api/json/88d6ec95/raw) with a 1-hour cache TTL and built-in fallback images.
- **Live DOM Mutation Support:** Uses a `MutationObserver` from `document-start` to immediately replace images as posts load, including thumbnail scaling (maintaining aspect ratio up to 125px).
- **4chan XT Hover Support:** Automatically detects and replaces images within 4chan XT's image hover previews (`#ihover` / `#image-hover`).

---

## Installation

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Create a new userscript and paste the contents of [`recovering-arby.js`](recovering-arby.js).
3. Save and ensure the script is enabled.
4. Navigate to any `/slop/` thread on `boards.4chan.org/trash/` or `boards.4channel.org/trash/`.

---

## How It Works (Step-by-Step)

1. **Thread Identification (`@run-at document-start`):**
    - Extracts the thread ID (`opId`) from the URL pathname (`/trash/thread/{id}`).
    - Skips execution if the current page is not an active thread.

2. **Deterministic Seeded Selection:**
    - Initializes a [Mulberry32 PRNG](https://github.com/cprosche/mulberry32) seeded by the thread ID (`opId`).
    - Computes an image index based on the pool size so that every user viewing the same thread sees the exact same replacement image.
    - Starts preloading the selected image in the background.

3. **Remote Sync & Caching:**
    - Checks local storage / Greasemonkey storage (`GM_getValue` / `localStorage`) for cached images and a sync timestamp (1-hour TTL).
    - If the cache is expired or empty, it asynchronously fetches the latest image list from [JSON Hosting](https://jsonhosting.com/api/json/88d6ec95/raw).
    - If the remote fetch fails, it falls back to the embedded default image pool.
    - When a fresh list is fetched, it updates storage and recomputes the selected image if the pool changed.

4. **Thread Verification:**
    - Inspects the thread subject, document title, and OP comment to ensure the thread is a `/slop/` thread.
    - If confirmed non-`/slop/` once the DOM is loaded, disconnects the observer and terminates execution.

5. **Anchor Post Detection & Replacement:**
    - Uses a `MutationObserver` to intercept posts as they appear.
    - Scans reply posts for mentions of `anchor` (excluding quoted greentext) matching `\b(?:request\s+)?anchor\b`.
    - Locates the attachment link (`a.fileThumb`) and image element.
    - Replaces the thumbnail `src`, full image `src`, and attachment `href` with the selected image URL.
    - Calculates and applies proportional dimensions to fit the 125px thumbnail boundary.

6. **4chan XT Hover Preview Support:**
    - Monitors hover preview elements (`#ihover` / `#image-hover`).
    - If 4chan XT creates a hover preview for the anchor post (matched via original filename ID), the preview image source is automatically updated to the selected replacement image.

---

## Image Gallery

Every image in the pool is exported from the [Postimages Gallery (LXR32Rx)](https://postimg.cc/gallery/LXR32Rx), with a total of **123 variations of Arby** (hosted on [JSON Hosting](https://jsonhosting.com/api/json/88d6ec95/raw)).

---

## Schizos

There you go. Now you all get a boring anchor while the rest get our lovely Arby :).
