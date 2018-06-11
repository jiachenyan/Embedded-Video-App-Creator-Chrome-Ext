'use strict'

let tabInfo = {}
let userSettings = {
	closeTab: true,
	autoplay: true,
	createShortcut: false
}

function formDataToObj(submitEvt) {
	var formData = {}
	for (let element of submitEvt.target.elements) {
		formData[element.name] = (element.type == 'checkbox') ? element.checked : element.value
	};
	return formData
}

function paramStringToObj(paramString) {
	paramString = paramString.substring(1)
	return JSON.parse(`{"${decodeURI(paramString).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"')}"}`)
}

function launchAppAndClose(extInfo, closeTab = false) {
	chrome.storage.local.set(userSettings)
	chrome.management.launchApp(extInfo.id)
	if (closeTab) chrome.tabs.getSelected(function(tab) { chrome.tabs.remove(tab.id) })
	// window.close()
}

function createApp(url, title, formData = {}, appInfo = {}) {
	// sync new settings
	for (let key of Object.keys(userSettings)) { if (formData.hasOwnProperty(key)) userSettings[key] = formData[key]  }

	// supported app settings
	let createShortcut = formData.createShortcut
	let closeTab = false
	if (!!Object.keys(appInfo).length) {
		createShortcut = false       // no shortcut for supported app
		closeTab = formData.closeTab // allow close tab only on supported app

		// add autoplay to url
		url += url.includes('?') ? '&' : '?'
		url += 'autoplay='
		url += formData.autoplay ? appInfo.autoplayTrue : appInfo.autoplayFalse
	}

	chrome.management.generateAppForLink(url, title, function(extInfo) {
		if (createShortcut) {
			chrome.management.createAppShortcut(extInfo.id, function() { launchAppAndClose(extInfo, closeTab) })
		} else { launchAppAndClose(extInfo, closeTab) }
	})
}

// Convert urls
// https://www.youtube.com/watch?v=gpCtA7CDHG4
// To:
// https://www.youtube.com/embed/gpCtA7CDHG4
//
// https://www.youtube.com/watch?v=LQ6A2C20PA4&t=267s&index=5&list=PLRQGRBgN_EnrzdGqBL9mP7crrIWd1zM6D
// To:
// https://www.youtube.com/embed/LQ6A2C20PA4?list=PLRQGRBgN_EnrzdGqBL9mP7crrIWd1zM6D
function generateYoutubeAppInfo() {
	if (tabInfo.path == '/watch' && tabInfo.paramString) {
		let params  = paramStringToObj(tabInfo.paramString)
		let url     = `https://www.youtube.com/embed/${params.v}`
		if (params.list) url += `?list=${params.list}`

		return { url: url, appText: 'Youtube Video', autoplayTrue: '1', autoplayFalse: '0'}
	}
	null
}

// Convert urls
// https://www.twitch.tv/videos/270836311
// To:
// https://player.twitch.tv/?video=v270836311
//
// https://www.twitch.tv/uberhaxornova
// To: 
// https://player.twitch.tv/?channel=uberhaxornova
// 
function generateTwitchAppInfo() {
	let baseTwitchInfo = { url: 'https://player.twitch.tv/', autoplayTrue: 'true', autoplayFalse: 'false' }

	if (/^\/videos\/[0-9]+/g.test(tabInfo.path)) {
		baseTwitchInfo.url    += `?video=v${tabInfo.path.substring(1).split('/')[1]}`
		baseTwitchInfo.appText = 'Twitch Video'

	} else if (/^\/[^\/.]+$/g.test(tabInfo.path)) { 
		baseTwitchInfo.url    += `?channel=${tabInfo.path.substring(1)}`
		baseTwitchInfo.appText = 'Twitch Channel'

	} else { return null }
	return baseTwitchInfo
}

function loadSupportedAppSection(appInfo) {
	document.getElementById('create_page_specfic_app').addEventListener('submit', function(e) {
		e.preventDefault()
		createApp(appInfo.url, tabInfo.title, formDataToObj(e), appInfo)
	})

	document.getElementById('create_page_app_head').innerHTML = `Create Minimal App for ${appInfo.appText}`
	document.getElementById('create_page_app_container').hidden = false
}

function loadTabInfo() {
	chrome.tabs.executeScript(null, {
		code: `
			var tabInfo = {
				host:            window.location.host,
				path:            window.location.pathname,
				paramString:     window.location.search,
				url:             window.location.href,
				title:           document.title,
				isTwitchChannel: !!document.querySelector('.channel-header')
			}; 
			tabInfo
		`
	}, function(res) {
		if (!res) return
		tabInfo = res[0]

		let appInfo
		switch(tabInfo.host) {
			case 'www.twitch.tv':
				if (tabInfo.isTwitchChannel) appInfo = generateTwitchAppInfo()
				break
			case 'www.youtube.com':
				appInfo = generateYoutubeAppInfo()
				break
		}

		if (appInfo) loadSupportedAppSection(appInfo)
	})
}

function loadCreateCustomAppSection() {
	document.getElementById('create_custom_app').addEventListener('submit', function(e) {
		e.preventDefault()
		let formData = formDataToObj(e)
		createApp(formData.url, formData.title, formData)
	})
}

function loadChromeAppSection() {
	document.getElementById('chrome_apps').addEventListener('click', function() {
		chrome.tabs.create({ url: 'chrome://apps' }, function() { window.close() })
	})
}

function loadUserSettings() {
	for (let key in userSettings) {
		for (let element of document.querySelectorAll(`input[name="${key}"]`)) { element.checked = userSettings[key] }
	}
}

function initPopup() {
	loadUserSettings()
	loadChromeAppSection()
	loadCreateCustomAppSection()
	loadTabInfo()
}

chrome.storage.local.get(Object.keys(userSettings), function(res) {
	for (let key in userSettings) { if (res.hasOwnProperty(key)) userSettings[key] = res[key] }
	if (['complete', 'loaded', 'interactive'].indexOf(document.readyState) != -1) return initPopup()
	document.addEventListener('DOMContentLoaded', function() { initPopup() })
});
