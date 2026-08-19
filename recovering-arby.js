// ==UserScript==
// @name         /slop/ Arby Recover
// @namespace    https://github.com/SmileyTatsu/slop-arby-recover
// @version      2026-08-18
// @description  People can't schizo over what they can't see.
// @author       SmileyTatsu
// @match        https://boards.4chan.org/trash/thread/*
// @match        https://boards.4channel.org/trash/thread/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      jsonhosting.com
// ==/UserScript==

(function () {
    "use strict";

    const DEBUG = false;

    const log = (...args) => {
        if (DEBUG) console.log("[RecoveringArby]", ...args);
    };

    const REMOTE_IMAGES_URL = "https://jsonhosting.com/api/json/88d6ec95/raw";
    const STORAGE_KEY = "recovering_arby_images";
    const STORAGE_TS_KEY = "recovering_arby_images_ts";
    const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

    // If for some reason the remote fetch fails, it uses these
    const FALLBACK_IMAGES = [
        "https://i.postimg.cc/7hQTVrV5/1720778886568.png",
        "https://i.postimg.cc/TYFD5G1F/173841124228934296868.jpg",
        "https://i.postimg.cc/brF2TfTQ/1738422893496868.png",
        "https://i.postimg.cc/ZnDyczcd/1740653919581.png",
        "https://i.postimg.cc/rF3rRcsQ/1740633397768678.jpg",
        "https://i.postimg.cc/wMbsVYVs/1740654980188.png",
        "https://i.postimg.cc/Pf6Zh1jn/17439693223404411.png",
        "https://i.postimg.cc/dtpyZv3H/1756445250667897.jpg",
        "https://i.postimg.cc/fbhS5Kx0/76852300-77507866-76852362-77507873-anchorn64.png",
    ];

    function getStorageValue(key, fallback) {
        try {
            if (typeof GM_getValue !== "undefined") {
                return GM_getValue(key, fallback);
            }
            const local = localStorage.getItem(key);
            return local ? JSON.parse(local) : fallback;
        } catch (e) {
            log("Error reading storage for", key, e);
            return fallback;
        }
    }

    function setStorageValue(key, value) {
        try {
            if (typeof GM_setValue !== "undefined") {
                GM_setValue(key, value);
                return;
            }
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            log("Error writing storage for", key, e);
        }
    }

    function loadInitialImages() {
        const cached = getStorageValue(STORAGE_KEY, null);
        if (Array.isArray(cached) && cached.length > 0) {
            return cached;
        }
        return FALLBACK_IMAGES;
    }

    let images = loadInitialImages();

    // https://github.com/cprosche/mulberry32
    function mulberry32(a) {
        return function () {
            let t = (a += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* MAIN */
    // Obtain the OP's num
    const threadIdMatch = location.pathname.match(/\/thread\/(\d+)/);
    const opId = threadIdMatch ? Number(threadIdMatch[1]) : NaN;
    if (Number.isNaN(opId)) {
        log("Skipping non-thread page:", location.pathname);
        return;
    }

    // RNG-seed-based image
    let selectedIndex = 0;
    let selectedImage = "";
    const preloader = new Image();

    function computeSelectedImage() {
        const rng = mulberry32(opId);
        selectedIndex = Math.floor(rng() * images.length);
        selectedImage = images[selectedIndex];
        preloader.src = selectedImage;
        log(
            "Selected image index",
            selectedIndex,
            "out of",
            images.length,
            ":",
            selectedImage,
        );
    }

    computeSelectedImage();

    let originalBaseName = null;
    let anchorFound = false;
    let anchorPostElement = null;

    function requestJson(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "undefined") {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    timeout: 10000,
                    headers: { "Cache-Control": "no-cache" },
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            try {
                                resolve(JSON.parse(res.responseText));
                            } catch (err) {
                                reject(err);
                            }
                        } else {
                            reject(new Error(`HTTP ${res.status}`));
                        }
                    },
                    onerror: (err) => reject(err || new Error("Network error")),
                    ontimeout: () => reject(new Error("Request timed out")),
                });
            } else if (typeof fetch !== "undefined") {
                fetch(url, { cache: "no-cache" })
                    .then((res) => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.json();
                    })
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error("No fetch or GM_xmlhttpRequest available"));
            }
        });
    }

    async function syncRemoteImages() {
        const lastSync = Number(getStorageValue(STORAGE_TS_KEY, 0)) || 0;
        const now = Date.now();

        if (now - lastSync < CACHE_TTL_MS && Array.isArray(images) && images.length > 0) {
            const minutesLeft = Math.round((CACHE_TTL_MS - (now - lastSync)) / 60000);
            log(`Images cache is fresh. Next check in ~${minutesLeft} min.`);
            return;
        }

        log("Syncing images list from jsonhosting...");
        let data = null;

        try {
            data = await requestJson(REMOTE_IMAGES_URL);
        } catch (err) {
            log("Failed to fetch remote images list from jsonhosting:", err);
        }

        if (Array.isArray(data) && data.length > 0) {
            const oldImage = selectedImage;
            const changed = JSON.stringify(images) !== JSON.stringify(data);
            images = data;
            setStorageValue(STORAGE_KEY, data);
            setStorageValue(STORAGE_TS_KEY, now);
            log(`Images cache updated (${data.length} images).`);

            if (changed) {
                computeSelectedImage();
                if (oldImage !== selectedImage) {
                    log("Selected image updated after remote sync.");
                    if (anchorFound && anchorPostElement) {
                        const link = anchorPostElement.querySelector("a.fileThumb");
                        const thumb = link?.querySelector(
                            ":scope > img:not(.full-image)",
                        );
                        const fullImage = link?.querySelector(":scope > img.full-image");

                        if (link) link.href = selectedImage;
                        if (thumb) {
                            thumb.src = selectedImage;
                            applyCalculatedDimensions(thumb, 125);
                        }
                        if (fullImage) fullImage.src = selectedImage;
                    }
                    tryReplace();
                }
            }
        }
    }

    syncRemoteImages();

    function applyCalculatedDimensions(thumb, maxBound = 125) {
        function applyDimensions(nw, nh) {
            if (nw <= 0 || nh <= 0) return;
            const scale = Math.min(maxBound / nw, maxBound / nh, 1);
            const w = Math.round(nw * scale);
            const h = Math.round(nh * scale);
            thumb.style.width = `${w}px`;
            thumb.style.height = `${h}px`;
            thumb.setAttribute("width", w);
            thumb.setAttribute("height", h);
        }

        if (preloader.complete && preloader.naturalWidth > 0) {
            applyDimensions(preloader.naturalWidth, preloader.naturalHeight);
        } else {
            preloader.addEventListener(
                "load",
                () => {
                    applyDimensions(preloader.naturalWidth, preloader.naturalHeight);
                },
                { once: true },
            );
            thumb.addEventListener(
                "load",
                () => {
                    if (thumb.naturalWidth > 0) {
                        applyDimensions(thumb.naturalWidth, thumb.naturalHeight);
                    }
                },
                { once: true },
            );
        }
    }

    log("Initialized for thread", opId, "with image index", selectedIndex);

    // Try replace the anchor post's image with the selected image
    function tryReplace() {
        // Check if the page is loaded and the OP's post is present.
        // An OP may have an empty subject.
        const opElement = document.querySelector(".op, .opContainer");
        if (!opElement) {
            log("Waiting for OP.");
            return;
        }

        // Check if /slop/
        const subject = opElement.querySelector(".subject")?.textContent || "";
        const comment = opElement.querySelector(".postMessage")?.textContent || "";
        const title = document.title || "";

        const isSlop =
            /\/slop\//i.test(subject) ||
            /\/slop\//i.test(title) ||
            /\/slop\//i.test(comment);
        if (!isSlop) {
            if (
                document.readyState === "interactive" ||
                document.readyState === "complete"
            ) {
                log("Confirmed non-/slop/ thread. Disconnecting observer.");
                observer.disconnect();
            }
            return;
        }

        // Check if 4chan XT hover preview (#ihover or #image-hover) is showing the anchor image
        const hoverMedia = document.querySelector(
            "#ihover, #image-hover, #ihover img, #image-hover img",
        );
        if (hoverMedia && originalBaseName) {
            const targetImg =
                hoverMedia.tagName === "IMG"
                    ? hoverMedia
                    : hoverMedia.querySelector("img");

            if (
                targetImg &&
                targetImg.src &&
                targetImg.src.includes(originalBaseName) &&
                targetImg.src !== selectedImage
            ) {
                targetImg.src = selectedImage;
                log("Replaced hover preview image with selected image.");
            }
        }

        // Find the anchor post's image (if any) and replace it with the selected image
        if (!anchorFound) {
            const messages = document.querySelectorAll(".replyContainer .postMessage");
            for (const message of messages) {
                // Skip if "anchor" isn't mentioned in the post
                if (!/anchor/i.test(message.textContent)) continue;

                // Quoted greentext may mention an anchor request from another post.
                const ownMessage = message.cloneNode(true);
                ownMessage.querySelectorAll(".quote").forEach((quote) => quote.remove());
                if (!/\b(?:request\s+)?anchor\b/i.test(ownMessage.textContent)) continue;

                const post = message.closest(".replyContainer");
                if (!post) continue;

                const link = post.querySelector("a.fileThumb");
                const thumb = link?.querySelector(":scope > img:not(.full-image)");
                const fullImage = link?.querySelector(":scope > img.full-image");

                if (!thumb || !link) {
                    log("Found anchor request, but it has no image attachment.");
                    continue;
                }

                if (!originalBaseName) {
                    const match = link.href.match(/\/(\d+)(?:s)?\.[a-z0-9]+$/i);
                    if (match) {
                        originalBaseName = match[1];
                    }
                }

                if (link.href !== selectedImage) link.href = selectedImage;
                if (thumb.src !== selectedImage) {
                    thumb.src = selectedImage;
                    applyCalculatedDimensions(thumb, 125);
                }
                if (fullImage && fullImage.src !== selectedImage) {
                    fullImage.src = selectedImage;
                }

                anchorFound = true;
                anchorPostElement = post;
                log("Enforced anchor image:", selectedImage);
                break;
            }
        }
    }

    const observer = new MutationObserver(tryReplace);

    function startObserving() {
        const root = document.documentElement || document.body;
        if (root) {
            observer.observe(root, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["href", "src"],
            });
            log("Observing page changes from document-start.");
            tryReplace();
        }
    }

    startObserving();
    document.addEventListener("DOMContentLoaded", tryReplace, { once: true });
})();
