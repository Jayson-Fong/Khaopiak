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
	.getElementById('form-delete')
	.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(event.target);

		let clientMnemonic;

		try {
			({ clientMnemonic } = autoDetectMnemonicSplit(
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
		serverFormData.set('mnemonic', clientMnemonic);
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
