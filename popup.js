'use strict'

let userSettings = { closeTab: false }

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

function createMinimalWindow(url, supported = false, formData = {}) {
	// sync new settings
	for (let key of Object.keys(userSettings)) { if (formData.hasOwnProperty(key)) userSettings[key] = formData[key]  }

	let closeTab = true
	if (!supported) closeTab = formData.closeTab // allow close tab setting only for custom urls

	chrome.windows.create({ url: url, type: 'popup'}, function(win) { })
	chrome.storage.local.set(userSettings)
	if (closeTab) chrome.tabs.getSelected(function(tab) { chrome.tabs.remove(tab.id) })
}

// Convert urls
// https://www.youtube.com/watch?v=gpCtA7CDHG4
// To:
// https://www.youtube.com/embed/gpCtA7CDHG4
//
// https://www.youtube.com/watch?v=LQ6A2C20PA4&t=267s&index=5&list=PLRQGRBgN_EnrzdGqBL9mP7crrIWd1zM6D
// To:
// https://www.youtube.com/embed/LQ6A2C20PA4?list=PLRQGRBgN_EnrzdGqBL9mP7crrIWd1zM6D
function generateYoutubePageUrl(tabInfo) {
	if (tabInfo.path != '/watch' || !tabInfo.paramString) return null
	let params  = paramStringToObj(tabInfo.paramString)
	let url     = `https://www.youtube.com/embed/${params.v}?autoplay=1`
	if (params.list) url += `&list=${params.list}`
	return url
}

// Convert urls
// https://www.twitch.tv/videos/270836311
// To:
// https://player.twitch.tv/?video=270836311
//
// https://www.twitch.tv/uberhaxornova
// To: 
// https://player.twitch.tv/?channel=uberhaxornova&layout=video
// 
function generateTwitchPageUrl(tabInfo) {
	let url = 'https://player.twitch.tv/?'
	if (/^\/videos\/[0-9]+/g.test(tabInfo.path)) return `${url}video=${tabInfo.path.substring(1).split('/')[1]}`
	if (/^\/[^\/.]+$/g.test(tabInfo.path)) return `${url}channel=${tabInfo.path.substring(1)}&layout=video`
	return null
}

function loadTabInfo(nonSupportedPageCallback) {
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
		let tabInfo = res[0]

		let supportedPageUrl
		switch(tabInfo.host) {
			case 'www.twitch.tv':
				if (tabInfo.isTwitchChannel) supportedPageUrl = generateTwitchPageUrl(tabInfo)
				break
			case 'www.youtube.com':
				supportedPageUrl = generateYoutubePageUrl(tabInfo)
				break
		}

		if (supportedPageUrl) return createMinimalWindow(supportedPageUrl, true)
		nonSupportedPageCallback()
	})
}

function loadCreateCustomAppSection() {
	document.getElementById('create_custom_window').addEventListener('submit', function(e) {
		e.preventDefault()
		let formData = formDataToObj(e)
		createMinimalWindow(formData.url, false, formData)
	})
	document.getElementById('create_custom_window_container').hidden = false
}

function loadUserSettings() {
	for (let key in userSettings) {
		for (let element of document.querySelectorAll(`input[name="${key}"]`)) { element.checked = userSettings[key] }
	}
}

function initPopup() {
	loadUserSettings()
	loadTabInfo(function() { loadCreateCustomAppSection()	})	
}

chrome.storage.local.get(Object.keys(userSettings), function(res) {
	for (let key in userSettings) { if (res.hasOwnProperty(key)) userSettings[key] = res[key] }
	if (['complete', 'loaded', 'interactive'].indexOf(document.readyState) != -1) return initPopup()
	document.addEventListener('DOMContentLoaded', function() { initPopup() })
});
