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

function tabTimeout(oldTabInfo, newPosition) {
	//console.log("move", blocked);
	// Get the selected tab after the timeout
	chrome.tabs.query({ "active": true, "windowId": oldTabInfo.windowId }, function (activeTab) {
		var activeTab = activeTab[0];
		// Move the selected tab to the front only if it has been selected
		// and is not pinned
		// for the appropriate period of time
		if (activeTab.id == oldTabInfo.tabId && activeTab.pinned == false) {
			chrome.tabs.move(oldTabInfo.tabId, { windowId: oldTabInfo.windowId, index: newPosition });
		}
	});
}