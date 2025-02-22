function onMenuCreated() {
    if (browser.runtime.lastError) {
        console.log("error creating item:" + browser.runtime.lastError);
    }
    
    syncContextMenu();
}

async function syncContextMenu() {
    let showContextMenu = await shouldShowContextMenu();
    browser.menus.update("send-to-metube", {
        visible: showContextMenu,
    });
}

browser.menus.create({
    id: "send-to-metube",
    title: "Send to MeTube",
    contexts: ["link"]
}, onMenuCreated);

async function showError(errorMessage) {
    console.error(`Error occured: ${errorMessage}`)
    await browser.runtime.sendMessage({command: 'errorOccurred', errorMessage: errorMessage});
}

function showSuccess() {
    console.log(`Successfuly sent to MeTube`);
    browser.runtime.sendMessage({command: 'success'}).then(function(){}, function(e) {});
}

async function getCurrentUrl() {
    let tabs = await browser.tabs.query({currentWindow: true, active: true});
    return tabs[0].url;
}

async function getMeTubeUrl() {
    let item = await browser.storage.sync.get("url");
    return item.url;
}

async function shouldOpenInNewTab() {
    let item = await browser.storage.sync.get("openInNewTab");
    return item.openInNewTab;
}

async function shouldShowContextMenu() {
    let item = await browser.storage.sync.get("showContextMenu");
    return 'showContextMenu' in item ? item.showContextMenu : true;
}

async function getDefaultQuality() {
    let item = await browser.storage.sync.get("defaultQuality");
    return item.defaultQuality ?? 'best';
}

async function getDefaultFormat() {
    let item = await browser.storage.sync.get("defaultFormat");
    return item.defaultFormat ?? 'any';
}

async function getDefaultAutoStart() {
    let item = await browser.storage.sync.get("defaultAutoStart");
    return item.defaultAutoStart ?? 'false';
}

async function sendToMeTube(itemUrl, quality, format, autoStart) {
    itemUrl = itemUrl || await getCurrentUrl();
    console.log(`Send to MeTube. Url: ${itemUrl}, quality: ${quality}, format: ${format}, autoStart:${autoStart}`);
    let meTubeUrl = await getMeTubeUrl();
    if (!meTubeUrl) {
        await showError('MeTube instance url not configured. Go to about:addons to configure.');
    }

    let url = new URL("add", meTubeUrl);
    let xhr = new XMLHttpRequest();
    xhr.open("POST", url.toString());

    let json = JSON.stringify({"url": itemUrl, "quality": quality, "format": format,"auto_start": (autoStart === 'true')});
    console.log(`JSON sent: ${json}`);
    xhr.send(json);
    xhr.onload = async function () {
        if (xhr.status === 200) {
            showSuccess();
            if (await shouldOpenInNewTab()) {
                await browser.tabs.create({'active': true, 'url': meTubeUrl});
            }
        } else {
            await showError('Error occurred: ' + xhr.responseText);
            console.error("Send to MeTube failed. MeTube url: " + url.toString() + ", itemUrl: " + itemUrl);
        }
    }
    xhr.onerror = async function () {
        await showError(`Error occurred. Check logs for more details. Instance url: ${meTubeUrl}`);
    }
}

browser.menus.onClicked.addListener(async function (info, tab) {
    if (info.menuItemId == "send-to-metube") {
        if (info.linkUrl) {
            let quality = await getDefaultQuality();
            let format = await getDefaultFormat();
            let autoStart = await getDefaultAutoStart();
            await sendToMeTube(info.linkUrl, quality, format, autoStart);
        }
    }
});

browser.runtime.onMessage.addListener(async (message) => {
    if (message.command === "sendToMeTube") {
        let url = message.url || await getCurrentUrl();
        let quality = message.quality || 'best';
        let format = message.format || 'any';
        let autoStart = message.autoStart || 'false';
        await sendToMeTube(url, quality, format, autoStart);
    }
});


