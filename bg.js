// ===== Globals =====
var currentTab;
var blocked = false;

// ===== Storage Helpers =====
function getStorage(defaults) {
	return new Promise((resolve) => {
		chrome.storage.sync.get(defaults, function (items) {
			resolve(items);
		});
	});
}

// ===== Chrome API Wrappers =====
function moveTabById(tabId, windowId, index) {
	// Centralized wrapper for chrome.tabs.move that returns a Promise
	return new Promise((resolve, reject) => {
		chrome.tabs.move(tabId, { windowId: windowId, index: index }, function (movedTab) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(movedTab);
			}
		});
	});
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

// ===== Helpers =====
function logMessage(message, obj) {
	chrome.storage.sync.get({
		debugMode: false
	}, function (items) {
		if (items.debugMode) {
			if (obj == null) {
				console.log(message);
			} else {
				console.log(message, obj);
			}
		}
	});
}

function isTabPinned(activeTab) {
	return activeTab.pinned == true;
}

function isTabInaGroup(activeTab, windowTabs) {
	if (activeTab.groupId != -1) {
		for (var index = 0; index < windowTabs.length; index++) {
			var t = windowTabs[index];
			if (t.groupId == activeTab.groupId && t.id != activeTab.id) {
				return true;
			}
		}
	}
	return false;
}

function moveTabToFrontNotInGroup(activeTab, windowTabs) {
	if (activeTab.groupId == -1) {
		for (var index = 0; index < windowTabs.length; index++) {
			var t = windowTabs[index];
			if (t.id != activeTab.id) {
				// don't await here, keep original behavior
				moveTabById(activeTab.id, activeTab.windowId, t.index);
				return;
			}
		}
	}
}

// Move a tab to the left or right edge of its group
async function moveTabToGroupSide(activeTab, windowTabs, side) {
	// side: 'left' -> move to smallest index in group
	// side: 'right' -> move to after the largest index in group
	let targetIndex = null;
	for (let i = 0; i < windowTabs.length; i++) {
		const t = windowTabs[i];
		if (t.groupId === activeTab.groupId) {
			if (targetIndex === null) {
				targetIndex = t.index;
			} else if (side === 'left' && t.index < targetIndex) {
				targetIndex = t.index;
			} else if (side === 'right' && t.index > targetIndex) {
				targetIndex = t.index;
			}
		}
	}

	if (targetIndex !== null) {
		// If the active tab is already at the requested edge, do nothing.
		if (side === 'left' && activeTab.index === targetIndex) {
			return;
		}
		if (side === 'right' && activeTab.index === targetIndex) {
			return;
		}

		const finalIndex = side === 'left' ? targetIndex : targetIndex + 1;
		try {
			const movedTab = await moveTabById(activeTab.id, activeTab.windowId, finalIndex);
			// If the tab lost its group (moved out), reassign it to the original group
			if (movedTab && movedTab.groupId !== activeTab.groupId) {
				chrome.tabs.group({ groupId: activeTab.groupId, tabIds: movedTab.id }, function (groupId) {
					if (chrome.runtime.lastError) {
						logMessage('Failed to reassign tab to group', chrome.runtime.lastError);
					}
				});
			}
		} catch (err) {
			logMessage('Error moving tab', err);
		}
	}
}

// ===== Main logic =====
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

		// Read right-to-left option to determine group ordering
		const opts = await getStorage({ rightToLeft: false });

		if (isTabInaGroup(activeTab, windowTabs)) {
			// Tab is in a group — move it to the left or right edge of its group depending on RTL setting
			const side = opts.rightToLeft ? 'right' : 'left';
			logMessage('in group, moving to ' + side + ' of group');
			await moveTabToGroupSide(activeTab, windowTabs, side);
			return;
		} else {
			logMessage('not in group');
		}

		if (activeTab.id === oldTabInfo.tabId) {
			// don't await here, to preserve original behavior
			moveTabById(oldTabInfo.tabId, oldTabInfo.windowId, newPosition);
		}
	} catch (error) {
		logMessage("Error in tabTimeout", error);
	}
}

// ===== Event listeners =====
chrome.commands.onCommand.addListener(function (command) {
	if (command === 'next') {
		blocked = true;

		chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, function (windowTabs) {
			var l = windowTabs.length;
			var tab;
			for (var index = 0; index < windowTabs.length; index++) {
				var t = windowTabs[index];
				if (t.active == true) {
					tab = t;
				}
			}

			var id = tab.index + 1 >= windowTabs.length ? windowTabs[0].id : windowTabs[tab.index + 1].id;
			chrome.tabs.update(id, { active: true });
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