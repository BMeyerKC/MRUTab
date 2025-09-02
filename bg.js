// ===== Globals =====
var currentTab;
var blocked = false;

// ===== Storage Helpers =====
/**
 * Read values from chrome.storage.sync.
 * @param {Object} defaults - Default key/value pairs to request.
 * @returns {Promise<Object>} Resolves with the stored items (merged with defaults).
 */
function getStorage(defaults) {
	return new Promise((resolve) => {
		chrome.storage.sync.get(defaults, function (items) {
			resolve(items);
		});
	});
}

// ===== Chrome API Wrappers =====
/**
 * Move a tab to a specific index within a window.
 * @param {number} tabId - ID of the tab to move.
 * @param {number} windowId - ID of the target window.
 * @param {number} index - Target index within the window.
 * @returns {Promise<Object>} Resolves with the moved Tab object or rejects with an error.
 */
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

/**
 * Query all tabs for a given window.
 * @param {number} windowId
 * @returns {Promise<Array>} Resolves with an array of Tab objects (may be empty).
 */
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


/**
 * Get the currently active tab for a window represented by `currentTab` info.
 * @param {{windowId:number}} currentTab - The onActivated info object.
 * @returns {Promise<Object>} Resolves with the active Tab object or rejects on error.
 */
function getActiveTab(currentTab) {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ "active": true, "windowId": currentTab.windowId }, function (tabs) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else if (tabs.length === 0) {
				reject(new Error("No active tab found"));
			} else {
				const activeTab = tabs[0];
				logMessage("activeTab", summarizeTab(activeTab));
				resolve(activeTab);
			}
		});
	});
}

// ===== Helpers =====
/**
 * Log a debug message to the console when debugMode is enabled in storage.
 * @param {string} message
 * @param {any} [obj]
 * @returns {void}
 */
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

/**
 * Return a concise, non-sensitive summary of a Tab object for logging.
 * Omits full URLs and keeps only hostname to avoid leaking paths/queries.
 * @param {Object} tab
 * @returns {Object|null}
 */
function summarizeTab(tab) {
	if (!tab) return null;
	var host = null;
	try {
		var url = tab.url || '';
		host = url ? (new URL(url)).host : null;
	} catch (e) {
		host = null;
	}
	return {
		id: tab.id,
		index: tab.index,
		windowId: tab.windowId,
		groupId: tab.groupId,
		pinned: tab.pinned,
		title: tab.title,
		host: host
	};
}

/**
 * Check whether a tab is pinned.
 * @param {Object} activeTab
 * @returns {boolean}
 */
function isTabPinned(activeTab) {
	return activeTab.pinned == true;
}

/**
 * Return true if another tab in the same window belongs to the same group.
 * @param {Object} activeTab
 * @param {Array} windowTabs
 * @returns {boolean}
 */
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

/**
 * Move the active tab to the front of the window if it is not in a group.
 * @param {Object} activeTab
 * @param {Array} windowTabs
 */
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
/**
 * Move the active tab to the left or right edge of its group.
 * @param {Object} activeTab
 * @param {Array} windowTabs
 * @param {'left'|'right'} side
 */
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
						logMessage('Failed to reassign tab to group', { tabId: movedTab.id, attemptedGroupId: activeTab.groupId, err: chrome.runtime.lastError });
					}
				});
			}
		} catch (err) {
			logMessage('Error moving tab', { tabId: activeTab && activeTab.id, windowId: activeTab && activeTab.windowId, targetIndex: finalIndex, err: err });
		}
	}
}

// ===== Main logic =====
/**
 * Called after a short delay when a tab becomes active. Decides whether
 * to move the tab based on pinned state, grouping, and user options.
 * @param {Object} oldTabInfo - The tabs.onActivated info object.
 * @param {number} newPosition - index to move to when not grouped (usually 0 or -1)
 */
async function tabTimeout(oldTabInfo, newPosition) {
	try {
		const activeTab = await getActiveTab(oldTabInfo);
		if (!activeTab) {
			logMessage("no active tab for activation", { activation: oldTabInfo });
			return;
		}

		const windowTabs = await getWindowTabs(oldTabInfo.windowId);

		if (isTabPinned(activeTab)) {
			logMessage("pinned - skipping move", summarizeTab(activeTab));
			return;
		}

		// Read right-to-left option to determine group ordering
		const opts = await getStorage({ rightToLeft: false });

		if (isTabInaGroup(activeTab, windowTabs)) {
			// Tab is in a group — move it to the left or right edge of its group depending on RTL setting
			const side = opts.rightToLeft ? 'right' : 'left';
			logMessage('in group - moving to group edge', { side: side, groupId: activeTab.groupId, tab: summarizeTab(activeTab) });
			await moveTabToGroupSide(activeTab, windowTabs, side);
			return;
		} else {
			logMessage('not in group', summarizeTab(activeTab));
		}

		if (activeTab.id === oldTabInfo.tabId) {
			// don't await here, to preserve original behavior
			if (newPosition === 0) {
				// move to front but only when not using RTL end behavior
				moveTabToFrontNotInGroup(activeTab, windowTabs);
			} else {
				moveTabById(oldTabInfo.tabId, oldTabInfo.windowId, newPosition);
			}
		}
	} catch (error) {
		logMessage("Error in tabTimeout", { activation: oldTabInfo, err: error });
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