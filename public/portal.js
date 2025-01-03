/** Khaopiak server **/
function extractError(data) {
	if (data.success) {
		return undefined;
	}

	if (data.error) {
		return data.error;
	}

	if (data.message) {
		return (data.cause ? `${data.cause} ` : '') + data.message;
	}

	if (data.errors) {
		return data.errors
			.map((e) => `${e.path.join('.')}: ${e.message}`)
			.join('\n');
	}

	return 'An unknown error occurred';
}

/** Mnemonics **/
function autoDetectMnemonicSplit(mnemonic) {
	const mnemonicWords = mnemonic
		.trim()
		.split(' ')
		.filter((w) => w.length > 2);

	if (mnemonicWords.length >= 24 && mnemonicWords.length % 2 === 0) {
		return {
			serverMnemonic: mnemonicWords
				.slice(0, mnemonicWords.length / 2)
				.join(' '),
			clientMnemonic: mnemonicWords
				.slice(mnemonicWords.length / 2)
				.join(' ')
		};
	}

	throw Error(
		'Unable to automatically detect mnemonic portions. Expected an aggregate mnemonic.'
	);
}

/** Tab management **/

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

			if (e.hasAttribute('data-session-restore')) {
				window.location.hash = `#${e.getAttribute('data-session-restore')}`;
			}
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

	// Register dialog closures
	document.querySelectorAll('[data-change]').forEach((e) => {
		e.addEventListener('click', () => {
			dimDialog(e.getAttribute('data-change'));
		});
	});

	document.querySelectorAll('[data-input-target]').forEach((e) => {
		e.addEventListener('input', () => {
			document.getElementById(
				e.getAttribute('data-input-target')
			).innerText = e.value;
		});

		document.getElementById(e.getAttribute('data-input-target')).innerText =
			e.hasAttribute('data-input-target-default')
				? e.getAttribute('data-input-target-default')
				: (e.value ?? '');
	});

	if (window.location.hash.length) {
		const restoreItems = document.querySelectorAll(
			`[data-session-restore=${window.location.hash.slice(1)}]`
		);
		if (restoreItems.length) {
			restoreItems.item(0).click();
		}
	}

	showDialog(
		'upload',
		'warning',
		'Not implemented',
		'This feature is not implemented yet and files will not be uploaded. Please check back later.'
	);
});

/** Dialogs **/
function showDialog(name, level, title, description) {
	document
		.querySelectorAll(`figure.dialog-box[data-dialog=${name}]`)
		.forEach((e) => {
			e.setAttribute('data-dialog-level', level);
			e.removeAttribute('data-dialog-dimmed');
			e.querySelector('figcaption').innerText = title;
			e.querySelector('p').innerText = description;
		});
}

function hideDialog(name) {
	document
		.querySelectorAll(`figure.dialog-box[data-dialog=${name}]`)
		.forEach((e) => {
			e.removeAttribute('data-dialog-level');
		});
}

function dimDialog(name) {
	document
		.querySelectorAll(`figure.dialog-box[data-dialog=${name}]`)
		.forEach((e) => {
			e.setAttribute('data-dialog-dimmed', 'dimmed');
		});
}

/** Specific form endpoints **/
document
	.getElementById('form-upload')
	.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(event.target);
		if (!formData.get('file').size) {
			showDialog(
				'upload',
				'warning',
				'Invalid request',
				'You must upload a file containing content before proceeding.'
			);
			return;
		}

		showDialog(
			'upload',
			'warning',
			'Not implemented',
			'Apologies, this feature is not ready yet! Please try again later.'
		);
	});

document
	.getElementById('form-delete')
	.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(event.target);

		let serverMnemonic;

		try {
			({ serverMnemonic } = autoDetectMnemonicSplit(
				formData.get('aggregate-mnemonic')
			));
		} catch (e) {
			showDialog(
				'delete',
				'warning',
				'Error',
				e.message ?? 'An unknown error occurred'
			);
			return;
		}

		const serverFormData = new FormData();
		serverFormData.set('mnemonic', serverMnemonic);
		fetch('api/file/delete', {
			method: 'POST',
			body: serverFormData
		})
			.then((response) => {
				if (response.ok) {
					event.target.querySelector(
						'[name=aggregate-mnemonic]'
					).value = '';

					response.json().then((data) => {
						if (data.success) {
							showDialog(
								'delete',
								'success',
								'Success',
								'Request successfully sent to server.'
							);
						} else {
							showDialog(
								'delete',
								'warning',
								'Error',
								extractError(data)
							);
						}
					});
				} else {
					response
						.json()
						.then((data) => {
							showDialog(
								'delete',
								'warning',
								'Error',
								extractError(data)
							);
						})
						.catch((err) => {
							showDialog(
								'delete',
								'warning',
								'Error',
								extractError(err)
							);
						});
				}
			})
			.catch((err) => {
				showDialog('delete', 'warning', 'Error', extractError(err));
			});
	});

document
	.getElementById('form-exists')
	.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(event.target);

		let serverMnemonic;

		try {
			({ serverMnemonic } = autoDetectMnemonicSplit(
				formData.get('aggregate-mnemonic')
			));
		} catch (e) {
			showDialog(
				'exists',
				'warning',
				'Error',
				e.message ?? 'An unknown error occurred'
			);
			return;
		}

		const serverFormData = new FormData();
		serverFormData.set('mnemonic', serverMnemonic);
		fetch('api/file/exists', {
			method: 'POST',
			body: serverFormData
		})
			.then((response) => {
				if (response.ok) {
					event.target.querySelector(
						'[name=aggregate-mnemonic]'
					).value = '';

					response.json().then((data) => {
						if (data.success) {
							showDialog(
								'exists',
								'success',
								'File check succeeded',
								data.exists
									? 'The requested file exists'
									: 'The requested file does not exist'
							);
						} else {
							showDialog(
								'exists',
								'warning',
								'Error',
								extractError(data)
							);
						}
					});
				} else {
					response
						.json()
						.then((data) => {
							showDialog(
								'exists',
								'warning',
								'Error',
								extractError(data)
							);
						})
						.catch((err) => {
							showDialog(
								'exists',
								'warning',
								'Error',
								extractError(err)
							);
						});
				}
			})
			.catch((err) => {
				showDialog('exists', 'warning', 'Error', extractError(err));
			});
	});
