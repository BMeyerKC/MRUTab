var currentTab;
var blocked = false;

chrome.commands.onCommand.addListener(function(command) {
	if (command === 'next'){
		blocked = true;
		
		chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, function (windowTabs){
			var l = windowTabs.length;
			var tab;
			for (var index = 0; index < windowTabs.length; index++) {
				var t = windowTabs[index];
				if(t.active == true){
					tab = t;
				}
			}

			var id = tab.index + 1 >= windowTabs.length? windowTabs[0].id: windowTabs[tab.index + 1].id;
			chrome.tabs.update(id, { active: true});
		});
	}
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
	// Only move the tab if the user keeps that tab visible for some period of time
	currentTab = activeInfo;

	chrome.storage.sync.get({
		delayMoveTime: '1',
		rightToLeft: false
	}, function (items) {
		delay = items.delayMoveTime;
		let idx = items.rightToLeft ? -1 : 0;
		self.setTimeout(function () { tabTimeout(activeInfo, idx) }, delay * 1000);
	});

});

function getActiveTab(currentTab) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ "active": true, "windowId": currentTab.windowId }, function (tabs) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (tabs.length === 0) {
                reject(new Error("No active tab found"));
            } else {
                const activeTab = tabs[0];
                logMessage("activeTab", activeTab);
                resolve(activeTab);
            }
        });
    });
}

function moveTabToFrontNotInGroup(activeTab, windowTabs) {
	if (activeTab.groupId == -1) {
		for (var index = 0; index < windowTabs.length; index++) {
			var t = windowTabs[index];
			if(t.id != activeTab.id){
				chrome.tabs.move(activeTab.id, { windowId: activeTab.windowId, index: t.index });
				return;
			}
		}
	}
}

function isTabInaGroup(activeTab, windowTabs) {
	if (activeTab.groupId != -1) {
		for (var index = 0; index < windowTabs.length; index++) {
			var t = windowTabs[index];
			if(t.groupId == activeTab.groupId && t.id != activeTab.id){
				return true;
			}
		}
	}
	return false;
}

async function tabTimeout(oldTabInfo, newPosition) {
    try {
        const activeTab = await getActiveTab(oldTabInfo);
        if (!activeTab) {
            logMessage("no active tab");
            return;
        }

        if (isTabPinned(activeTab)) {
            logMessage("pinned don't move");
            return;
        }

        if (isTabInaGroup(activeTab)) {
            logMessage("in group don't move");
            return;
        } else {
            logMessage("not in group");
        }

        if (activeTab.id === oldTabInfo.tabId) {
            chrome.tabs.move(oldTabInfo.tabId, { windowId: oldTabInfo.windowId, index: newPosition });
        }
    } catch (error) {
        logMessage("Error in tabTimeout", error);
    }
}

function isTabPinned(activeTab) {
	return activeTab.pinned == true;
}

function logMessage(message, obj) {
	chrome.storage.sync.get({
		debugMode: false
	}, function (items) {
		if(items.debugMode){
			if (obj == null){
				console.log(message);
			}	else{
				console.log(message, obj);
			}
		}
	});
}