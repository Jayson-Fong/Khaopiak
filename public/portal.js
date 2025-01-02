function showTab(tabLabel, tabGroup) {
	const tabGroupElements = document.querySelectorAll(
		`div[data-tab-group=${tabGroup}]`
	);
	tabGroupElements.forEach((e) => {
		e.style.display =
			e.getAttribute('data-tab-label') === tabLabel ? 'block' : 'none';
	});
}

window.addEventListener('load', () => {
	// Register tab opener buttons
	Array.from(document.getElementsByClassName('tab-button')).forEach((e) => {
		e.addEventListener('click', () => {
			showTab(
				e.getAttribute('data-tab'),
				e.getAttribute('data-tab-opener-group')
			);
			e.setAttribute('data-active', 'active');
			document
				.querySelectorAll(
					`.tab-button[data-tab-opener-group=${e.getAttribute('data-tab-opener-group')}]:not([data-tab=${e.getAttribute('data-tab')}])`
				)
				.forEach((opener) => {
					opener.removeAttribute('data-active');
				});
		});
	});

	// Hide non-default tabs
	document.querySelectorAll(`div[data-tab-group]`).forEach((e) => {
		if (e.hasAttribute('data-tab-default')) {
			e.style.display = 'block';
			document
				.querySelectorAll(
					`.tab-button[data-tab-opener-group=${e.getAttribute('data-tab-group')}][data-tab=${e.getAttribute('data-tab-label')}]`
				)
				.forEach((opener) => {
					opener.setAttribute('data-active', 'active');
				});
		} else {
			e.style.display = 'none';
		}
	});
});
