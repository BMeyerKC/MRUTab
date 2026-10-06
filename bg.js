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
 * Move a tab group to a specific index within a window (requires "tabGroups" permission).
 * @param {number} groupId - ID of the group to move.
 * @param {number} windowId - ID of the target window.
 * @param {number} index - Target index of the group's first tab.
 * @returns {Promise<Object>} Resolves with the moved TabGroup object or rejects with an error.
 */
function moveGroupById(groupId, windowId, index) {
	return new Promise((resolve, reject) => {
		chrome.tabGroups.move(groupId, { windowId: windowId, index: index }, function (movedGroup) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(movedGroup);
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
	// Avoid accessing `tab.url` or other potentially sensitive fields
	// when `tabs` permission is not requested. Keep only non-sensitive
	// metadata useful for debugging.
	return {
		id: tab.id,
		index: tab.index,
		windowId: tab.windowId,
		groupId: tab.groupId,
		pinned: tab.pinned,
		splitViewId: tab.splitViewId,
		title: tab.title
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
 * Check whether a tab is part of a Split View (Chrome 140+).
 * On older Chrome versions `splitViewId` is undefined, so this returns false.
 * @param {Object} activeTab
 * @returns {boolean}
 */
function isTabInSplitView(activeTab) {
	const none = (chrome.tabs.SPLIT_VIEW_ID_NONE ?? -1);
	return activeTab.splitViewId !== undefined && activeTab.splitViewId !== none;
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
	       // If already at index 0, do nothing
	       if (activeTab.index === 0) {
		       return;
	       }
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

/**
 * Collect tabs (sorted by index) into the units that must move together:
 * each tab group as a whole, or a single ungrouped tab.
 * @param {Array} tabs
 * @returns {Array<{groupId:number, tabs:Array}>}
 */
function collectMoveUnits(tabs) {
	const units = [];
	for (const t of tabs) {
		const prev = units[units.length - 1];
		if (t.groupId != -1 && prev && prev.groupId === t.groupId) {
			prev.tabs.push(t);
		} else {
			units.push({ groupId: t.groupId, tabs: [t] });
		}
	}
	return units;
}

/**
 * Move a whole Split View to the left or right edge of the window (or of its
 * group, if grouped), keeping the split's tabs in their current left/right order.
 *
 * Chrome removes a Split View when one of its tabs is moved away from the other,
 * so the split tabs themselves are never moved. Instead, the tabs between the
 * split and the target edge are moved to the other side of the split.
 * @param {Object} activeTab
 * @param {Array} windowTabs
 * @param {'left'|'right'} side
 */
async function moveSplitViewToSide(activeTab, windowTabs, side) {
	const splitTabs = windowTabs
		.filter(t => t.splitViewId === activeTab.splitViewId)
		.sort((a, b) => a.index - b.index);
	const splitIds = splitTabs.map(t => t.id);
	const first = splitTabs[0].index;
	const last = splitTabs[splitTabs.length - 1].index;

	// Tabs to move past: the rest of the split's group, or all other unpinned tabs
	const grouped = activeTab.groupId != -1;
	const between = windowTabs
		.filter(t => !splitIds.includes(t.id) && !t.pinned
			&& (!grouped || t.groupId === activeTab.groupId)
			&& (side === 'left' ? t.index < first : t.index > last))
		.sort((a, b) => a.index - b.index);

	// Within a group every tab moves on its own; otherwise tab groups move as a whole
	let units = grouped
		? between.map(t => ({ groupId: -1, tabs: [t] }))
		: collectMoveUnits(between);

	// Moving a tab group needs the "tabGroups" permission. Without it, the split
	// view only moves as far as the nearest tab group.
	if (!chrome.tabGroups) {
		if (side === 'left') {
			units = units.slice(units.findLastIndex(u => u.groupId != -1) + 1);
		} else {
			const firstGroup = units.findIndex(u => u.groupId != -1);
			if (firstGroup !== -1) {
				units = units.slice(0, firstGroup);
			}
		}
	}

	// If the split view is already at the requested edge, do nothing.
	if (units.length === 0) {
		return;
	}

	try {
		let moved = 0;
		for (const unit of units) {
			// Left: each unit lands just after the split (following the units already moved).
			// Right: each unit lands just before the split (following the units already moved).
			const index = side === 'left' ? last - unit.tabs.length + 1 : first + moved;
			if (unit.groupId != -1) {
				await moveGroupById(unit.groupId, activeTab.windowId, index);
			} else {
				const tab = unit.tabs[0];
				const movedTab = await moveTabById(tab.id, activeTab.windowId, index);
				keepTabGroup(movedTab, tab.groupId);
			}
			moved += unit.tabs.length;
		}
	} catch (err) {
		logMessage('Error moving split view', { splitViewId: activeTab.splitViewId, windowId: activeTab.windowId, side: side, err: err });
	}
}

/**
 * Restore a moved tab's group membership if the move changed it (a tab can
 * join or leave a group when it lands at a group's edge).
 * @param {Object} movedTab
 * @param {number} groupId - The group the tab belonged to before the move (-1 for none).
 */
function keepTabGroup(movedTab, groupId) {
	if (!movedTab || movedTab.groupId === groupId) {
		return;
	}
	const done = function () {
		if (chrome.runtime.lastError) {
			logMessage('Failed to restore tab group', { tabId: movedTab.id, groupId: groupId, err: chrome.runtime.lastError });
		}
	};
	if (groupId == -1) {
		chrome.tabs.ungroup(movedTab.id, done);
	} else {
		chrome.tabs.group({ groupId: groupId, tabIds: movedTab.id }, done);
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

		// Read right-to-left option to determine group ordering, and split view option
		const opts = await getStorage({ rightToLeft: false, disableInSplitView: true });

		if (opts.disableInSplitView && isTabInSplitView(activeTab)) {
			// Move the split view as a unit so its tabs don't swap places
			const side = opts.rightToLeft ? 'right' : 'left';
			logMessage('split view - moving split view as a unit', { side: side, splitViewId: activeTab.splitViewId, tab: summarizeTab(activeTab) });
			await moveSplitViewToSide(activeTab, windowTabs, side);
			return;
		}

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
// No explicit commands listener: keyboard shortcuts are intentionally
// omitted from the manifest to keep permissions minimal. The extension
// still responds to tab activations (including Ctrl+Tab) via
// chrome.tabs.onActivated and will auto-move tabs as configured.

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