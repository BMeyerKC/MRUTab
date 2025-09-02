// Saves options to chrome.storage.sync.
function save_options() {
	var delayInput = document.getElementById('delay');
	var delay = Number(delayInput.value);
	var rtl = document.getElementById('rtl').checked;
	var localDebug = document.getElementById('localDebug').checked;
	var saveBtn = document.getElementById('save');
	var status = document.getElementById('status');

	if (isNaN(delay) || delay < 0) {
		status.style.color = '#b22222';
		status.textContent = 'Please enter a valid non-negative number for delay.';
		return;
	}

	// Disable button while saving
	saveBtn.disabled = true;
	status.style.color = '#666';
	status.textContent = 'Saving...';

	chrome.storage.sync.set({
		delayMoveTime: String(delay),
		rightToLeft: rtl,
		debugMode: localDebug
	}, function () {
		status.style.color = '#2a7a2a';
		status.textContent = 'Options saved.';
		setTimeout(function () {
			status.textContent = '';
			saveBtn.disabled = false;
		}, 900);
	});
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
	// Use default value delayMoveTime = '1'
	chrome.storage.sync.get({
		delayMoveTime: '1',
		rightToLeft: false,
		debugMode: false
	}, function (items) {
		document.getElementById('delay').value = Number(items.delayMoveTime);
		document.getElementById('rtl').checked = items.rightToLeft;
		document.getElementById('localDebug').checked = items.debugMode;
	});
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

// Submit on Enter
document.getElementById('optionsForm').addEventListener('submit', function (e) {
	e.preventDefault();
	save_options();
});

// Allow Enter key inside inputs to save
document.getElementById('delay').addEventListener('keydown', function (e) {
	if (e.key === 'Enter') {
		e.preventDefault();
		save_options();
	}
});