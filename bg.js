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
				moveTabById(activeTab.id, activeTab.windowId, t.index);
				return;
			}
		}
	}
}

function moveTabById(tabId, windowId, index) {
	// Centralized wrapper for chrome.tabs.move to make future changes easier
	chrome.tabs.move(tabId, { windowId: windowId, index: index });
}

function getWindowTabs(windowId) {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ windowId: windowId }, function (tabs) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(tabs || []);
			}
		});
	});
}

function moveTabToGroupStart(activeTab, windowTabs) {
	// Find first tab index in the same group
	let firstIndex = null;
	for (let i = 0; i < windowTabs.length; i++) {
		const t = windowTabs[i];
		if (t.groupId === activeTab.groupId) {
			if (firstIndex === null || t.index < firstIndex) {
				firstIndex = t.index;
			}
		}
	}

	if (firstIndex !== null) {
		// Move active tab to the first index of the group
		moveTabById(activeTab.id, activeTab.windowId, firstIndex);
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

		const windowTabs = await getWindowTabs(oldTabInfo.windowId);

        if (isTabPinned(activeTab)) {
            logMessage("pinned don't move");
            return;
        }

		if (isTabInaGroup(activeTab, windowTabs)) {
			// Tab is in a group — move it to the start of its group
			logMessage("in group, moving to start of group");
			moveTabToGroupStart(activeTab, windowTabs);
			return;
		} else {
			logMessage("not in group");
		}

		if (activeTab.id === oldTabInfo.tabId) {
			moveTabById(oldTabInfo.tabId, oldTabInfo.windowId, newPosition);
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