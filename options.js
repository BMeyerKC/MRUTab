// Saves options to chrome.storage.sync.
function save_options() {
	var delay = document.getElementById('delay').value;
	var rtl = document.getElementById('rtl').checked;
	chrome.storage.sync.set({
		delayMoveTime: delay,
		rightToLeft: rtl
	}, function () {
		// Update status to let user know options were saved.
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function () {
			status.textContent = '';
		}, 750);
	});
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
	// Use default value delayMoveTime = '1'
	chrome.storage.sync.get({
		delayMoveTime: '1',
		rightToLeft: false
	}, function (items) {
		document.getElementById('delay').value = items.delayMoveTime;
		document.getElementById('rtl').checked = items.rightToLeft;
	});
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);