/*************************************************
 * CGSpeedway – Gist URL Driven Viewer / Editor
 *************************************************/

(() => {
    'use strict';

    /*************************************************
     * CONFIG
     *************************************************/
    const DATA_FILENAME = 'cgspeedway_data.json';
    const SAVE_ENDPOINT = '/api/save'; // Cloudflare later
    const AUTOSAVE_DELAY = 1200;

    /*************************************************
     * STATE
     *************************************************/
    let dataModel = null;
    let gistId = null;
    let accessGranted = false;
    let autosaveTimer = null;
    let isDirty = false;

    /*************************************************
     * INIT
     *************************************************/
    document.addEventListener('DOMContentLoaded', () => {
        promptForGist();
    });

    /*************************************************
     * GIST URL FLOW
     *************************************************/
    function promptForGist() {
        const url = prompt('Enter the GitHub Gist URL to load data:');
        if (!url) return;

        gistId = extractGistId(url);

        if (!gistId) {
            alert('Invalid Gist URL');
            return promptForGist();
        }

        loadGistData();
    }

    function extractGistId(url) {
    // Matches both gist.github.com and gist.githubusercontent.com
    const match = url.match(/gist(?:usercontent)?\.github\.com\/[^/]+\/([a-f0-9]{32,})/i);
    return match ? match[1] : null;
}


    function buildRawUrl() {
        return `https://gist.githubusercontent.com/BigStrib/${gistId}/raw/${DATA_FILENAME}`;
    }

    /*************************************************
     * LOAD
     *************************************************/
    async function loadGistData() {
        try {
            const res = await fetch(buildRawUrl() + '?t=' + Date.now(), {
                cache: 'no-store'
            });

            if (!res.ok) throw new Error('Failed to load Gist data');

            const text = await res.text();
            dataModel = JSON.parse(text);

            renderPage(dataModel);
            lockEditing();
            attachEditGuards();

        } catch (err) {
            console.error(err);
            alert('Could not load JSON from that Gist');
        }
    }

    /*************************************************
     * RENDER (ADAPT TO YOUR PAGE)
     *************************************************/
    function renderPage(data) {
        document.querySelectorAll('[data-bind]').forEach(el => {
            const key = el.dataset.bind;
            if (key in data) {
                el.textContent = data[key];
            }
        });
    }

    /*************************************************
     * EDIT LOCKING
     *************************************************/
    function lockEditing() {
        document.querySelectorAll('[contenteditable], input, textarea')
            .forEach(el => {
                el.dataset.locked = 'true';
                el.setAttribute('readonly', 'true');
                el.setAttribute('contenteditable', 'false');
            });
    }

    function unlockEditing() {
        document.querySelectorAll('[data-locked]').forEach(el => {
            el.removeAttribute('readonly');
            el.setAttribute('contenteditable', 'true');
        });
    }

    /*************************************************
     * ACCESS GATE
     *************************************************/
    function attachEditGuards() {
        document.addEventListener('focusin', e => {
            if (!accessGranted && isEditable(e.target)) {
                e.target.blur();
                requestAccess();
            }
        }, true);
    }

    function isEditable(el) {
        return el.hasAttribute('contenteditable') ||
               el.tagName === 'INPUT' ||
               el.tagName === 'TEXTAREA';
    }

    function requestAccess() {
        showAccessModal(() => {
            accessGranted = true;
            unlockEditing();
            attachAutosave();
        });
    }

    /*************************************************
     * AUTOSAVE
     *************************************************/
    function attachAutosave() {
        document.addEventListener('input', onEdit);
    }

    function onEdit() {
        isDirty = true;
        clearTimeout(autosaveTimer);

        autosaveTimer = setTimeout(() => {
            if (isDirty) {
                saveChanges();
                isDirty = false;
            }
        }, AUTOSAVE_DELAY);
    }

    async function saveChanges() {
        collectDataFromPage();

        try {
            await fetch(SAVE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gistId,
                    data: dataModel
                })
            });
        } catch (err) {
            console.error('Save failed', err);
        }
    }

    /*************************************************
     * DATA COLLECTION
     *************************************************/
    function collectDataFromPage() {
        document.querySelectorAll('[data-bind]').forEach(el => {
            dataModel[el.dataset.bind] = el.textContent;
        });
    }

    /*************************************************
     * UI PLACEHOLDERS
     *************************************************/
    function showAccessModal(onApprove) {
        const ok = confirm('You need access to edit this Gist.');
        if (ok) onApprove();
    }

})();



    /*************************************************
     * Remove if it does not work
     *************************************************/
async function loadGistData() {
    try {
        const url = buildRawUrl();
        let res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });

        // If public gist works → done
        if (res.ok) {
            dataModel = await res.json();
            renderPage(dataModel);
            lockEditing();
            attachEditGuards();
            return;
        }

        // Fallback to proxy (private gist)
        res = await fetch('/api/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gistId })
        });

        if (!res.ok) throw new Error('Proxy load failed');

        dataModel = await res.json();
        renderPage(dataModel);
        lockEditing();
        attachEditGuards();

    } catch (err) {
        console.error(err);
        alert('Unable to load Gist data');
    }
}


